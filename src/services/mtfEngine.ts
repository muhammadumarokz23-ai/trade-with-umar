import {
  BalancedPriceRange,
  Candle,
  FairValueGap,
  InstrumentInfo,
  LiquiditySweep,
  OrderBlock,
  PremiumDiscount,
  StructureBreak,
  Timeframe,
} from '../types/trading';
import { SMCEngine } from './smcEngine';
import { MarketDataService, OrderFlowSnapshot } from './marketData';

export interface MTFPairSpec {
  analysisTf: Timeframe;
  entryTf: Timeframe;
  label: string;
}

export const EXACT_MTF_PAIRS: MTFPairSpec[] = [
  { analysisTf: '1w', entryTf: '4h', label: '1W Analysis -> 4H Entry' },
  { analysisTf: '1d', entryTf: '1h', label: '1D Analysis -> 1H Entry' },
  { analysisTf: '4h', entryTf: '15m', label: '4H Analysis -> 15M Entry' },
  { analysisTf: '1h', entryTf: '5m', label: '1H Analysis -> 5M Entry' },
];

export function getMappedEntryTimeframe(analysisTf: Timeframe): Timeframe {
  switch (analysisTf) {
    case '1w': return '4h';
    case '1d': return '1h';
    case '4h': return '15m';
    case '1h': return '5m';
    default: return '15m';
  }
}

export function getMappedAnalysisTimeframe(entryTf: Timeframe): Timeframe {
  switch (entryTf) {
    case '4h': return '1w';
    case '1h': return '1d';
    case '15m': return '4h';
    case '5m': return '1h';
    default: return '4h';
  }
}

export interface MTFPairEvaluation {
  analysisTf: Timeframe;
  entryTf: Timeframe;
  isLiveFeed: boolean;
  htfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  priceInHtfZone: boolean;
  htfZoneLabel: string;
  ltfSweepConfirmed: boolean;
  ltfChochOrMssConfirmed: boolean;
  ltfRetestConfirmed: boolean;
  orderflowAligned: boolean;
  entryAllowed: boolean;
  verdict: 'BUY' | 'SELL' | 'WAIT';
  reason: string;
  htfOrderBlocks: OrderBlock[];
  htfFvgs: FairValueGap[];
  htfBprs: BalancedPriceRange[];
  htfSweeps: LiquiditySweep[];
  htfBreaks: StructureBreak[];
  htfPremiumDiscount: PremiumDiscount | null;
  currentPrice: number;
}

export class MTFEngine {
  /**
   * Evaluate a single exact HTF -> LTF pair on confirmed closed candles only.
   * Entry is allowed ONLY when:
   *  1) Price is inside an aligned HTF zone (OB, FVG, or BPR) matching HTF bias
   *  2) Mapped entry timeframe shows Liquidity Sweep + CHoCH/MSS + FVG/OB retest
   *  3) Live order flow does not conflict (if available)
   */
  static async evaluatePair(
    instrument: InstrumentInfo,
    analysisTf: Timeframe,
    orderFlow?: OrderFlowSnapshot | null
  ): Promise<MTFPairEvaluation> {
    const entryTf = getMappedEntryTimeframe(analysisTf);
    const [htfRes, ltfRes] = await Promise.all([
      MarketDataService.fetchCandles(instrument.symbol, instrument.market, analysisTf, 100),
      MarketDataService.fetchCandles(instrument.symbol, instrument.market, entryTf, 100),
    ]);

    if (!htfRes.isLiveFeed || !ltfRes.isLiveFeed || htfRes.candles.length < 15 || ltfRes.candles.length < 15) {
      return {
        analysisTf,
        entryTf,
        isLiveFeed: false,
        htfBias: 'NEUTRAL',
        priceInHtfZone: false,
        htfZoneLabel: 'No Live Feed',
        ltfSweepConfirmed: false,
        ltfChochOrMssConfirmed: false,
        ltfRetestConfirmed: false,
        orderflowAligned: false,
        entryAllowed: false,
        verdict: 'WAIT',
        reason: 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE. No live signals generated.',
        htfOrderBlocks: [],
        htfFvgs: [],
        htfBprs: [],
        htfSweeps: [],
        htfBreaks: [],
        htfPremiumDiscount: null,
        currentPrice: 0,
      };
    }

    // Confirmed closed candles only (zero repainting / zero look-ahead bias)
    const htfConfirmed = SMCEngine.confirmedOnly(htfRes.candles);
    const ltfConfirmed = SMCEngine.confirmedOnly(ltfRes.candles);
    const currentPrice = ltfConfirmed[ltfConfirmed.length - 1].close;

    // HTF SMC analysis
    const htfSwings = SMCEngine.findSwingPoints(htfConfirmed, 2);
    const htfBreaks = SMCEngine.detectStructureBreaks(htfConfirmed, htfSwings);
    const htfOrderBlocks = SMCEngine.findOrderBlocks(htfConfirmed, htfBreaks);
    const htfFvgs = SMCEngine.findFairValueGaps(htfConfirmed);
    const htfBprs = SMCEngine.findBPR(htfFvgs, htfConfirmed);
    const htfPools = SMCEngine.findLiquidityPools(htfSwings);
    const htfSweeps = SMCEngine.detectLiquiditySweeps(htfConfirmed, htfPools);
    const htfPD = SMCEngine.calculatePremiumDiscount(htfConfirmed, htfSwings);

    const latestHtfBreak = htfBreaks[htfBreaks.length - 1];
    let htfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (latestHtfBreak) {
      htfBias = latestHtfBreak.direction === 'bullish' ? 'BULLISH' : 'BEARISH';
    } else if (htfConfirmed.length >= 20) {
      const emaFast = htfConfirmed.slice(-10).reduce((s, c) => s + c.close, 0) / 10;
      const emaSlow = htfConfirmed.slice(-20).reduce((s, c) => s + c.close, 0) / 20;
      htfBias = emaFast > emaSlow ? 'BULLISH' : emaFast < emaSlow ? 'BEARISH' : 'NEUTRAL';
    }

    const desiredDir = htfBias === 'BULLISH' ? 'bullish' : htfBias === 'BEARISH' ? 'bearish' : null;

    // Check if current price sits inside (or within 0.35% proximity of) an unmitigated HTF OB, FVG, or BPR aligned with HTF bias
    let priceInHtfZone = false;
    let htfZoneLabel = 'Outside HTF PD Array';
    if (desiredDir) {
      const tol = currentPrice * 0.0035;
      const matchedOb = htfOrderBlocks.find(
        o => !o.mitigated && o.direction === desiredDir && currentPrice >= o.low - tol && currentPrice <= o.high + tol
      );
      const matchedFvg = htfFvgs.find(
        f => !f.filled && f.direction === desiredDir && currentPrice >= f.bottom - tol && currentPrice <= f.top + tol
      );
      const matchedBpr = htfBprs.find(
        b => b.direction === desiredDir && currentPrice >= b.bottom - tol && currentPrice <= b.top + tol
      );

      if (matchedBpr) {
        priceInHtfZone = true;
        htfZoneLabel = `${analysisTf.toUpperCase()} ${desiredDir.toUpperCase()} BPR`;
      } else if (matchedOb) {
        priceInHtfZone = true;
        htfZoneLabel = `${analysisTf.toUpperCase()} ${desiredDir.toUpperCase()} OB`;
      } else if (matchedFvg) {
        priceInHtfZone = true;
        htfZoneLabel = `${analysisTf.toUpperCase()} ${desiredDir.toUpperCase()} FVG`;
      }
    }

    // LTF Entry TF checks: sweep + CHoCH/MSS + OB/FVG retest
    const ltfSwings = SMCEngine.findSwingPoints(ltfConfirmed, 2);
    const ltfBreaks = SMCEngine.detectStructureBreaks(ltfConfirmed, ltfSwings);
    const ltfOrderBlocks = SMCEngine.findOrderBlocks(ltfConfirmed, ltfBreaks);
    const ltfFvgs = SMCEngine.findFairValueGaps(ltfConfirmed);
    const ltfPools = SMCEngine.findLiquidityPools(ltfSwings);
    const ltfSweeps = SMCEngine.detectLiquiditySweeps(ltfConfirmed, ltfPools);

    const recentLtfWindow = ltfConfirmed.slice(-24);
    const minWindowTime = recentLtfWindow[0]?.time || 0;

    const ltfSweepConfirmed = Boolean(
      desiredDir && ltfSweeps.some(s => s.direction === desiredDir && s.time >= minWindowTime)
    );
    const ltfChochOrMssConfirmed = Boolean(
      desiredDir &&
        ltfBreaks.some(b => (b.type === 'CHoCH' || b.type === 'MSS') && b.direction === desiredDir && b.time >= minWindowTime)
    );
    const ltfRetestConfirmed = Boolean(
      desiredDir &&
        (ltfFvgs.some(f => !f.filled && f.direction === desiredDir && Math.abs(currentPrice - f.consequentEncroachment) / currentPrice <= 0.005) ||
          ltfOrderBlocks.some(o => !o.mitigated && o.direction === desiredDir && currentPrice >= o.low * 0.996 && currentPrice <= o.high * 1.004))
    );

    const orderflowAligned =
      !orderFlow ||
      !orderFlow.isLive ||
      orderFlow.institutionalBias === 'NEUTRAL' ||
      orderFlow.institutionalBias === htfBias;

    const entryAllowed =
      htfBias !== 'NEUTRAL' &&
      priceInHtfZone &&
      ltfSweepConfirmed &&
      ltfChochOrMssConfirmed &&
      ltfRetestConfirmed &&
      orderflowAligned;

    let verdict: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    if (entryAllowed) {
      verdict = htfBias === 'BULLISH' ? 'BUY' : 'SELL';
    }

    const reasons: string[] = [];
    if (!priceInHtfZone) reasons.push(`Price not inside aligned ${analysisTf.toUpperCase()} OB/FVG/BPR`);
    if (!ltfSweepConfirmed) reasons.push(`Awaiting ${entryTf.toUpperCase()} liquidity sweep`);
    if (!ltfChochOrMssConfirmed) reasons.push(`Awaiting ${entryTf.toUpperCase()} CHoCH/MSS`);
    if (!ltfRetestConfirmed) reasons.push(`Awaiting ${entryTf.toUpperCase()} FVG/OB retest`);
    if (!orderflowAligned) reasons.push(`Order flow (${orderFlow?.institutionalBias}) conflicts with ${htfBias}`);

    return {
      analysisTf,
      entryTf,
      isLiveFeed: true,
      htfBias,
      priceInHtfZone,
      htfZoneLabel,
      ltfSweepConfirmed,
      ltfChochOrMssConfirmed,
      ltfRetestConfirmed,
      orderflowAligned,
      entryAllowed,
      verdict,
      reason: entryAllowed
        ? `Aligned ${analysisTf.toUpperCase()} -> ${entryTf.toUpperCase()} institutional entry triggered (${htfZoneLabel})`
        : `WAIT: ${reasons.join('; ')}`,
      htfOrderBlocks,
      htfFvgs,
      htfBprs,
      htfSweeps,
      htfBreaks,
      htfPremiumDiscount: htfPD,
      currentPrice,
    };
  }

  static async evaluateAllPairs(
    instrument: InstrumentInfo,
    orderFlow?: OrderFlowSnapshot | null
  ): Promise<MTFPairEvaluation[]> {
    return Promise.all(
      EXACT_MTF_PAIRS.map(spec => this.evaluatePair(instrument, spec.analysisTf, orderFlow))
    );
  }
}
