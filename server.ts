import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL?.trim() || '';

app.use(express.json({ limit: '1mb' }));

// --- Security: Per-IP Rate Limiter & Input Sanitization ---
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 180;

app.use('/api', (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_REQUESTS) {
    recordAudit('RATE_LIMIT', `${ip} exceeded ${RATE_MAX_REQUESTS}/min on ${req.path}`, 'WARN');
    return res.status(429).json({ error: 'Rate limit exceeded. Institutional throttle active.' });
  }
  next();
});

// --- Audit Log Store ---
interface AuditEntry {
  id: string;
  timestamp: number;
  category: string;
  message: string;
  level: 'INFO' | 'WARN' | 'ERROR';
}
const auditLogs: AuditEntry[] = [];

function recordAudit(category: string, message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  auditLogs.unshift({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    category,
    message,
    level,
  });
  if (auditLogs.length > 150) auditLogs.pop();
}

recordAudit('SYSTEM', 'UMAR WITH TRADE Node Institutional Bridge initialized (Paper Trading Only)');

// Lazily initialize Google Gemini SDK on Server-Side only
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeSymbol(raw: unknown, fallback = 'BTCUSDT'): string {
  const s = String(raw || fallback).toUpperCase().replace(/[^A-Z0-9._-]/g, '');
  return s.slice(0, 16) || fallback;
}

// Helper for timeframe mapping
function mapTimeframeToBinance(tf: string): string {
  switch (tf.toLowerCase()) {
    case '1m': return '1m';
    case '3m': return '3m';
    case '5m': return '5m';
    case '15m': return '15m';
    case '30m': return '30m';
    case '1h': return '1h';
    case '4h': return '4h';
    case '1d': return '1d';
    case '1w': return '1w';
    default: return '15m';
  }
}

// Optional Proxy helper if PYTHON_BACKEND_URL is configured
async function tryPythonBackend(endpoint: string, options?: RequestInit): Promise<any | null> {
  if (!PYTHON_BACKEND_URL) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${PYTHON_BACKEND_URL.replace(/\/$/, '')}${endpoint}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) return await res.json();
  } catch {
    // Python backend optional in Node-only preview container
  }
  return null;
}

// In-memory cache to prevent hitting upstream rate limits
const candleCache = new Map<string, { timestamp: number; data: any[]; isLive: boolean; source: string }>();
const CACHE_TTL_MS = 8000;

// --- 1. API: Multi-Market Candles (ZERO fabricated prices/candles) ---
app.get('/api/market/candles', async (req, res) => {
  try {
    const symbol = sanitizeSymbol(req.query.symbol, 'BTCUSDT');
    const timeframe = String(req.query.timeframe || '15m').toLowerCase();
    const market = String(req.query.market || 'crypto').toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit || 120), 2), 300);

    // Optional Python FastAPI delegation
    const pyData = await tryPythonBackend(
      `/api/py/candles?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    );
    if (pyData && Array.isArray(pyData.candles) && pyData.candles.length > 0 && pyData.isLiveFeed) {
      return res.json(pyData);
    }

    const cacheKey = `${symbol}_${market}_${timeframe}_${limit}`;
    const cached = candleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({
        symbol,
        market,
        timeframe,
        isLiveFeed: cached.isLive,
        demoMode: !cached.isLive,
        source: cached.source,
        statusMessage: cached.isLive
          ? `LIVE INSTITUTIONAL FEED (${cached.source})`
          : 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE',
        candles: cached.data,
      });
    }

    let candles: any[] = [];
    let isLive = false;
    let source = 'UNAVAILABLE';

    if (market === 'crypto' || symbol.endsWith('USDT')) {
      try {
        const interval = mapTimeframeToBinance(timeframe);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(binanceUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const rawData = await response.json();
          if (Array.isArray(rawData) && rawData.length > 0) {
            candles = rawData.map((k: any) => ({
              time: Math.floor(k[0] / 1000),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            }));
            isLive = true;
            source = 'BINANCE_SPOT';
          }
        }
      } catch (err) {
        recordAudit('MARKET_FEED', `Binance candle feed error for ${symbol}: ${(err as Error).message}`, 'WARN');
      }
    } else {
      try {
        let yfSymbol = symbol;
        if (market === 'forex') {
          if (symbol === 'EURUSD') yfSymbol = 'EURUSD=X';
          else if (symbol === 'GBPUSD') yfSymbol = 'GBPUSD=X';
          else if (symbol === 'USDJPY') yfSymbol = 'JPY=X';
          else if (symbol === 'XAUUSD') yfSymbol = 'GC=F';
          else if (symbol === 'XAGUSD') yfSymbol = 'SI=F';
          else if (symbol === 'AUDUSD') yfSymbol = 'AUDUSD=X';
          else yfSymbol = `${symbol}=X`;
        }

        const interval =
          timeframe === '1w' ? '1wk' :
          timeframe === '1d' ? '1d' :
          timeframe === '1h' || timeframe === '4h' ? '60m' :
          timeframe === '5m' ? '5m' : '15m';
        const range = timeframe === '1w' ? '2y' : timeframe === '1d' ? '6mo' : timeframe === '4h' || timeframe === '1h' ? '1mo' : '5d';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=${interval}&range=${range}`;
        const response = await fetch(yfUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          const result = json?.chart?.result?.[0];
          if (result?.timestamp && result?.indicators?.quote?.[0]) {
            const timestamps = result.timestamp;
            const quote = result.indicators.quote[0];
            const parsed: any[] = [];
            for (let i = 0; i < timestamps.length; i++) {
              const o = quote.open[i];
              const h = quote.high[i];
              const l = quote.low[i];
              const c = quote.close[i];
              const v = quote.volume?.[i] ?? 0;
              if (o != null && h != null && l != null && c != null) {
                parsed.push({
                  time: timestamps[i],
                  open: Number(o.toFixed(5)),
                  high: Number(h.toFixed(5)),
                  low: Number(l.toFixed(5)),
                  close: Number(c.toFixed(5)),
                  volume: Number(v),
                });
              }
            }
            if (parsed.length > 0) {
              candles = parsed.slice(-limit);
              isLive = true;
              source = 'YAHOO_FINANCE';
            }
          }
        }
      } catch (err) {
        recordAudit('MARKET_FEED', `Yahoo Finance feed error for ${symbol}: ${(err as Error).message}`, 'WARN');
      }
    }

    // STRICT NO-FAKE-DATA RULE: Never synthesize fake/random candles if live feed fails
    if (!isLive || candles.length === 0) {
      isLive = false;
      candles = [];
      source = 'OFFLINE';
    }

    candleCache.set(cacheKey, { timestamp: Date.now(), data: candles, isLive, source });

    return res.json({
      symbol,
      market,
      timeframe,
      isLiveFeed: isLive,
      demoMode: !isLive,
      source,
      statusMessage: isLive
        ? `LIVE INSTITUTIONAL FEED (${source})`
        : 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE',
      candles,
    });
  } catch (error) {
    console.error('Error fetching candles:', error);
    return res.status(200).json({
      symbol: sanitizeSymbol(req.query.symbol),
      market: String(req.query.market || 'crypto'),
      timeframe: String(req.query.timeframe || '15m'),
      isLiveFeed: false,
      demoMode: true,
      source: 'ERROR',
      statusMessage: 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE',
      candles: [],
    });
  }
});

// --- 2. API: Real-Time Order Flow (Binance Depth + AggTrades / Bookmap Bridge) ---
interface OrderFlowSnapshot {
  symbol: string;
  isLive: boolean;
  source: string;
  statusMessage: string;
  timestamp: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  buyInflow: number;
  sellOutflow: number;
  cumulativeDelta: number;
  bidAskImbalance: number; // -1 to +1
  volumeSpike: boolean;
  volumeSpikeRatio: number;
  absorptionDetected: 'NONE' | 'BULLISH_ABSORPTION' | 'BEARISH_ABSORPTION';
  institutionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  bidWalls: Array<{ price: number; qty: number; notional: number }>;
  askWalls: Array<{ price: number; qty: number; notional: number }>;
  bids: Array<{ price: number; qty: number }>;
  asks: Array<{ price: number; qty: number }>;
  recentTrades: Array<{ price: number; qty: number; side: 'BUY' | 'SELL'; time: number }>;
}

const cvdSessionMap = new Map<string, number>();

async function fetchLiveOrderFlow(symbol: string): Promise<OrderFlowSnapshot> {
  const cleanSym = sanitizeSymbol(symbol, 'BTCUSDT');
  const now = Date.now();
  const emptySnapshot: OrderFlowSnapshot = {
    symbol: cleanSym,
    isLive: false,
    source: 'UNAVAILABLE',
    statusMessage: 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE (Order Flow requires Binance Spot symbol or Bookmap API)',
    timestamp: now,
    bestBid: 0,
    bestAsk: 0,
    spread: 0,
    buyInflow: 0,
    sellOutflow: 0,
    cumulativeDelta: 0,
    bidAskImbalance: 0,
    volumeSpike: false,
    volumeSpikeRatio: 1,
    absorptionDetected: 'NONE',
    institutionalBias: 'NEUTRAL',
    bidWalls: [],
    askWalls: [],
    bids: [],
    asks: [],
    recentTrades: [],
  };

  if (!cleanSym.endsWith('USDT')) {
    return {
      ...emptySnapshot,
      statusMessage: `ORDER FLOW DEPTH AVAILABLE FOR CRYPTO PAIRS OR WITH BOOKMAP API KEY (${cleanSym})`,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const [depthRes, tradesRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/depth?symbol=${cleanSym}&limit=25`, { signal: controller.signal }),
      fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${cleanSym}&limit=100`, { signal: controller.signal }),
    ]);
    clearTimeout(timer);

    if (!depthRes.ok || !tradesRes.ok) {
      return emptySnapshot;
    }

    const depth = await depthRes.json();
    const aggTrades = await tradesRes.json();

    const bids: Array<{ price: number; qty: number }> = (depth.bids || []).map((b: any) => ({
      price: parseFloat(b[0]),
      qty: parseFloat(b[1]),
    }));
    const asks: Array<{ price: number; qty: number }> = (depth.asks || []).map((a: any) => ({
      price: parseFloat(a[0]),
      qty: parseFloat(a[1]),
    }));

    if (bids.length === 0 || asks.length === 0) return emptySnapshot;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const spread = Number((bestAsk - bestBid).toFixed(6));

    const totalBidVol = bids.reduce((acc, b) => acc + b.qty, 0);
    const totalAskVol = asks.reduce((acc, a) => acc + a.qty, 0);
    const bidAskImbalance =
      totalBidVol + totalAskVol > 0
        ? Number(((totalBidVol - totalAskVol) / (totalBidVol + totalAskVol)).toFixed(4))
        : 0;

    // Median-based resting wall detection (avoids outliers masking walls)
    const sortedBids = [...bids].map(b => b.qty).sort((a, b) => a - b);
    const sortedAsks = [...asks].map(a => a.qty).sort((a, b) => a - b);
    const bidMedian = sortedBids[Math.floor(sortedBids.length / 2)] || 0;
    const askMedian = sortedAsks[Math.floor(sortedAsks.length / 2)] || 0;

    const bidWalls = bids
      .filter(b => bidMedian > 0 && b.qty >= bidMedian * 2.2)
      .slice(0, 5)
      .map(b => ({ price: b.price, qty: b.qty, notional: Number((b.price * b.qty).toFixed(2)) }));

    const askWalls = asks
      .filter(a => askMedian > 0 && a.qty >= askMedian * 2.2)
      .slice(0, 5)
      .map(a => ({ price: a.price, qty: a.qty, notional: Number((a.price * a.qty).toFixed(2)) }));

    let buyInflow = 0;
    let sellOutflow = 0;
    const tradeQtys: number[] = [];
    const recentTrades: Array<{ price: number; qty: number; side: 'BUY' | 'SELL'; time: number }> = [];

    if (Array.isArray(aggTrades)) {
      for (const t of aggTrades) {
        const price = parseFloat(t.p);
        const qty = parseFloat(t.q);
        const isBuyerMaker = Boolean(t.m); // true => seller hit bid (aggressive sell)
        const notional = price * qty;
        tradeQtys.push(qty);
        if (isBuyerMaker) {
          sellOutflow += notional;
        } else {
          buyInflow += notional;
        }
        recentTrades.push({
          price,
          qty,
          side: isBuyerMaker ? 'SELL' : 'BUY',
          time: Number(t.T),
        });
      }
    }

    const batchDelta = buyInflow - sellOutflow;
    const prevCvd = cvdSessionMap.get(cleanSym) || 0;
    const cumulativeDelta = Number((prevCvd * 0.7 + batchDelta).toFixed(2));
    cvdSessionMap.set(cleanSym, cumulativeDelta);

    const avgQty = tradeQtys.length > 0 ? tradeQtys.reduce((a, b) => a + b, 0) / tradeQtys.length : 0;
    const maxQty = tradeQtys.length > 0 ? Math.max(...tradeQtys) : 0;
    const volumeSpikeRatio = avgQty > 0 ? Number((maxQty / avgQty).toFixed(2)) : 1;
    const volumeSpike = volumeSpikeRatio >= 4.0;

    // Absorption logic: strong sell aggression absorbed by bid walls OR strong buy aggression absorbed by ask walls
    let absorptionDetected: OrderFlowSnapshot['absorptionDetected'] = 'NONE';
    if (sellOutflow > buyInflow * 1.25 && bidWalls.length > 0 && bidAskImbalance > 0.12) {
      absorptionDetected = 'BULLISH_ABSORPTION';
    } else if (buyInflow > sellOutflow * 1.25 && askWalls.length > 0 && bidAskImbalance < -0.12) {
      absorptionDetected = 'BEARISH_ABSORPTION';
    }

    let institutionalBias: OrderFlowSnapshot['institutionalBias'] = 'NEUTRAL';
    if (absorptionDetected === 'BULLISH_ABSORPTION' || (bidAskImbalance > 0.15 && batchDelta > 0)) {
      institutionalBias = 'BULLISH';
    } else if (absorptionDetected === 'BEARISH_ABSORPTION' || (bidAskImbalance < -0.15 && batchDelta < 0)) {
      institutionalBias = 'BEARISH';
    }

    return {
      symbol: cleanSym,
      isLive: true,
      source: process.env.BOOKMAP_API_KEY ? 'BINANCE + BOOKMAP_ADDON' : 'BINANCE_ORDERFLOW_L2',
      statusMessage: 'LIVE ORDER FLOW STREAM ACTIVE',
      timestamp: now,
      bestBid,
      bestAsk,
      spread,
      buyInflow: Number(buyInflow.toFixed(2)),
      sellOutflow: Number(sellOutflow.toFixed(2)),
      cumulativeDelta,
      bidAskImbalance,
      volumeSpike,
      volumeSpikeRatio,
      absorptionDetected,
      institutionalBias,
      bidWalls,
      askWalls,
      bids: bids.slice(0, 15),
      asks: asks.slice(0, 15),
      recentTrades: recentTrades.slice(-25).reverse(),
    };
  } catch (err) {
    recordAudit('ORDERFLOW', `Order flow fetch failed for ${cleanSym}: ${(err as Error).message}`, 'WARN');
    return emptySnapshot;
  }
}

app.get('/api/orderflow', async (req, res) => {
  const symbol = sanitizeSymbol(req.query.symbol, 'BTCUSDT');
  const snapshot = await fetchLiveOrderFlow(symbol);
  res.json(snapshot);
});

// --- 3. API: Real Financial News & Macro Event Calendar (Never Invents News) ---
interface NewsHeadline {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  eventRisk: 'HIGH' | 'MEDIUM' | 'LOW';
}

const HIGH_RISK_KEYWORDS = ['FOMC', 'CPI', 'NFP', 'FED', 'RATE HIKE', 'INFLATION', 'SEC', 'EXPLOIT', 'HACK', 'EARNINGS', 'GDP', 'POWELL', 'CRASH', 'TARIFF'];
const BULLISH_KEYWORDS = ['SURGE', 'RALLY', 'APPROVAL', 'ETF INFLOW', 'BREAKOUT', 'RECORD HIGH', 'ADOPTION', 'BEAT', 'UPGRADE'];
const BEARISH_KEYWORDS = ['DROP', 'SELL-OFF', 'OUTFLOW', 'DOWNGRADE', 'LAWSUIT', 'BAN', 'RECESSION', 'MISS', 'LIQUIDATION', 'PLUNGE'];

function classifyHeadline(title: string): { sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; eventRisk: 'HIGH' | 'MEDIUM' | 'LOW' } {
  const upper = title.toUpperCase();
  const isHighRisk = HIGH_RISK_KEYWORDS.some(k => upper.includes(k));
  const bullHits = BULLISH_KEYWORDS.filter(k => upper.includes(k)).length;
  const bearHits = BEARISH_KEYWORDS.filter(k => upper.includes(k)).length;
  const sentiment = bullHits > bearHits ? 'BULLISH' : bearHits > bullHits ? 'BEARISH' : 'NEUTRAL';
  return {
    sentiment,
    eventRisk: isHighRisk ? 'HIGH' : bullHits + bearHits > 0 ? 'MEDIUM' : 'LOW',
  };
}

app.get('/api/news', async (req, res) => {
  const symbol = sanitizeSymbol(req.query.symbol, 'BTCUSDT');
  const market = String(req.query.market || 'crypto').toLowerCase();

  try {
    const items: NewsHeadline[] = [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    if (market === 'crypto' || symbol.endsWith('USDT')) {
      const ccRes = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { signal: controller.signal });
      clearTimeout(timer);
      if (ccRes.ok) {
        const json = await ccRes.json();
        const rawList = Array.isArray(json?.Data) ? json.Data.slice(0, 12) : [];
        for (const row of rawList) {
          const title = String(row.title || '').trim();
          if (!title) continue;
          const { sentiment, eventRisk } = classifyHeadline(title);
          items.push({
            id: String(row.id || row.published_on),
            title,
            source: String(row.source_info?.name || row.source || 'CryptoCompare'),
            url: String(row.url || ''),
            publishedAt: Number(row.published_on || Math.floor(Date.now() / 1000)) * 1000,
            sentiment,
            eventRisk,
          });
        }
      }
    } else {
      const rssSymbol = market === 'forex' ? (symbol === 'XAUUSD' ? 'GC=F' : `${symbol}=X`) : symbol;
      const rssRes = await fetch(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(rssSymbol)}&region=US&lang=en-US`,
        { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      clearTimeout(timer);
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12);
        for (let idx = 0; idx < itemMatches.length; idx++) {
          const block = itemMatches[idx][1];
          const rawTitle = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1]
            || block.match(/<title>(.*?)<\/title>/)?.[1]
            || '';
          const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
          const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
          const title = rawTitle.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
          if (!title) continue;
          const { sentiment, eventRisk } = classifyHeadline(title);
          items.push({
            id: `YF-${idx}-${Date.now()}`,
            title,
            source: 'Yahoo Finance RSS',
            url: link,
            publishedAt: pubDate ? Date.parse(pubDate) || Date.now() : Date.now(),
            sentiment,
            eventRisk,
          });
        }
      }
    }

    const bullCount = items.filter(i => i.sentiment === 'BULLISH').length;
    const bearCount = items.filter(i => i.sentiment === 'BEARISH').length;
    const highRiskCount = items.filter(i => i.eventRisk === 'HIGH').length;
    const overallSentiment = bullCount > bearCount ? 'BULLISH' : bearCount > bullCount ? 'BEARISH' : 'NEUTRAL';

    return res.json({
      symbol,
      market,
      isLive: items.length > 0,
      statusMessage: items.length > 0 ? 'LIVE NEWS FEED ACTIVE' : 'LIVE NEWS FEED UNAVAILABLE',
      overallSentiment,
      highRiskWarning: highRiskCount > 0,
      highRiskCount,
      headlines: items,
    });
  } catch (err) {
    recordAudit('NEWS_FEED', `News fetch error for ${symbol}: ${(err as Error).message}`, 'WARN');
    return res.json({
      symbol,
      market,
      isLive: false,
      statusMessage: 'LIVE NEWS FEED UNAVAILABLE',
      overallSentiment: 'NEUTRAL',
      highRiskWarning: false,
      highRiskCount: 0,
      headlines: [],
    });
  }
});

// --- 4. API: Audit Logs & System Health ---
app.get('/api/audit-logs', (_req, res) => {
  res.json({
    paperTradingOnly: process.env.ALLOW_LIVE_TRADING !== 'true',
    bookmapConfigured: Boolean(process.env.BOOKMAP_API_KEY),
    pythonBackendConfigured: Boolean(PYTHON_BACKEND_URL),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    logs: auditLogs.slice(0, 60),
  });
});

// --- 5. API: Gemini AI Institutional Analyst & Manager Synthesis ---
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { symbol, market, timeframe, signal, userPrompt } = req.body || {};
    recordAudit('GEMINI_ANALYST', `AI explanation requested for ${symbol || 'BTCUSDT'} (${timeframe || '15m'})`);

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({
        analysis: `UMAR WITH TRADE Institutional Analyst:
Market: ${symbol || 'BTCUSDT'} (${String(market || 'CRYPTO').toUpperCase()})
Status: Deterministic Multi-Agent Briefing (GEMINI_API_KEY not configured on server).
Signal: ${signal?.direction || 'WAIT'} | Confluence: ${signal?.confidenceScore ?? 0}/100
Note: Confidence score measures structural confluence across SMC, ICT, CRT, HTF alignment, and Risk rules — it is NOT a win probability.`,
      });
    }

    const systemInstruction = `You are "UMAR WITH TRADE" Chief Institutional Quantitative Analyst & Manager Agent, expert in Smart Money Concepts (SMC), Inner Circle Trader (ICT), Candle Range Theory (CRT), and Order Flow.
STRICT RULES:
- Never invent or modify entry, stop loss, take profit prices, or risk percentages.
- Only explain the deterministic data provided.
- Explicitly note if the setup is WAIT due to conflicting HTF/LTF/OrderFlow signals.
- Never promise profits; remind that confluence score is NOT a win probability.`;

    const promptText = userPrompt
      ? `Trader Question: "${userPrompt}"
Context: Symbol ${symbol}, Market ${market}, Timeframe ${timeframe}, Direction: ${signal?.direction || 'WAIT'}, Score: ${signal?.confidenceScore || 0}/100, Entry: ${signal?.entryPrice}, Stop Loss: ${signal?.stopLoss}, TP1: ${signal?.tp1}, TP2: ${signal?.tp2}.
Provide a concise institutional answer.`
      : `Provide a crisp institutional trade thesis breakdown for ${symbol} (${timeframe}):
Direction: ${signal?.direction || 'WAIT'}
Confluence Score: ${signal?.confidenceScore || 0}/100 (Structural Confluence, NOT win probability)
Entry: ${signal?.entryPrice} | SL: ${signal?.stopLoss} | TP1: ${signal?.tp1} | TP2: ${signal?.tp2} | TP3: ${signal?.tp3}
R:R: 1:${signal?.riskRewardRatio || 0}
SMC: ${signal?.smcConfirmation}
ICT: ${signal?.ictConfirmation}
CRT: ${signal?.crtConfirmation}
Session: ${signal?.marketSession}
HTF Bias: ${signal?.higherTimeframeBias}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: { systemInstruction },
    });

    return res.json({ analysis: response.text || 'Institutional analysis compiled.' });
  } catch (err: any) {
    recordAudit('GEMINI_ANALYST', `Gemini error: ${err?.message || 'Unknown'}`, 'ERROR');
    return res.status(500).json({
      error: 'Failed to generate Gemini analysis',
      message: err?.message || 'Unknown error',
    });
  }
});

// --- Server + WebSocket Stream Boot ---
async function startServer() {
  const httpServer = http.createServer(app);

  // Live WebSocket Server for Order Flow & Market Streaming
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/terminal' });
  const clientSymbols = new Map<WebSocket, string>();

  wss.on('connection', (ws) => {
    clientSymbols.set(ws, 'BTCUSDT');
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'subscribe' && msg?.symbol) {
          clientSymbols.set(ws, sanitizeSymbol(msg.symbol, 'BTCUSDT'));
        }
      } catch {
        // Ignore malformed messages
      }
    });
    ws.on('close', () => {
      clientSymbols.delete(ws);
    });
  });

  // Periodic live order-flow push every 3 seconds to subscribed clients
  setInterval(async () => {
    if (wss.clients.size === 0) return;
    const uniqueSymbols = new Set<string>();
    clientSymbols.forEach((sym) => uniqueSymbols.add(sym));

    const snapshots = new Map<string, OrderFlowSnapshot>();
    await Promise.all(
      Array.from(uniqueSymbols).map(async (sym) => {
        snapshots.set(sym, await fetchLiveOrderFlow(sym));
      })
    );

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const sym = clientSymbols.get(client) || 'BTCUSDT';
        const snap = snapshots.get(sym);
        if (snap) {
          client.send(JSON.stringify({ type: 'orderflow', data: snap }));
        }
      }
    });
  }, 3000);

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        },
        appType: 'spa',
      })
    );

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`>>> UMAR WITH TRADE Terminal running on http://localhost:${PORT}`);
    });

    await vitePromise;
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`>>> UMAR WITH TRADE Terminal running on http://localhost:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start UMAR WITH TRADE server:', err);
  process.exit(1);
});
