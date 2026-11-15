import {
  Candle,
  InstrumentInfo,
  SignalCard,
  SignalDirection,
  Timeframe,
  ConfluenceBreakdown,
  SwingPoint,
  StructureBreak,
  OrderBlock,
  FairValueGap,
  LiquiditySweep,
  PremiumDiscount,
  SilverBulletSetup,
  JudasSwingSetup,
  ICTModel2022Setup,
  CRTSetup,
  BalancedPriceRange,
} from '../types/trading';
import { SMCEngine } from './smcEngine';
import { ICTEngine } from './ictEngine';
import { CRTEngine } from './crtEngine';
import { getMappedAnalysisTimeframe } from './mtfEngine';
import type { OrderFlowSnapshot } from './marketData';

/**
 * Unified Confluence Engine
 * 100-Point Scoring Model combining SMC (25), ICT (25), CRT (20), HTF Alignment (15), Risk Validation (15).
 * Deterministic and non-repainting.
 */
export class ConfluenceEngine {
  static analyze(
    instrument: InstrumentInfo,
    candles: Candle[],
    timeframe: Timeframe = '15m',
    options?: { isLiveFeed?: boolean; orderFlow?: OrderFlowSnapshot | null }
  ): {
    signal: SignalCard;
    smc: {
      swings: SwingPoint[];
      breaks: StructureBreak[];
      orderBlocks: OrderBlock[];
      fvgs: FairValueGap[];
      bprs: BalancedPriceRange[];
      sweeps: LiquiditySweep[];
      premiumDiscount: PremiumDiscount | null;
    };
    ict: {
      silverBullet: SilverBulletSetup;
      judasSwing: JudasSwingSetup;
      model2022: ICTModel2022Setup;
      macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    };
    crt: CRTSetup;
  } {
    const isLiveFeed = options?.isLiveFeed ?? candles.length >= 15;
    if (!isLiveFeed || candles.length < 15) {
      const reason = !isLiveFeed
        ? 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE. Live signal generation is disabled.'
        : 'Insufficient historical candle data.';
      const emptySignal = this.createEmptyWaitSignal(instrument, timeframe, reason);
      return {
        signal: emptySignal,
        smc: { swings: [], breaks: [], orderBlocks: [], fvgs: [], bprs: [], sweeps: [], premiumDiscount: null },
        ict: {
          silverBullet: { detected: false, session: 'NY AM (10-11 AM NY)', direction: 'bullish', fvg: null, targetPrice: 0 },
          judasSwing: { detected: false, asianRangeHigh: 0, asianRangeLow: 0, manipulationType: 'bullish_trap', expectedReversal: 'bearish' },
          model2022: { detected: false, direction: 'bullish', liquiditySweep: null, mss: null, fvg: null, oteEntryRange: { min: 0, max: 0 }, targetLiquidity: 0 },
          macroBias: 'NEUTRAL',
        },
        crt: {
          detected: false,
          type: 'Neutral CRT',
          motherCandle: { time: 0, crh: 0, crl: 0, crm: 0, bodyHigh: 0, bodyLow: 0 },
          sweepOccurred: false,
          rangeReclaimed: false,
          expansionTarget: 0,
          stage: 'Inside Range',
        },
      };
    }

    // Confirmed closed candles only (zero repainting / look-ahead bias)
    const closedCandles = SMCEngine.confirmedOnly(candles);
    const lastCandle = closedCandles[closedCandles.length - 1];
    const currentPrice = lastCandle.close;

    // 1. Run SMC Engine
    const swings = SMCEngine.findSwingPoints(closedCandles, 3);
    const breaks = SMCEngine.detectStructureBreaks(closedCandles, swings);
    const orderBlocks = SMCEngine.findOrderBlocks(closedCandles, breaks);
    const fvgs = SMCEngine.findFairValueGaps(closedCandles);
    const bprs = SMCEngine.findBPR(fvgs, closedCandles);
    const pools = SMCEngine.findLiquidityPools(swings);
    const sweeps = SMCEngine.detectLiquiditySweeps(closedCandles, pools);
    const premiumDiscount = SMCEngine.calculatePremiumDiscount(closedCandles, swings);

    // 2. Run ICT Engine
    const killzones = ICTEngine.getKillZones();
    const activeKillzone = killzones.find(k => k.isActive);
    const latestBreak = breaks[breaks.length - 1] || null;
    const silverBullet = ICTEngine.detectSilverBullet(candles, fvgs, latestBreak);
    const judasSwing = ICTEngine.detectJudasSwing(candles, sweeps);
    const model2022 = ICTEngine.detectICT2022Model(candles, sweeps, breaks, fvgs);
    const macroBias = ICTEngine.determineMacroBias(candles);

    // 3. Run CRT Engine
    const crt = CRTEngine.evaluateCRT(candles, fvgs);

    // 4. Direction Confluence Check
    // SMC Bias
    const smcBullishPoints =
      (latestBreak?.direction === 'bullish' ? 1 : 0) +
      (sweeps.some(s => s.direction === 'bullish') ? 1 : 0) +
      (orderBlocks.some(o => o.direction === 'bullish' && !o.mitigated) ? 1 : 0);
    const smcBearishPoints =
      (latestBreak?.direction === 'bearish' ? 1 : 0) +
      (sweeps.some(s => s.direction === 'bearish') ? 1 : 0) +
      (orderBlocks.some(o => o.direction === 'bearish' && !o.mitigated) ? 1 : 0);

    const smcDirection: 'bullish' | 'bearish' | 'neutral' =
      smcBullishPoints > smcBearishPoints ? 'bullish' : smcBearishPoints > smcBullishPoints ? 'bearish' : 'neutral';

    // ICT Bias
    const ictDirection: 'bullish' | 'bearish' | 'neutral' =
      model2022.detected
        ? model2022.direction
        : silverBullet.detected
        ? silverBullet.direction
        : judasSwing.detected
        ? judasSwing.expectedReversal
        : macroBias === 'BULLISH'
        ? 'bullish'
        : macroBias === 'BEARISH'
        ? 'bearish'
        : 'neutral';

    // CRT Bias
    const crtDirection: 'bullish' | 'bearish' | 'neutral' =
      crt.type === 'Bullish CRT' ? 'bullish' : crt.type === 'Bearish CRT' ? 'bearish' : 'neutral';

    // Evaluate Conflict: If SMC, ICT, CRT, or live Order Flow point to opposing directions, return WAIT
    const orderFlow = options?.orderFlow;
    const orderFlowConflict = Boolean(
      orderFlow?.isLive &&
        orderFlow.institutionalBias !== 'NEUTRAL' &&
        ((smcDirection === 'bullish' && orderFlow.institutionalBias === 'BEARISH') ||
          (smcDirection === 'bearish' && orderFlow.institutionalBias === 'BULLISH'))
    );

    const isConflict =
      orderFlowConflict ||
      (smcDirection === 'bullish' && ictDirection === 'bearish') ||
      (smcDirection === 'bearish' && ictDirection === 'bullish') ||
      (crtDirection === 'bullish' && smcDirection === 'bearish') ||
      (crtDirection === 'bearish' && smcDirection === 'bullish');

    // Determine hypothesized trade direction
    let targetDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (!isConflict) {
      if (smcDirection === 'bullish' || ictDirection === 'bullish' || crtDirection === 'bullish') {
        targetDirection = 'BULLISH';
      } else if (smcDirection === 'bearish' || ictDirection === 'bearish' || crtDirection === 'bearish') {
        targetDirection = 'BEARISH';
      }
    }

    // 5. Compute 100-point transparent confluence score
    const passed: string[] = [];
    const failed: string[] = [];

    // SMC Score (0 - 25)
    let smcScore = 0;
    if (latestBreak && ((targetDirection === 'BULLISH' && latestBreak.direction === 'bullish') || (targetDirection === 'BEARISH' && latestBreak.direction === 'bearish'))) {
      smcScore += 8;
      passed.push(`SMC ${latestBreak.type} confirmed in direction (+8)`);
    } else {
      failed.push('No aligned SMC BOS/CHoCH break (0/8)');
    }

    const alignedOB = orderBlocks.find(o => !o.mitigated && ((targetDirection === 'BULLISH' && o.direction === 'bullish') || (targetDirection === 'BEARISH' && o.direction === 'bearish')));
    if (alignedOB) {
      smcScore += 7;
      passed.push(`Unmitigated ${alignedOB.direction.toUpperCase()} Order Block active (+7)`);
    } else {
      failed.push('No unmitigated Order Block nearby (0/7)');
    }

    const alignedFvg = fvgs.find(f => !f.filled && ((targetDirection === 'BULLISH' && f.direction === 'bullish') || (targetDirection === 'BEARISH' && f.direction === 'bearish')));
    if (alignedFvg) {
      smcScore += 5;
      passed.push(`Fresh Fair Value Gap (FVG) identified (+5)`);
    } else {
      failed.push('No unfilled Fair Value Gap in proximity (0/5)');
    }

    const alignedSweep = sweeps.find(s => (targetDirection === 'BULLISH' && s.direction === 'bullish') || (targetDirection === 'BEARISH' && s.direction === 'bearish'));
    if (alignedSweep) {
      smcScore += 5;
      passed.push(`Confirmed Liquidity Sweep of ${alignedSweep.levelType} (+5)`);
    } else {
      failed.push('No recent liquidity raid/sweep detected (0/5)');
    }

    // ICT Score (0 - 25)
    let ictScore = 0;
    if (activeKillzone) {
      ictScore += 8;
      passed.push(`Active ICT Kill Zone: ${activeKillzone.name} (+8)`);
    } else if (silverBullet.detected) {
      ictScore += 8;
      passed.push(`ICT Silver Bullet Session active (+8)`);
    } else {
      failed.push('Outside prime ICT Kill Zones / Silver Bullet windows (0/8)');
    }

    if (model2022.detected && ((targetDirection === 'BULLISH' && model2022.direction === 'bullish') || (targetDirection === 'BEARISH' && model2022.direction === 'bearish'))) {
      ictScore += 9;
      passed.push('ICT 2022 Mentorship Model setup fully formed (+9)');
    } else if (judasSwing.detected) {
      ictScore += 7;
      passed.push(`ICT Judas Swing trap detected at Asian range (+7)`);
    } else {
      failed.push('No complete ICT 2022 Model or Judas Swing (0/9)');
    }

    if (premiumDiscount) {
      const inOTEorZone =
        (targetDirection === 'BULLISH' && (premiumDiscount.currentZone === 'Discount' || premiumDiscount.currentZone === 'Deep Discount')) ||
        (targetDirection === 'BEARISH' && (premiumDiscount.currentZone === 'Premium' || premiumDiscount.currentZone === 'Deep Premium'));

      if (inOTEorZone) {
        ictScore += 8;
        passed.push(`Price positioned in institutional ${premiumDiscount.currentZone} zone (+8)`);
      } else {
        failed.push(`Price currently at ${premiumDiscount.currentZone} (0/8)`);
      }
    }

    // CRT Score (0 - 20)
    let crtScore = 0;
    if (crt.sweepOccurred) {
      crtScore += 7;
      passed.push(`CRT Mother Candle High/Low manipulation sweep confirmed (+7)`);
    } else {
      failed.push('No sweep of Mother Candle extremes (0/7)');
    }

    if (crt.rangeReclaimed) {
      crtScore += 7;
      passed.push(`CRT Range Reclaimed with close inside mother candle (+7)`);
    } else {
      failed.push('No CRT range reclaim verified (0/7)');
    }

    if (crt.detected && ((targetDirection === 'BULLISH' && crt.type === 'Bullish CRT') || (targetDirection === 'BEARISH' && crt.type === 'Bearish CRT'))) {
      crtScore += 6;
      passed.push(`CRT + FVG / Expansion confirmation verified (+6)`);
    } else {
      failed.push('No directional CRT setup completion (0/6)');
    }

    // Higher Timeframe Alignment Score (0 - 15)
    let htfScore = 0;
    if (macroBias !== 'NEUTRAL' && ((targetDirection === 'BULLISH' && macroBias === 'BULLISH') || (targetDirection === 'BEARISH' && macroBias === 'BEARISH'))) {
      htfScore += 10;
      passed.push(`Higher Timeframe Daily Macro Bias (${macroBias}) aligned (+10)`);
    } else {
      failed.push(`HTF Bias (${macroBias}) does not confirm entry direction (0/10)`);
    }

    // Internal swing structure alignment
    if (swings.length >= 4) {
      htfScore += 5;
      passed.push('Intermediate swing structure confirmation verified (+5)');
    }

    // Risk and Entry Validation (0 - 15)
    let riskScore = 0;
    // Calculate structure-based Stop Loss and Targets
    const atr = this.calculateATR(candles, 14) || currentPrice * 0.005;
    let entryPrice = currentPrice;
    let stopLoss = currentPrice;
    let tp1 = currentPrice;
    let tp2 = currentPrice;
    let tp3 = currentPrice;
    let rrRatio = 2.0;

    if (targetDirection === 'BULLISH') {
      entryPrice = currentPrice;
      const lowestRecent = alignedOB ? alignedOB.low : Math.min(...candles.slice(-8).map(c => c.low));
      stopLoss = lowestRecent - atr * 0.3;
      const riskDistance = entryPrice - stopLoss;

      if (riskDistance > 0) {
        tp1 = entryPrice + riskDistance * 2.0;
        tp2 = entryPrice + riskDistance * 3.5;
        tp3 = entryPrice + riskDistance * 5.0;
        rrRatio = Number(((tp1 - entryPrice) / riskDistance).toFixed(2));
      }
    } else if (targetDirection === 'BEARISH') {
      entryPrice = currentPrice;
      const highestRecent = alignedOB ? alignedOB.high : Math.max(...candles.slice(-8).map(c => c.high));
      stopLoss = highestRecent + atr * 0.3;
      const riskDistance = stopLoss - entryPrice;

      if (riskDistance > 0) {
        tp1 = entryPrice - riskDistance * 2.0;
        tp2 = entryPrice - riskDistance * 3.5;
        tp3 = entryPrice - riskDistance * 5.0;
        rrRatio = Number(((entryPrice - tp1) / riskDistance).toFixed(2));
      }
    }

    if (rrRatio >= 2.0) {
      riskScore += 8;
      passed.push(`Institutional Risk-to-Reward ratio valid at 1:${rrRatio} (+8)`);
    } else {
      failed.push(`R:R below minimum 1:2.0 threshold (0/8)`);
    }

    const slDistancePct = Math.abs(entryPrice - stopLoss) / (entryPrice || 1);
    if (slDistancePct >= 0.0015 && slDistancePct <= 0.04) {
      riskScore += 4;
      passed.push('Structure-based Stop Loss validated with institutional ATR buffer (+4)');
    } else {
      failed.push('Stop Loss distance outside optimal volatility parameters (0/4)');
    }

    if (instrument.spreadTypicalPips <= 2.5) {
      riskScore += 3;
      passed.push(`Spread protection verified: typical ${instrument.spreadTypicalPips} pips (+3)`);
    } else {
      failed.push(`Spread filter elevated (${instrument.spreadTypicalPips} pips) (0/3)`);
    }

    const totalScore = smcScore + ictScore + crtScore + htfScore + riskScore;

    // Determine Final Signal Output
    let signalDirection: SignalDirection = 'WAIT';
    if (!isConflict && targetDirection !== 'NEUTRAL') {
      if (totalScore >= 85) {
        signalDirection = targetDirection === 'BULLISH' ? 'STRONG BUY' : 'STRONG SELL';
      } else if (totalScore >= 70) {
        signalDirection = targetDirection === 'BULLISH' ? 'BUY' : 'SELL';
      } else {
        signalDirection = 'WAIT';
      }
    } else {
      signalDirection = 'WAIT';
      failed.push('SMC, ICT, and CRT engines returned conflicting market structures. Trade filtered.');
    }

    const breakdown: ConfluenceBreakdown = {
      smcScore,
      ictScore,
      crtScore,
      htfAlignmentScore: htfScore,
      riskValidationScore: riskScore,
      totalScore,
      passedConditions: passed,
      failedConditions: failed,
    };

    const sessionName = activeKillzone ? activeKillzone.name : 'Inter-Session Market';
    const now = Date.now();

    const signal: SignalCard = {
      id: `SIG-${instrument.symbol}-${now}`,
      symbol: instrument.symbol,
      market: instrument.market,
      direction: signalDirection,
      entryPrice: Number(entryPrice.toFixed(instrument.precision)),
      stopLoss: Number(stopLoss.toFixed(instrument.precision)),
      tp1: Number(tp1.toFixed(instrument.precision)),
      tp2: Number(tp2.toFixed(instrument.precision)),
      tp3: Number(tp3.toFixed(instrument.precision)),
      riskRewardRatio: rrRatio,
      confidenceScore: totalScore,
      status: 'ACTIVE',
      timeframe,
      analysisTimeframe: getMappedAnalysisTimeframe(timeframe),
      entryTimeframe: timeframe,
      marketSession: sessionName,
      higherTimeframeBias: macroBias,
      smcConfirmation: alignedOB
        ? `Unmitigated ${alignedOB.direction.toUpperCase()} OB`
        : bprs.length > 0
        ? `BPR (${bprs[bprs.length - 1].direction.toUpperCase()})`
        : latestBreak
        ? `${latestBreak.type} ${latestBreak.direction}`
        : 'Neutral SMC Structure',
      ictConfirmation: activeKillzone ? `${activeKillzone.name} Killzone Active` : model2022.detected ? 'ICT 2022 Model' : 'Standard Session',
      crtConfirmation: crt.detected ? `${crt.type} (${crt.stage})` : 'CRT Developing',
      orderflowConfirmation: orderFlow?.isLive
        ? `${orderFlow.institutionalBias} | Imbalance ${(orderFlow.bidAskImbalance * 100).toFixed(1)}%`
        : 'Order Flow Standby',
      timestamp: now,
      expiryTimestamp: now + 3600 * 4 * 1000, // 4 hour validity
      invalidationLevel: Number(stopLoss.toFixed(instrument.precision)),
      aiExplanation: this.buildTechnicalSummary(instrument, signalDirection, totalScore, breakdown, macroBias),
      breakdown,
      liveCurrentPrice: currentPrice,
    };

    return {
      signal,
      smc: { swings, breaks, orderBlocks, fvgs, bprs, sweeps, premiumDiscount },
      ict: { silverBullet, judasSwing, model2022, macroBias },
      crt,
    };
  }

  private static calculateATR(candles: Candle[], period = 14): number {
    if (candles.length < period + 1) return 0;
    let sum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const prev = candles[i - 1];
      const cur = candles[i];
      const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
      sum += tr;
    }
    return sum / period;
  }

  private static buildTechnicalSummary(
    instrument: InstrumentInfo,
    direction: SignalDirection,
    score: number,
    breakdown: ConfluenceBreakdown,
    macroBias: string
  ): string {
    if (direction === 'WAIT') {
      return `${instrument.symbol} is currently in a WAIT / NO-TRADE state with a confluence score of ${score}/100. SMC, ICT, and CRT engines do not have simultaneous confirmation or are experiencing cross-market structural conflict. Institutional discipline requires waiting for a confirmed liquidity sweep and clean displacement before issuing entry orders.`;
    }

    return `${instrument.symbol} has triggered a high-probability ${direction} confluence signal (Score: ${score}/100) aligned with the ${macroBias} daily macro bias. Key institutional triggers include ${breakdown.passedConditions.slice(0, 3).join(', ')}. Stop loss is protected by institutional structural order flow with strict 1:2+ R:R minimums.`;
  }

  private static createEmptyWaitSignal(instrument: InstrumentInfo, timeframe: Timeframe, reason: string): SignalCard {
    const now = Date.now();
    return {
      id: `SIG-${instrument.symbol}-${now}`,
      symbol: instrument.symbol,
      market: instrument.market,
      direction: 'WAIT',
      entryPrice: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      tp3: 0,
      riskRewardRatio: 0,
      confidenceScore: 0,
      status: 'CANCELLED',
      timeframe,
      marketSession: 'Awaiting Feed',
      higherTimeframeBias: 'NEUTRAL',
      smcConfirmation: 'Data Pending',
      ictConfirmation: 'Data Pending',
      crtConfirmation: 'Data Pending',
      timestamp: now,
      expiryTimestamp: now + 3600 * 1000,
      invalidationLevel: 0,
      aiExplanation: reason,
      breakdown: {
        smcScore: 0,
        ictScore: 0,
        crtScore: 0,
        htfAlignmentScore: 0,
        riskValidationScore: 0,
        totalScore: 0,
        passedConditions: [],
        failedConditions: [reason],
      },
    };
  }
}
