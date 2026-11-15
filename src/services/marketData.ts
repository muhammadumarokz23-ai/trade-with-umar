import { Candle, MarketTicker, MarketType, Timeframe } from '../types/trading';
import { SUPPORTED_INSTRUMENTS } from './instruments';

export interface CandleResponse {
  symbol: string;
  market: MarketType;
  timeframe: Timeframe;
  isLiveFeed: boolean;
  demoMode: boolean;
  source?: string;
  statusMessage: string;
  candles: Candle[];
}

export interface OrderFlowSnapshot {
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
  bidAskImbalance: number;
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

export interface NewsHeadline {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  eventRisk: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface NewsFeedResponse {
  symbol: string;
  market: MarketType;
  isLive: boolean;
  statusMessage: string;
  overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  highRiskWarning: boolean;
  highRiskCount: number;
  headlines: NewsHeadline[];
}

export class MarketDataService {
  /**
   * Fetch multi-market candle data from backend.
   * Never fabricates or synthesizes random prices if live data is unavailable.
   */
  static async fetchCandles(
    symbol: string,
    market: MarketType,
    timeframe: Timeframe = '15m',
    limit = 120
  ): Promise<CandleResponse> {
    try {
      const url = `/api/market/candles?symbol=${encodeURIComponent(symbol)}&market=${market}&timeframe=${timeframe}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data: CandleResponse = await res.json();
      return data;
    } catch {
      return {
        symbol,
        market,
        timeframe,
        isLiveFeed: false,
        demoMode: true,
        source: 'OFFLINE',
        statusMessage: 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE',
        candles: [],
      };
    }
  }

  /**
   * Fetch live L2 order flow (Binance depth + aggTrade / Bookmap)
   */
  static async fetchOrderFlow(symbol: string): Promise<OrderFlowSnapshot> {
    try {
      const res = await fetch(`/api/orderflow?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        symbol,
        isLive: false,
        source: 'OFFLINE',
        statusMessage: 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE',
        timestamp: Date.now(),
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
    }
  }

  /**
   * Fetch real financial headlines & economic event warnings
   */
  static async fetchNews(symbol: string, market: MarketType): Promise<NewsFeedResponse> {
    try {
      const res = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}&market=${market}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        symbol,
        market,
        isLive: false,
        statusMessage: 'LIVE NEWS FEED UNAVAILABLE',
        overallSentiment: 'NEUTRAL',
        highRiskWarning: false,
        highRiskCount: 0,
        headlines: [],
      };
    }
  }

  /**
   * Fetch active tickers for market (zero fake numbers when offline)
   */
  static async fetchTickers(): Promise<MarketTicker[]> {
    const tickers: MarketTicker[] = [];
    const now = Date.now();

    await Promise.all(
      SUPPORTED_INSTRUMENTS.map(async (inst) => {
        const sampleCandles = await this.fetchCandles(inst.symbol, inst.market, '15m', 2);
        const hasLive = sampleCandles.isLiveFeed && sampleCandles.candles.length > 0;
        const lastCandle = hasLive ? sampleCandles.candles[sampleCandles.candles.length - 1] : null;
        const prevCandle = hasLive ? sampleCandles.candles[0] : null;

        const price = lastCandle ? lastCandle.close : 0;
        const change24h =
          lastCandle && prevCandle && prevCandle.open > 0
            ? Number((((lastCandle.close - prevCandle.open) / prevCandle.open) * 100).toFixed(2))
            : 0;
        const spread = inst.spreadTypicalPips * (inst.tickSize || 0.01);

        tickers.push({
          symbol: inst.symbol,
          name: inst.name,
          market: inst.market,
          price,
          change24h,
          high24h: lastCandle && prevCandle ? Math.max(lastCandle.high, prevCandle.high) : 0,
          low24h: lastCandle && prevCandle ? Math.min(lastCandle.low, prevCandle.low) : 0,
          volume24h: lastCandle ? Math.round(lastCandle.volume * 24) : 0,
          bid: price > 0 ? Number((price - spread / 2).toFixed(inst.precision)) : 0,
          ask: price > 0 ? Number((price + spread / 2).toFixed(inst.precision)) : 0,
          spread: inst.spreadTypicalPips,
          fundingRate: inst.market === 'crypto' && hasLive ? 0.01 : undefined,
          isMarketOpen: inst.is24_7 || this.checkMarketOpen(inst.market),
          sessionName: this.getCurrentSessionName(),
          isLiveFeed: hasLive,
          lastUpdate: now,
        });
      })
    );

    return tickers;
  }

  static checkMarketOpen(market: MarketType): boolean {
    if (market === 'crypto') return true;
    const date = new Date();
    const day = date.getUTCDay();
    if (market === 'forex') {
      if (day === 6) return false;
      if (day === 0 && date.getUTCHours() < 21) return false;
      return true;
    }
    if (market === 'stock') {
      if (day === 0 || day === 6) return false;
      const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
      return hour >= 13.5 && hour <= 20.0;
    }
    return true;
  }

  private static getCurrentSessionName(): string {
    const utcHours = new Date().getUTCHours();
    if (utcHours >= 1 && utcHours <= 5) return 'Tokyo / Asian Session';
    if (utcHours >= 7 && utcHours <= 11) return 'London Open Kill Zone';
    if (utcHours >= 12 && utcHours <= 16) return 'New York Open Kill Zone';
    return 'Inter-Market Liquidity';
  }
}
