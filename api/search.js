// Vercel Serverless Function: Search stocks by name or symbol
// Usage: /api/search?q=apple

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "q parameter is required" });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const data = await response.json();
    const results = (data.quotes || [])
      .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchDisp || q.exchange,
        type: q.quoteType,
      }));

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({ results });
  } catch (error) {
    console.error("Yahoo Finance search error:", error);
    return res.status(500).json({ error: "Failed to search stocks", message: error.message });
  }
}