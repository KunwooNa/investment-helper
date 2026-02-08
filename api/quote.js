// Vercel Serverless Function: Fetch current quotes with 3-tier fallback
// Yahoo Finance → Alpha Vantage → Financial Modeling Prep
// Usage: /api/quote?symbols=AAPL,MSFT,005930

// ─── Normalize Korean stock symbols for Yahoo Finance ────────────
function yahooSymbol(symbol) {
  if (/^\d{6}$/.test(symbol)) return `${symbol}.KS`;
  return symbol;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: "symbols parameter is required" });

  const symbolList = symbols.split(",").map((s) => s.trim());
  const yahooSymbols = symbolList.map(yahooSymbol);

  let quotes = await tryYahooQuotes(yahooSymbols);
  if (!quotes || quotes.length === 0) quotes = await tryFallbackQuotes(symbolList);

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  return res.status(200).json({ quotes: quotes || [] });
}

// ═══ Yahoo Finance Quotes ═══════════════════════════════════════════════
async function tryYahooQuotes(symbols) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!response.ok) throw new Error(`Yahoo: ${response.status}`);
    const data = await response.json();

    return (data.quoteResponse?.result || []).map((q) => ({
      symbol: q.symbol,
      name: q.shortName || q.longName,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      previousClose: q.regularMarketPreviousClose,
      currency: q.currency,
      exchange: q.exchange,
      provider: "yahoo",
    }));
  } catch (e) {
    console.log("Yahoo quotes failed:", e.message);
    return null;
  }
}

// ═══ Fallback: FMP or Alpha Vantage (one by one) ═══════════════════════
async function tryFallbackQuotes(symbols) {
  const fmpKey = process.env.FMP_KEY;
  const avKey = process.env.ALPHA_VANTAGE_KEY;

  // Try FMP batch quote
  if (fmpKey) {
    try {
      const url = `https://financialmodelingprep.com/api/v3/quote/${symbols.join(",")}?apikey=${fmpKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((q) => ({
            symbol: q.symbol,
            name: q.name,
            price: q.price,
            change: q.change,
            changePercent: q.changesPercentage,
            previousClose: q.previousClose,
            currency: null,
            exchange: q.exchange,
            provider: "fmp",
          }));
        }
      }
    } catch (e) { console.log("FMP quotes failed:", e.message); }
  }

  // Try Alpha Vantage (one at a time, slower)
  if (avKey) {
    try {
      const quotes = [];
      for (const sym of symbols.slice(0, 5)) { // Limit to 5 to avoid rate limits
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${avKey}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const gq = data["Global Quote"];
          if (gq && gq["05. price"]) {
            quotes.push({
              symbol: gq["01. symbol"],
              name: null,
              price: parseFloat(gq["05. price"]),
              change: parseFloat(gq["09. change"]),
              changePercent: parseFloat(gq["10. change percent"]?.replace("%", "")),
              previousClose: parseFloat(gq["08. previous close"]),
              currency: null,
              exchange: null,
              provider: "alphavantage",
            });
          }
        }
      }
      if (quotes.length > 0) return quotes;
    } catch (e) { console.log("AV quotes failed:", e.message); }
  }

  return null;
}