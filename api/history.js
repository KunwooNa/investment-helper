// Vercel Serverless Function: Fetch stock history with 3-tier fallback
// Yahoo Finance → Alpha Vantage → Financial Modeling Prep
// Usage: /api/history?symbol=AAPL&range=3mo&interval=1d

// ─── Normalize Korean stock symbols for Yahoo Finance ────────────
function yahooSymbol(symbol) {
  if (/^\d{6}$/.test(symbol)) return `${symbol}.KS`;
  return symbol;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { symbol, range = "3mo", interval = "1d" } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol parameter is required" });

  const ySymbol = yahooSymbol(symbol);

  // Try providers in order
  let result = await tryYahoo(ySymbol, range, interval);
  if (!result) result = await tryAlphaVantage(ySymbol);
  if (!result) result = await tryFMP(symbol); // FMP uses original symbol

  if (!result) {
    return res.status(502).json({ error: "All data providers failed", symbol });
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json({ ...result, symbol });
}

// ═══ Provider 1: Yahoo Finance (무료, 제한 넉넉) ═══════════════════════
async function tryYahoo(symbol, range, interval) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!response.ok) throw new Error(`Yahoo: ${response.status}`);
    const data = await response.json();
    const r = data.chart?.result?.[0];
    if (!r) throw new Error("Yahoo: no result");

    const ts = r.timestamp || [];
    const q = r.indicators?.quote?.[0] || {};
    const m = r.meta || {};

    return {
      provider: "yahoo",
      currency: m.currency,
      exchange: m.exchangeName,
      regularMarketPrice: m.regularMarketPrice,
      previousClose: m.previousClose || m.chartPreviousClose,
      history: ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().split("T")[0],
        open: round(q.open?.[i]),
        high: round(q.high?.[i]),
        low: round(q.low?.[i]),
        close: round(q.close?.[i]),
        volume: q.volume?.[i] || 0,
      })).filter((d) => d.close !== null),
    };
  } catch (e) {
    console.log("Yahoo failed:", e.message);
    return null;
  }
}

// ═══ Provider 2: Alpha Vantage (무료 25건/일, 유료 $50/월) ═════════════
async function tryAlphaVantage(symbol) {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) { console.log("Alpha Vantage: no API key"); return null; }

  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`AV: ${response.status}`);
    const data = await response.json();

    if (data["Error Message"] || data["Note"]) throw new Error("AV: " + (data["Error Message"] || data["Note"]));

    const ts = data["Time Series (Daily)"];
    if (!ts) throw new Error("AV: no time series data");

    const history = Object.entries(ts)
      .map(([date, vals]) => ({
        date,
        open: round(parseFloat(vals["1. open"])),
        high: round(parseFloat(vals["2. high"])),
        low: round(parseFloat(vals["3. low"])),
        close: round(parseFloat(vals["4. close"])),
        volume: parseInt(vals["5. volume"]) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-90); // Last 3 months

    const last = history[history.length - 1];
    const prev = history[history.length - 2];

    return {
      provider: "alphavantage",
      currency: null,
      exchange: null,
      regularMarketPrice: last?.close,
      previousClose: prev?.close,
      history,
    };
  } catch (e) {
    console.log("Alpha Vantage failed:", e.message);
    return null;
  }
}

// ═══ Provider 3: Financial Modeling Prep (무료 250건/일, 유료 $19/월) ═══
async function tryFMP(symbol) {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) { console.log("FMP: no API key"); return null; }

  try {
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?timeseries=90&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FMP: ${response.status}`);
    const data = await response.json();

    const hist = data.historical;
    if (!hist || hist.length === 0) throw new Error("FMP: no data");

    const history = hist
      .map((d) => ({
        date: d.date,
        open: round(d.open),
        high: round(d.high),
        low: round(d.low),
        close: round(d.close),
        volume: d.volume || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const last = history[history.length - 1];
    const prev = history[history.length - 2];

    return {
      provider: "fmp",
      currency: null,
      exchange: data.symbol,
      regularMarketPrice: last?.close,
      previousClose: prev?.close,
      history,
    };
  } catch (e) {
    console.log("FMP failed:", e.message);
    return null;
  }
}

function round(v) {
  return v != null && !isNaN(v) ? Math.round(v * 100) / 100 : null;
}