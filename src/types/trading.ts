export type MarketType = 'crypto' | 'forex' | 'stock';

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface InstrumentInfo {
  symbol: string;
  name: string;
  market: MarketType;
  baseAsset: string;
  quoteAsset: string;
  precision: number;
  tickSize: number;
  contractSize: number;
  is24_7: boolean;
  spreadTypicalPips: number;
  description: string;
}

// SMC Data Structures
export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: 'high' | 'low';
  confirmed: boolean;
}

export interface StructureBreak {
  type: 'BOS' | 'CHoCH' | 'MSS';
  direction: 'bullish' | 'bearish';
  time: number;
  breakPrice: number;
  sourceSwing: SwingPoint;
  displacementScore: number; // 0 to 100
}

export interface OrderBlock {
  id: string;
  direction: 'bullish' | 'bearish';
  startIndex: number;
  startTime: number;
  high: number;
  low: number;
  mitigated: boolean;
  mitigationTime?: number;
  strength: number; // based on volume and impulse
  isBreaker?: boolean;
}

export interface FairValueGap {
  id: string;
  direction: 'bullish' | 'bearish';
  startIndex: number;
  startTime: number;
  top: number;
  bottom: number;
  consequentEncroachment: number; // 50% midpoint
  filled: boolean;
  fillPercentage: number;
  isInverse?: boolean;
}

export interface BalancedPriceRange {
  id: string;
  direction: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  midpoint: number;
  time: number;
  retested: boolean;
}

export interface LiquidityLevel {
  id: string;
  type: 'BSL' | 'SSL' | 'EQH' | 'EQL';
  price: number;
  time: number;
  swept: boolean;
  sweepTime?: number;
  touches: number;
}

export interface LiquiditySweep {
  time: number;
  levelPrice: number;
  levelType: 'BSL' | 'SSL';
  wickExtreme: number;
  closePrice: number;
  direction: 'bullish' | 'bearish'; // Bullish sweep = swept SSL then closed above; Bearish = swept BSL then closed below
}

export interface PremiumDiscount {
  swingHigh: number;
  swingLow: number;
  equilibrium: number; // 0.5
  oteStart: number; // 0.618
  oteSweetSpot: number; // 0.705
  oteEnd: number; // 0.786
  currentZone: 'Deep Discount' | 'Discount' | 'Equilibrium' | 'Premium' | 'Deep Premium';
}

// ICT Data Structures
export interface KillZoneInfo {
  name: 'Asian' | 'London Open' | 'New York Open' | 'London Close';
  isActive: boolean;
  nyTimeWindow: string;
  utcTimeWindow: string;
  description: string;
}

export interface SilverBulletSetup {
  detected: boolean;
  session: 'London (3-4 AM NY)' | 'NY AM (10-11 AM NY)' | 'NY PM (2-3 PM NY)';
  direction: 'bullish' | 'bearish';
  fvg: FairValueGap | null;
  targetPrice: number;
}

export interface JudasSwingSetup {
  detected: boolean;
  asianRangeHigh: number;
  asianRangeLow: number;
  manipulationType: 'bullish_trap' | 'bearish_trap';
  expectedReversal: 'bearish' | 'bullish';
}

export interface ICTModel2022Setup {
  detected: boolean;
  direction: 'bullish' | 'bearish';
  liquiditySweep: LiquiditySweep | null;
  mss: StructureBreak | null;
  fvg: FairValueGap | null;
  oteEntryRange: { min: number; max: number };
  targetLiquidity: number;
}

// CRT (Candle Range Theory) Data Structures
export interface CandleRange {
  time: number;
  crh: number; // Candle Range High
  crl: number; // Candle Range Low
  crm: number; // Candle Range Midpoint (50%)
  bodyHigh: number;
  bodyLow: number;
}

export interface CRTSetup {
  detected: boolean;
  type: 'Bullish CRT' | 'Bearish CRT' | 'Neutral CRT';
  motherCandle: CandleRange;
  sweepOccurred: boolean;
  rangeReclaimed: boolean;
  expansionTarget: number;
  stage: 'Inside Range' | 'Manipulation / Sweep' | 'Range Reclaimed' | 'Expansion Phase';
}

// Confluence & Signals
export type SignalDirection = 'STRONG BUY' | 'BUY' | 'SELL' | 'STRONG SELL' | 'WAIT';
export type SignalStatus = 'ACTIVE' | 'TP1 HIT' | 'TP2 HIT' | 'TP3 HIT' | 'STOP LOSS HIT' | 'EXPIRED' | 'CANCELLED';

export interface ConfluenceBreakdown {
  smcScore: number; // 0 - 25
  ictScore: number; // 0 - 25
  crtScore: number; // 0 - 20
  htfAlignmentScore: number; // 0 - 15
  riskValidationScore: number; // 0 - 15
  totalScore: number; // 0 - 100
  passedConditions: string[];
  failedConditions: string[];
}

export interface SignalCard {
  id: string;
  symbol: string;
  market: MarketType;
  direction: SignalDirection;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskRewardRatio: number;
  confidenceScore: number;
  status: SignalStatus;
  timeframe: Timeframe;
  analysisTimeframe?: Timeframe;
  entryTimeframe?: Timeframe;
  marketSession: string;
  higherTimeframeBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  smcConfirmation: string;
  ictConfirmation: string;
  crtConfirmation: string;
  orderflowConfirmation?: string;
  timestamp: number;
  expiryTimestamp: number;
  invalidationLevel: number;
  aiExplanation: string;
  breakdown: ConfluenceBreakdown;
  liveCurrentPrice?: number;
}

// Risk Management
export interface RiskSettings {
  accountBalance: number;
  riskPercentage: number; // 0.25 to 2.0%
  maxDailyLossPercentage: number;
  maxConsecutiveLosses: number;
  maxOpenPositions: number;
  dailyTradeLimit: number;
  minRiskReward: number; // default 2.0 (1:2)
  atrMultiplier: number; // default 1.5
  slippagePips: number;
  spreadFilterMaxPips: number;
}

export interface PositionCalculation {
  symbol: string;
  market: MarketType;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskAmountCurrency: number;
  riskReward: number;
  stopLossPipsOrTicks: number;
  positionSizeUnits: number;
  recommendedLots: number;
  estimatedMarginRequired: number;
  spreadCostEstimated: number;
  isCompliant: boolean;
  warnings: string[];
}

// Backtesting
export interface BacktestParams {
  symbol: string;
  market: MarketType;
  timeframe: Timeframe;
  lookbackCandles: number;
  riskPerTrade: number;
  spreadPips: number;
  slippagePips: number;
  commissionPerLot: number;
  minScoreThreshold: number;
}

export interface BacktestTrade {
  id: string;
  direction: 'BUY' | 'SELL';
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnlCurrency: number;
  pnlR: number;
  result: 'WIN_TP1' | 'WIN_TP2' | 'WIN_TP3' | 'LOSS_SL';
  durationCandles: number;
  setupType: string;
}

export interface BacktestResult {
  symbol: string;
  market: MarketType;
  timeframe: Timeframe;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // 0 - 100%
  profitFactor: number;
  maxDrawdownPercentage: number;
  averageRiskReward: number;
  totalPnLCurrency: number;
  longWinRate: number;
  shortWinRate: number;
  sessionPerformance: {
    asianPnL: number;
    londonPnL: number;
    newYorkPnL: number;
  };
  trades: BacktestTrade[];
  equityCurve: { time: number; equity: number }[];
}

// Market Ticker
export interface MarketTicker {
  symbol: string;
  name: string;
  market: MarketType;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  spread: number;
  fundingRate?: number;
  isMarketOpen: boolean;
  sessionName: string;
  isLiveFeed: boolean;
  lastUpdate: number;
}
