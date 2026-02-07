import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from "recharts";

// ─── Mock Stock Data Generator ────────────────────────────────────────
function generateStockData(symbol, basePriceInput, days = 60) {
  const data = [];
  let price = basePriceInput;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const volatility = (Math.random() - 0.48) * basePriceInput * 0.03;
    price = Math.max(price + volatility, basePriceInput * 0.7);
    data.push({
      date: date.toISOString().split("T")[0],
      dateShort: `${date.getMonth() + 1}/${date.getDate()}`,
      close: Math.round(price * 100) / 100,
      high: Math.round((price + Math.random() * 3) * 100) / 100,
      low: Math.round((price - Math.random() * 3) * 100) / 100,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
    });
  }
  for (let i = 0; i < data.length; i++) {
    if (i >= 9) {
      const sum = data.slice(i - 9, i + 1).reduce((a, d) => a + d.close, 0);
      data[i].ma10 = Math.round((sum / 10) * 100) / 100;
    }
  }
  return data;
}

// ─── Detect MA Crossover Signals ──────────────────────────────────────
function detectSignals(data) {
  const signals = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i].ma10 || !data[i - 1].ma10) continue;
    const prevAbove = data[i - 1].close > data[i - 1].ma10;
    const currAbove = data[i].close > data[i].ma10;
    if (!prevAbove && currAbove) {
      signals.push({ date: data[i].date, dateShort: data[i].dateShort, type: "BUY", price: data[i].close, ma10: data[i].ma10, reason: "가격이 10일 이동평균선을 상향 돌파" });
    } else if (prevAbove && !currAbove) {
      signals.push({ date: data[i].date, dateShort: data[i].dateShort, type: "SELL", price: data[i].close, ma10: data[i].ma10, reason: "가격이 10일 이동평균선을 하향 돌파" });
    }
  }
  return signals;
}

// ─── Available Stocks ─────────────────────────────────────────────────
const ALL_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", basePrice: 185, category: "미국 기술주", flag: "🇺🇸" },
  { symbol: "MSFT", name: "Microsoft Corp.", basePrice: 420, category: "미국 기술주", flag: "🇺🇸" },
  { symbol: "GOOGL", name: "Alphabet Inc.", basePrice: 175, category: "미국 기술주", flag: "🇺🇸" },
  { symbol: "TSLA", name: "Tesla Inc.", basePrice: 248, category: "미국 기술주", flag: "🇺🇸" },
  { symbol: "NVDA", name: "NVIDIA Corp.", basePrice: 880, category: "미국 기술주", flag: "🇺🇸" },
  { symbol: "AMZN", name: "Amazon.com Inc.", basePrice: 185, category: "미국 기술주", flag: "🇺🇸" },
  { symbol: "META", name: "Meta Platforms", basePrice: 510, category: "미국 기술주", flag: "🇺🇸" },
  { symbol: "005930", name: "삼성전자", basePrice: 72000, category: "한국 대형주", flag: "🇰🇷" },
  { symbol: "000660", name: "SK하이닉스", basePrice: 178000, category: "한국 대형주", flag: "🇰🇷" },
  { symbol: "035420", name: "NAVER", basePrice: 210000, category: "한국 기술주", flag: "🇰🇷" },
  { symbol: "035720", name: "카카오", basePrice: 48000, category: "한국 기술주", flag: "🇰🇷" },
  { symbol: "006400", name: "삼성SDI", basePrice: 420000, category: "한국 2차전지", flag: "🇰🇷" },
  { symbol: "373220", name: "LG에너지솔루션", basePrice: 380000, category: "한국 2차전지", flag: "🇰🇷" },
  { symbol: "051910", name: "LG화학", basePrice: 350000, category: "한국 화학", flag: "🇰🇷" },
  { symbol: "005380", name: "현대자동차", basePrice: 240000, category: "한국 자동차", flag: "🇰🇷" },
];

// ─── Theme ────────────────────────────────────────────────────────────
const T = {
  bg: "#0f172a", card: "#1e293b", cardHover: "#273548", border: "#334155",
  text: "#e2e8f0", muted: "#94a3b8", dim: "#64748b",
  accent: "#3b82f6", accentHover: "#2563eb",
  green: "#22c55e", red: "#ef4444", yellow: "#eab308",
};

// ─── Responsive hook ──────────────────────────────────────────────────
function useIsMobile() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w < 768;
}

// ─── Small components ─────────────────────────────────────────────────
const SignalBadge = ({ type, small }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "3px",
    padding: small ? "1px 7px" : "2px 10px", borderRadius: "999px",
    fontSize: small ? "11px" : "12px", fontWeight: 700,
    background: type === "BUY" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
    color: type === "BUY" ? T.green : T.red,
    border: `1px solid ${type === "BUY" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
  }}>
    {type === "BUY" ? "▲ 매수" : "▼ 매도"}
  </span>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,23,42,0.95)", border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px", fontSize: "12px", lineHeight: 1.6 }}>
      <p style={{ color: T.muted, margin: "0 0 4px", fontWeight: 600 }}>{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color, margin: 0 }}>{e.name}: {typeof e.value === "number" ? e.value.toLocaleString() : e.value}</p>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function InvestmentHelper() {
  const isMobile = useIsMobile();

  // ─── State ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState("watchlist"); // "watchlist" | "app"
  const [watchlist, setWatchlist] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [portfolio, setPortfolio] = useState([]);
  const [stockDataMap, setStockDataMap] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [view, setView] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // ─── Watchlist toggle ───────────────────────────────────────────
  const toggleWatchlist = (symbol) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  };

  // ─── Start app with selected stocks ─────────────────────────────
  const startApp = () => {
    if (watchlist.size === 0) return;
    const selected = ALL_STOCKS.filter((s) => watchlist.has(s.symbol)).map((s) => ({
      ...s,
      shares: Math.floor(Math.random() * 50) + 10,
      avgBuyPrice: Math.round(s.basePrice * (0.9 + Math.random() * 0.2) * 100) / 100,
    }));
    setPortfolio(selected);
    setPhase("app");
  };

  // ─── Generate data when portfolio changes ───────────────────────
  useEffect(() => {
    if (portfolio.length === 0) return;
    const dm = {};
    portfolio.forEach((s) => { dm[s.symbol] = generateStockData(s.symbol, s.basePrice); });
    setStockDataMap(dm);
    const allAlerts = [];
    portfolio.forEach((s) => {
      const sigs = detectSignals(dm[s.symbol] || []);
      sigs.forEach((sig) => allAlerts.push({ ...sig, symbol: s.symbol, name: s.name, id: `${s.symbol}-${sig.date}-${sig.type}` }));
    });
    allAlerts.sort((a, b) => b.date.localeCompare(a.date));
    setAlerts(allAlerts);
    if (!selectedStock && portfolio.length > 0) setSelectedStock(portfolio[0].symbol);
  }, [portfolio]);

  // ─── Portfolio summary ──────────────────────────────────────────
  const summary = useMemo(() => {
    let tv = 0, tc = 0;
    const items = portfolio.map((s) => {
      const d = stockDataMap[s.symbol];
      const cp = d ? d[d.length - 1]?.close : s.basePrice;
      const v = cp * s.shares, c = s.avgBuyPrice * s.shares;
      tv += v; tc += c;
      return { ...s, currentPrice: cp, value: v, cost: c, gain: v - c, gainPct: ((v - c) / c) * 100 };
    });
    return { items, tv, tc, tg: tv - tc, tgp: tc > 0 ? ((tv - tc) / tc) * 100 : 0 };
  }, [portfolio, stockDataMap]);

  // ─── Add stock from modal ───────────────────────────────────────
  const addFromModal = (symbol) => {
    const found = ALL_STOCKS.find((s) => s.symbol === symbol);
    if (found && !portfolio.find((p) => p.symbol === symbol)) {
      setPortfolio([...portfolio, { ...found, shares: 10, avgBuyPrice: Math.round(found.basePrice * 0.95 * 100) / 100 }]);
    }
    setShowAddModal(false);
  };

  const removeStock = (symbol) => {
    setPortfolio(portfolio.filter((p) => p.symbol !== symbol));
    if (selectedStock === symbol) setSelectedStock(portfolio.find((p) => p.symbol !== symbol)?.symbol || null);
  };

  // ─── Filtered stocks for watchlist search ───────────────────────
  const filteredStocks = ALL_STOCKS.filter((s) =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.includes(searchTerm)
  );
  const categories = [...new Set(ALL_STOCKS.map((s) => s.category))];

  // ─── Shared styles ──────────────────────────────────────────────
  const card = { background: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, padding: isMobile ? "16px" : "20px" };

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: WATCHLIST SELECTION
  // ═══════════════════════════════════════════════════════════════════
  if (phase === "watchlist") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: isMobile ? "24px 16px" : "48px 24px" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "16px",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px", fontWeight: 800, color: "#fff", marginBottom: "16px",
            }}>IV</div>
            <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? "22px" : "28px", fontWeight: 800 }}>관심종목 선택</h1>
            <p style={{ margin: 0, color: T.muted, fontSize: "14px", lineHeight: 1.5 }}>
              추적하고 싶은 종목을 선택하세요. 10일 이동평균선 교차 시 매수/매도 신호를 보내드립니다.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="종목명 또는 코드로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%", padding: "14px 16px 14px 42px", borderRadius: "12px",
                border: `1px solid ${T.border}`, background: T.card, color: T.text,
                fontSize: "15px", outline: "none", boxSizing: "border-box",
                WebkitAppearance: "none",
              }}
            />
            <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: T.dim, fontSize: "16px" }}>
              🔍
            </span>
          </div>

          {/* Selected count */}
          {watchlist.size > 0 && (
            <div style={{
              ...card, marginBottom: "16px", padding: "12px 16px",
              background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "14px" }}>
                <strong style={{ color: T.accent }}>{watchlist.size}개</strong> 종목 선택됨
              </span>
              <button onClick={() => setWatchlist(new Set())} style={{
                background: "none", border: "none", color: T.dim, fontSize: "13px", cursor: "pointer", padding: "4px 8px",
              }}>초기화</button>
            </div>
          )}

          {/* Stock list by category */}
          {categories.map((cat) => {
            const stocks = filteredStocks.filter((s) => s.category === cat);
            if (stocks.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: T.dim, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {cat}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {stocks.map((stock) => {
                    const selected = watchlist.has(stock.symbol);
                    return (
                      <button
                        key={stock.symbol}
                        onClick={() => toggleWatchlist(stock.symbol)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "14px 16px", borderRadius: "10px", cursor: "pointer",
                          border: selected ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                          background: selected ? "rgba(59,130,246,0.08)" : T.card,
                          color: T.text, textAlign: "left", width: "100%",
                          transition: "all 0.15s", WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "20px" }}>{stock.flag}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "15px" }}>{stock.name}</div>
                            <div style={{ fontSize: "12px", color: T.dim }}>{stock.symbol}</div>
                          </div>
                        </div>
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "6px",
                          border: selected ? "none" : `2px solid ${T.border}`,
                          background: selected ? T.accent : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px", color: "#fff", flexShrink: 0,
                        }}>
                          {selected && "✓"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Start button - sticky on mobile */}
          <div style={{
            position: "sticky", bottom: 0,
            padding: "16px 0", background: `linear-gradient(transparent, ${T.bg} 20%)`,
            paddingTop: "32px",
          }}>
            <button
              onClick={startApp}
              disabled={watchlist.size === 0}
              style={{
                width: "100%", padding: "16px", borderRadius: "14px", border: "none",
                background: watchlist.size > 0 ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : T.border,
                color: watchlist.size > 0 ? "#fff" : T.dim,
                fontSize: "16px", fontWeight: 700, cursor: watchlist.size > 0 ? "pointer" : "not-allowed",
                transition: "all 0.2s", WebkitTapHighlightColor: "transparent",
              }}
            >
              {watchlist.size > 0 ? `${watchlist.size}개 종목으로 시작하기` : "종목을 선택해주세요"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: MAIN APP
  // ═══════════════════════════════════════════════════════════════════
  const unreadCount = alerts.length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", paddingBottom: isMobile ? "72px" : 0 }}>

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <header style={{
        background: "rgba(15,23,42,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`, padding: isMobile ? "0 16px" : "0 24px",
        height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 800, color: "#fff",
          }}>IV</div>
          <span style={{ fontSize: "16px", fontWeight: 700 }}>InvestView</span>
        </div>

        {/* Desktop nav */}
        {!isMobile && (
          <nav style={{ display: "flex", gap: "2px" }}>
            {[
              { key: "dashboard", label: "대시보드" },
              { key: "chart", label: "차트 분석" },
              { key: "alerts", label: "매매 신호" },
              { key: "protocol", label: "프로토콜" },
            ].map((item) => (
              <button key={item.key} onClick={() => setView(item.key)} style={{
                padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                fontSize: "14px", fontWeight: 600, transition: "all 0.15s",
                background: view === item.key ? T.accent : "transparent",
                color: view === item.key ? "#fff" : T.muted,
                position: "relative",
              }}>
                {item.label}
                {item.key === "alerts" && unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: "2px", right: "2px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: T.red, color: "#fff", fontSize: "9px", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>
            ))}
          </nav>
        )}

        {/* Edit watchlist button */}
        <button onClick={() => { setPhase("watchlist"); }} style={{
          background: "none", border: `1px solid ${T.border}`, borderRadius: "8px",
          color: T.muted, padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
        }}>관심종목 편집</button>
      </header>

      {/* ─── Main content ────────────────────────────────────────────── */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: isMobile ? "16px" : "24px" }}>

        {/* ═══ DASHBOARD ═══════════════════════════════════════════════ */}
        {view === "dashboard" && (
          <div>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? "10px" : "16px", marginBottom: isMobile ? "16px" : "24px" }}>
              {[
                { label: "총 평가금액", value: summary.tv.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                { label: "총 투자금액", value: summary.tc.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                { label: "총 수익", value: `${summary.tg >= 0 ? "+" : ""}${summary.tg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: summary.tg >= 0 ? T.green : T.red },
                { label: "수익률", value: `${summary.tgp >= 0 ? "+" : ""}${summary.tgp.toFixed(2)}%`, color: summary.tgp >= 0 ? T.green : T.red },
              ].map((c, i) => (
                <div key={i} style={card}>
                  <div style={{ color: T.muted, fontSize: isMobile ? "11px" : "13px", marginBottom: "6px" }}>{c.label}</div>
                  <div style={{ fontSize: isMobile ? "16px" : "22px", fontWeight: 700, color: c.color || T.text, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Portfolio - mobile cards / desktop table */}
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "14px 16px" : "16px 20px", borderBottom: `1px solid ${T.border}` }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? "15px" : "16px", fontWeight: 700 }}>내 포트폴리오</h2>
                <button onClick={() => setShowAddModal(true)} style={{
                  padding: "6px 12px", borderRadius: "8px", border: "none",
                  background: T.accent, color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                }}>+ 종목 추가</button>
              </div>

              {isMobile ? (
                /* Mobile: Card list */
                <div style={{ padding: "8px" }}>
                  {summary.items.map((stock) => {
                    const sig = alerts.find((a) => a.symbol === stock.symbol);
                    return (
                      <div key={stock.symbol}
                        onClick={() => { setSelectedStock(stock.symbol); setView("chart"); }}
                        style={{
                          padding: "14px", borderRadius: "10px", marginBottom: "8px",
                          background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "15px" }}>{stock.symbol}</div>
                            <div style={{ fontSize: "12px", color: T.dim }}>{stock.name}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, fontSize: "16px", fontVariantNumeric: "tabular-nums" }}>{stock.currentPrice.toLocaleString()}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", color: T.dim }}>{stock.shares}주</span>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: stock.gainPct >= 0 ? T.green : T.red }}>
                              {stock.gainPct >= 0 ? "+" : ""}{stock.gainPct.toFixed(2)}%
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {sig && <SignalBadge type={sig.type} small />}
                            <button onClick={(e) => { e.stopPropagation(); removeStock(stock.symbol); }}
                              style={{ background: "none", border: "none", color: T.dim, fontSize: "14px", padding: "4px", cursor: "pointer" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Desktop: Table */
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["종목", "현재가", "보유수량", "평균매수가", "평가금액", "수익률", "신호", ""].map((h, i) => (
                        <th key={i} style={{ padding: "12px 16px", textAlign: i > 0 ? "right" : "left", fontSize: "11px", color: T.dim, fontWeight: 600, letterSpacing: "0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items.map((stock) => {
                      const sig = alerts.find((a) => a.symbol === stock.symbol);
                      return (
                        <tr key={stock.symbol} onClick={() => { setSelectedStock(stock.symbol); setView("chart"); }}
                          style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.15s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = T.cardHover}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600 }}>{stock.symbol}</div>
                            <div style={{ fontSize: "12px", color: T.dim }}>{stock.name}</div>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{stock.currentPrice.toLocaleString()}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>{stock.shares}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>{stock.avgBuyPrice.toLocaleString()}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600 }}>{stock.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: stock.gainPct >= 0 ? T.green : T.red }}>{stock.gainPct >= 0 ? "+" : ""}{stock.gainPct.toFixed(2)}%</td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>{sig ? <SignalBadge type={sig.type} /> : <span style={{ color: T.dim }}>—</span>}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <button onClick={(e) => { e.stopPropagation(); removeStock(stock.symbol); }}
                              style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: "16px", padding: "4px 8px" }}
                              onMouseEnter={(e) => e.target.style.color = T.red}
                              onMouseLeave={(e) => e.target.style.color = T.dim}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent signals */}
            <div style={{ ...card, marginTop: isMobile ? "16px" : "24px" }}>
              <h2 style={{ margin: "0 0 14px", fontSize: isMobile ? "15px" : "16px", fontWeight: 700 }}>최근 매매 신호</h2>
              {alerts.slice(0, 5).map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: i < 4 ? `1px solid ${T.border}` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <SignalBadge type={a.type} small={isMobile} />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: isMobile ? "13px" : "14px" }}>{a.symbol}</span>
                      {!isMobile && <span style={{ color: T.dim, marginLeft: "6px", fontSize: "13px" }}>{a.name}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? "13px" : "14px", fontVariantNumeric: "tabular-nums" }}>{a.price.toLocaleString()}</div>
                    <div style={{ fontSize: "11px", color: T.dim }}>{a.date}</div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && <div style={{ textAlign: "center", color: T.dim, padding: "24px" }}>매매 신호가 없습니다</div>}
            </div>
          </div>
        )}

        {/* ═══ CHART ═══════════════════════════════════════════════════ */}
        {view === "chart" && (
          <div>
            {/* Stock selector - horizontal scroll on mobile */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "4px" }}>
              {portfolio.map((s) => (
                <button key={s.symbol} onClick={() => setSelectedStock(s.symbol)} style={{
                  padding: "8px 14px", borderRadius: "8px", flexShrink: 0,
                  border: selectedStock === s.symbol ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                  background: selectedStock === s.symbol ? "rgba(59,130,246,0.1)" : T.card,
                  color: selectedStock === s.symbol ? T.accent : T.muted,
                  cursor: "pointer", fontSize: "13px", fontWeight: 600,
                  WebkitTapHighlightColor: "transparent",
                }}>{s.symbol}</button>
              ))}
            </div>

            {selectedStock && stockDataMap[selectedStock] && (() => {
              const data = stockDataMap[selectedStock];
              const signals = detectSignals(data);
              const stock = portfolio.find((p) => p.symbol === selectedStock);
              const lp = data[data.length - 1]?.close;
              const pp = data[data.length - 2]?.close;
              const dc = lp - pp, dcp = (dc / pp) * 100;

              return (
                <div>
                  {/* Price header */}
                  <div style={{ ...card, marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? "8px" : 0 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: isMobile ? "18px" : "24px", fontWeight: 800 }}>{stock?.name || selectedStock}</h2>
                        <span style={{ color: T.dim, fontSize: "13px" }}>{selectedStock}</span>
                      </div>
                      <div style={{ textAlign: isMobile ? "left" : "right" }}>
                        <div style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{lp?.toLocaleString()}</div>
                        <div style={{ color: dc >= 0 ? T.green : T.red, fontWeight: 600, fontSize: "14px" }}>
                          {dc >= 0 ? "▲" : "▼"} {Math.abs(dc).toFixed(2)} ({dcp >= 0 ? "+" : ""}{dcp.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div style={{ ...card, marginBottom: "16px" }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700 }}>가격 차트 & 10일 이동평균선</h3>
                    <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
                      <ComposedChart data={data} margin={{ top: 5, right: isMobile ? 10 : 30, left: isMobile ? -10 : 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.5)" />
                        <XAxis dataKey="dateShort" stroke={T.dim} fontSize={isMobile ? 10 : 12} tickLine={false} interval={isMobile ? 6 : 3} />
                        <YAxis stroke={T.dim} fontSize={isMobile ? 10 : 12} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip content={<CustomTooltip />} />
                        {!isMobile && <Legend wrapperStyle={{ fontSize: "13px" }} />}
                        <Area type="monotone" dataKey="close" fill="rgba(59,130,246,0.08)" stroke="none" />
                        <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} name="종가" activeDot={{ r: 4, fill: "#3b82f6" }} />
                        <Line type="monotone" dataKey="ma10" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={false} name="10일 MA" activeDot={{ r: 4, fill: "#f59e0b" }} />
                        {signals.map((sig, i) => (
                          <ReferenceLine key={i} x={sig.dateShort} stroke={sig.type === "BUY" ? T.green : T.red} strokeDasharray="3 3" strokeWidth={1.5} />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: isMobile ? "12px" : "24px", marginTop: "10px", fontSize: isMobile ? "11px" : "13px", color: T.muted, flexWrap: "wrap" }}>
                      <span><span style={{ display: "inline-block", width: "10px", height: "2px", background: "#3b82f6", marginRight: "5px", verticalAlign: "middle" }} />종가</span>
                      <span><span style={{ display: "inline-block", width: "10px", height: "2px", background: "#f59e0b", marginRight: "5px", verticalAlign: "middle" }} />10일 MA</span>
                      <span><span style={{ display: "inline-block", width: "10px", height: "2px", background: T.green, marginRight: "5px", verticalAlign: "middle" }} />매수</span>
                      <span><span style={{ display: "inline-block", width: "10px", height: "2px", background: T.red, marginRight: "5px", verticalAlign: "middle" }} />매도</span>
                    </div>
                  </div>

                  {/* Signals list */}
                  <div style={card}>
                    <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700 }}>{selectedStock} 매매 신호</h3>
                    {signals.length > 0 ? signals.map((sig, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between",
                        flexDirection: isMobile ? "column" : "row", gap: isMobile ? "6px" : 0,
                        padding: "12px 14px", marginBottom: "8px", borderRadius: "8px",
                        background: sig.type === "BUY" ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
                        border: `1px solid ${sig.type === "BUY" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <SignalBadge type={sig.type} small={isMobile} />
                          <span style={{ fontSize: "12px", color: T.muted }}>{sig.reason}</span>
                        </div>
                        <div style={{ fontSize: isMobile ? "12px" : "13px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.muted }}>
                          {sig.price.toLocaleString()} | MA10: {sig.ma10.toLocaleString()} <span style={{ color: T.dim }}>· {sig.date}</span>
                        </div>
                      </div>
                    )) : (
                      <div style={{ textAlign: "center", color: T.dim, padding: "24px" }}>매매 신호가 없습니다</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ ALERTS ══════════════════════════════════════════════════ */}
        {view === "alerts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? "18px" : "20px", fontWeight: 700 }}>전체 매매 신호</h2>
              <span style={{ color: T.dim, fontSize: "13px" }}>총 {alerts.length}개</span>
            </div>
            {alerts.map((a, i) => (
              <div key={i}
                onClick={() => { setSelectedStock(a.symbol); setView("chart"); }}
                style={{
                  ...card, marginBottom: "10px", cursor: "pointer",
                  borderLeft: `3px solid ${a.type === "BUY" ? T.green : T.red}`,
                  display: "flex", alignItems: isMobile ? "flex-start" : "center",
                  justifyContent: "space-between", flexDirection: isMobile ? "column" : "row",
                  gap: isMobile ? "8px" : 0,
                  WebkitTapHighlightColor: "transparent",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
                    background: a.type === "BUY" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
                  }}>{a.type === "BUY" ? "📈" : "📉"}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <span style={{ fontWeight: 700, fontSize: "14px" }}>{a.symbol}</span>
                      <SignalBadge type={a.type} small />
                    </div>
                    <div style={{ fontSize: "12px", color: T.muted }}>{a.reason}</div>
                  </div>
                </div>
                <div style={{ textAlign: isMobile ? "left" : "right", marginLeft: isMobile ? "52px" : 0 }}>
                  <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: "14px" }}>{a.price.toLocaleString()}</div>
                  <div style={{ fontSize: "11px", color: T.dim }}>{a.date}</div>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div style={{ ...card, textAlign: "center", padding: "48px", color: T.dim }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
                매매 신호가 없습니다
              </div>
            )}
          </div>
        )}

        {/* ═══ PROTOCOL ════════════════════════════════════════════════ */}
        {view === "protocol" && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: isMobile ? "18px" : "20px", fontWeight: 700 }}>매매 프로토콜</h2>
            <div style={{ ...card, marginBottom: "16px", borderLeft: `3px solid ${T.accent}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ padding: "2px 8px", borderRadius: "4px", background: "rgba(34,197,94,0.15)", color: T.green, fontSize: "11px", fontWeight: 700 }}>활성</span>
                <span style={{ fontSize: "11px", color: T.dim }}>프로토콜 #1</span>
              </div>
              <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 700 }}>10일 이동평균선 교차 전략</h3>
              <div style={{ background: "rgba(15,23,42,0.5)", borderRadius: "8px", padding: isMobile ? "14px" : "16px", marginBottom: "14px" }}>
                <div style={{ fontSize: "14px", lineHeight: 1.8, color: T.muted }}>
                  <p style={{ margin: "0 0 10px" }}><strong style={{ color: T.text }}>매수 (BUY):</strong> 종가가 10일 MA를 <span style={{ color: T.green, fontWeight: 600 }}>상향 돌파</span></p>
                  <p style={{ margin: "0 0 10px" }}><strong style={{ color: T.text }}>매도 (SELL):</strong> 종가가 10일 MA를 <span style={{ color: T.red, fontWeight: 600 }}>하향 돌파</span></p>
                  <p style={{ margin: 0 }}><strong style={{ color: T.text }}>로직:</strong> 전일과 당일의 종가-MA 위치 관계가 역전될 때 신호 발생</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: isMobile ? "12px" : "24px", fontSize: "13px", color: T.dim, flexWrap: "wrap" }}>
                <span>적용 종목: <strong style={{ color: T.text }}>{portfolio.length}개</strong></span>
                <span>감지 신호: <strong style={{ color: T.text }}>{alerts.length}개</strong></span>
                <span>MA 기간: <strong style={{ color: T.text }}>10일</strong></span>
              </div>
            </div>

            <div style={card}>
              <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700 }}>작동 원리</h3>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "12px" }}>
                {[
                  { title: "데이터 수집", desc: "각 종목의 일별 종가 데이터를 수집합니다", icon: "📊" },
                  { title: "이동평균 계산", desc: "최근 10일간의 종가 평균을 매일 계산합니다", icon: "📐" },
                  { title: "교차 감지", desc: "종가와 MA선의 교차를 감지하여 신호를 생성합니다", icon: "🔔" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "rgba(15,23,42,0.5)", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
                    <div style={{ fontSize: "28px", marginBottom: "10px" }}>{item.icon}</div>
                    <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "14px" }}>{item.title}</div>
                    <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...card, marginTop: "16px", border: `2px dashed ${T.border}`, textAlign: "center", padding: "32px", background: "transparent" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px" }}>🚀</div>
              <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "14px" }}>프로토콜 추가 예정</div>
              <div style={{ color: T.dim, fontSize: "12px" }}>RSI, MACD, 볼린저 밴드 등</div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Mobile Bottom Navigation ────────────────────────────────── */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(15,23,42,0.95)", backdropFilter: "blur(12px)",
          borderTop: `1px solid ${T.border}`, display: "flex",
          padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 50,
        }}>
          {[
            { key: "dashboard", icon: "📊", label: "대시보드" },
            { key: "chart", icon: "📈", label: "차트" },
            { key: "alerts", icon: "🔔", label: "신호" },
            { key: "protocol", icon: "⚙️", label: "프로토콜" },
          ].map((item) => (
            <button key={item.key} onClick={() => setView(item.key)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: "2px", padding: "8px 0", background: "none", border: "none",
              color: view === item.key ? T.accent : T.dim, cursor: "pointer",
              fontSize: "10px", fontWeight: view === item.key ? 700 : 500,
              WebkitTapHighlightColor: "transparent", position: "relative",
            }}>
              <span style={{ fontSize: "20px" }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.key === "alerts" && unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: "4px", right: "calc(50% - 18px)",
                  width: "14px", height: "14px", borderRadius: "50%",
                  background: T.red, color: "#fff", fontSize: "8px", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      {/* ─── Add Stock Modal ─────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 100 }}
          onClick={() => setShowAddModal(false)}>
          <div style={{
            background: T.card, padding: "20px",
            width: isMobile ? "100%" : "440px",
            borderRadius: isMobile ? "16px 16px 0 0" : "16px",
            border: `1px solid ${T.border}`,
            maxHeight: "70vh", overflowY: "auto",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 700 }}>종목 추가</h3>
            {ALL_STOCKS.filter((s) => !portfolio.find((p) => p.symbol === s.symbol)).map((stock) => (
              <button key={stock.symbol} onClick={() => addFromModal(stock.symbol)} style={{
                display: "flex", alignItems: "center", gap: "12px",
                width: "100%", padding: "12px", borderRadius: "8px",
                border: `1px solid ${T.border}`, background: T.bg, color: T.text,
                cursor: "pointer", marginBottom: "6px", textAlign: "left",
                WebkitTapHighlightColor: "transparent",
              }}>
                <span style={{ fontSize: "18px" }}>{stock.flag}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{stock.name}</div>
                  <div style={{ fontSize: "12px", color: T.dim }}>{stock.symbol}</div>
                </div>
              </button>
            ))}
            {ALL_STOCKS.filter((s) => !portfolio.find((p) => p.symbol === s.symbol)).length === 0 && (
              <div style={{ textAlign: "center", color: T.dim, padding: "24px" }}>모든 종목이 추가되었습니다</div>
            )}
            <button onClick={() => setShowAddModal(false)} style={{
              width: "100%", padding: "12px", marginTop: "8px", borderRadius: "10px",
              border: `1px solid ${T.border}`, background: "transparent", color: T.muted,
              fontSize: "14px", cursor: "pointer",
            }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}