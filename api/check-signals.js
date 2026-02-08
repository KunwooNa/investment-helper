// Vercel Serverless Function: Cron job to check MA crossover signals
// Called automatically by Vercel Cron every 5 minutes
// GET /api/check-signals?key=CRON_SECRET
//
// Flow:
// 1. Get all registered devices from KV
// 2. For each unique stock across all watchlists, fetch price data
// 3. Detect 10-day MA crossover signals
// 4. Compare with last known signals to find NEW signals
// 5. Send push notifications via Expo Push API for new signals
// 6. Update last known signals in KV

// ─── Helper: Normalize Korean stock symbols for Yahoo Finance ────
function yahooSymbol(symbol) {
  // Korean KOSPI stocks: 6-digit numbers → append .KS
  if (/^\d{6}$/.test(symbol)) {
    return `${symbol}.KS`;
  }
  return symbol;
}

// ─── Helper: Fetch stock data from Yahoo Finance ────────────────
async function fetchStockData(symbol) {
  const ySymbol = yahooSymbol(symbol);

  // Try Yahoo Finance first
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=1mo&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const meta = result.meta || {};

    const data = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split("T")[0],
      close: quotes.close?.[i],
      high: quotes.high?.[i],
      low: quotes.low?.[i],
    })).filter((d) => d.close != null);

    // Calculate 10-day MA
    for (let i = 0; i < data.length; i++) {
      if (i >= 9) {
        const sum = data.slice(i - 9, i + 1).reduce((a, d) => a + d.close, 0);
        data[i].ma10 = Math.round((sum / 10) * 100) / 100;
      }
    }

    return {
      symbol,
      data,
      currentPrice: meta.regularMarketPrice,
      currency: meta.currency,
      name: meta.shortName || meta.longName || symbol,
    };
  } catch (err) {
    console.error(`Failed to fetch ${symbol}:`, err.message);
    return null;
  }
}

// ─── Helper: Detect latest signal ───────────────────────────────
function detectLatestSignal(data) {
  if (!data || data.length < 11) return null;

  // Check last 3 days for fresh signals
  for (let i = data.length - 1; i >= Math.max(data.length - 3, 1); i--) {
    if (!data[i].ma10 || !data[i - 1].ma10) continue;

    const prevAbove = data[i - 1].close > data[i - 1].ma10;
    const currAbove = data[i].close > data[i].ma10;

    if (!prevAbove && currAbove) {
      return {
        type: "BUY",
        date: data[i].date,
        price: data[i].close,
        ma10: data[i].ma10,
        reason: "가격이 10일 이동평균선을 상향 돌파",
      };
    } else if (prevAbove && !currAbove) {
      return {
        type: "SELL",
        date: data[i].date,
        price: data[i].close,
        ma10: data[i].ma10,
        reason: "가격이 10일 이동평균선을 하향 돌파",
      };
    }
  }
  return null;
}

// ─── Helper: Send Expo Push Notification ────────────────────────
async function sendPushNotification(pushToken, title, body, data = {}) {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
        priority: "high",
        badge: 1,
        categoryId: "signal",
      }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Push send error:", error);
    return null;
  }
}

// ─── Helper: KV operations ──────────────────────────────────────
async function kvGet(key) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  await fetch(`${KV_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
}

async function kvSmembers(key) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${KV_URL}/smembers/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result || [];
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  // Security: verify this is called by Vercel Cron or authorized caller
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const queryKey = req.query.key;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "KV storage not configured" });
  }

  try {
    // 1. Get all registered devices
    const deviceKeys = await kvSmembers("device_index");
    if (deviceKeys.length === 0) {
      return res.status(200).json({ message: "No registered devices", checked: 0 });
    }

    // 2. Collect all unique symbols across all watchlists
    const allSymbols = new Set();
    const devices = [];

    for (const key of deviceKeys) {
      const device = await kvGet(key);
      if (device && device.pushToken && device.watchlist) {
        devices.push({ ...device, _key: key });
        device.watchlist.forEach((s) => allSymbols.add(s));
      }
    }

    if (allSymbols.size === 0) {
      return res.status(200).json({ message: "No symbols to check", devices: devices.length });
    }

    // 3. Fetch stock data for all unique symbols
    const stockDataMap = {};
    const symbolArray = [...allSymbols];

    // Fetch in parallel (batches of 5 to be gentle on API)
    for (let i = 0; i < symbolArray.length; i += 5) {
      const batch = symbolArray.slice(i, i + 5);
      const results = await Promise.all(batch.map(fetchStockData));
      results.forEach((result) => {
        if (result) stockDataMap[result.symbol] = result;
      });
    }

    // 4. For each device, check for new signals
    let notificationsSent = 0;
    const signalsDetected = [];

    for (const device of devices) {
      const newSignals = [];

      for (const symbol of device.watchlist) {
        const stockData = stockDataMap[symbol];
        if (!stockData) continue;

        const latestSignal = detectLatestSignal(stockData.data);
        if (!latestSignal) continue;

        // Check if this is a NEW signal (not already notified)
        const signalKey = `${symbol}-${latestSignal.date}-${latestSignal.type}`;
        const lastKnown = device.lastSignals?.[symbol];

        if (lastKnown !== signalKey) {
          newSignals.push({
            symbol,
            name: stockData.name,
            ...latestSignal,
            signalKey,
          });
        }
      }

      // 5. Send push notifications for new signals
      if (newSignals.length > 0) {
        for (const signal of newSignals) {
          const emoji = signal.type === "BUY" ? "📈" : "📉";
          const action = signal.type === "BUY" ? "매수" : "매도";
          const title = `${emoji} ${signal.symbol} ${action} 신호!`;
          const body = `${signal.name}\n${signal.reason}\n현재가: ${signal.price.toLocaleString()} | MA10: ${signal.ma10.toLocaleString()}`;

          await sendPushNotification(device.pushToken, title, body, {
            symbol: signal.symbol,
            type: signal.type,
            price: signal.price,
            date: signal.date,
          });

          notificationsSent++;
          signalsDetected.push({
            device: device.deviceName,
            symbol: signal.symbol,
            type: signal.type,
            date: signal.date,
          });

          // Update lastSignals
          if (!device.lastSignals) device.lastSignals = {};
          device.lastSignals[signal.symbol] = signal.signalKey;
        }

        // 6. Save updated lastSignals to KV
        await kvSet(device._key, {
          ...device,
          _key: undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return res.status(200).json({
      success: true,
      checkedAt: new Date().toISOString(),
      devices: devices.length,
      symbolsChecked: symbolArray.length,
      notificationsSent,
      signalsDetected,
    });
  } catch (error) {
    console.error("Cron check-signals error:", error);
    return res.status(500).json({ error: "Failed to check signals", message: error.message });
  }
}
