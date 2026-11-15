import { Candle, CandleRange, CRTSetup, FairValueGap } from '../types/trading';

/**
 * Advanced CRT (Candle Range Theory) Engine
 * Analyzes mother candle range dynamics, sweeps of CRH/CRL,
 * range reclaims, and directional expansion phases.
 */
export class CRTEngine {
  /**
   * Calculate Candle Range for a reference candle (Mother Candle).
   */
  static getCandleRange(candle: Candle): CandleRange {
    return {
      time: candle.time,
      crh: candle.high,
      crl: candle.low,
      crm: (candle.high + candle.low) / 2, // 50% Midpoint
      bodyHigh: Math.max(candle.open, candle.close),
      bodyLow: Math.min(candle.open, candle.close),
    };
  }

  /**
   * Evaluate CRT Setup based on the previous completed candle range (Mother Candle)
   * and the current developing candles.
   */
  static evaluateCRT(candles: Candle[], fvgs: FairValueGap[] = []): CRTSetup {
    if (candles.length < 5) {
      const dummyCandle = candles[candles.length - 1] || {
        time: Date.now() / 1000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      };
      return {
        detected: false,
        type: 'Neutral CRT',
        motherCandle: this.getCandleRange(dummyCandle),
        sweepOccurred: false,
        rangeReclaimed: false,
        expansionTarget: 0,
        stage: 'Inside Range',
      };
    }

    // Reference mother candle: for intraday (e.g. 15m), use the previous 4-candle block or previous daily candle
    // Let's take the candle at index len - 4 as the mother reference range
    const motherIndex = Math.max(0, candles.length - 4);
    const motherCandle = this.getCandleRange(candles[motherIndex]);
    const currentCandle = candles[candles.length - 1];

    const subsequentCandles = candles.slice(motherIndex + 1);

    let lowSweep = false;
    let highSweep = false;
    let reclaimedFromLow = false;
    let reclaimedFromHigh = false;

    for (const c of subsequentCandles) {
      // Check Low Sweep (Bullish CRT setup)
      if (c.low < motherCandle.crl) {
        lowSweep = true;
        // Did it close back above CRL?
        if (c.close > motherCandle.crl) {
          reclaimedFromLow = true;
        }
      }

      // Check High Sweep (Bearish CRT setup)
      if (c.high > motherCandle.crh) {
        highSweep = true;
        // Did it close back below CRH?
        if (c.close < motherCandle.crh) {
          reclaimedFromHigh = true;
        }
      }
    }

    const rangeHeight = motherCandle.crh - motherCandle.crl;

    // Check for Bullish CRT:
    // Swept mother candle low, closed back inside, price is now above CRL pushing towards CRM/CRH
    if (lowSweep && reclaimedFromLow && currentCandle.close >= motherCandle.crl) {
      const hasBullishFvg = fvgs.some(f => f.direction === 'bullish' && !f.filled && f.startTime >= motherCandle.time);
      const isExpanding = currentCandle.close > motherCandle.crm;

      return {
        detected: true,
        type: 'Bullish CRT',
        motherCandle,
        sweepOccurred: true,
        rangeReclaimed: true,
        expansionTarget: motherCandle.crh + (hasBullishFvg ? rangeHeight * 0.5 : 0),
        stage: isExpanding ? 'Expansion Phase' : 'Range Reclaimed',
      };
    }

    // Check for Bearish CRT:
    // Swept mother candle high, closed back inside, price is now below CRH pushing towards CRM/CRL
    if (highSweep && reclaimedFromHigh && currentCandle.close <= motherCandle.crh) {
      const hasBearishFvg = fvgs.some(f => f.direction === 'bearish' && !f.filled && f.startTime >= motherCandle.time);
      const isExpanding = currentCandle.close < motherCandle.crm;

      return {
        detected: true,
        type: 'Bearish CRT',
        motherCandle,
        sweepOccurred: true,
        rangeReclaimed: true,
        expansionTarget: motherCandle.crl - (hasBearishFvg ? rangeHeight * 0.5 : 0),
        stage: isExpanding ? 'Expansion Phase' : 'Range Reclaimed',
      };
    }

    // Still inside range or in manipulation stage
    if (lowSweep || highSweep) {
      return {
        detected: false,
        type: 'Neutral CRT',
        motherCandle,
        sweepOccurred: true,
        rangeReclaimed: false,
        expansionTarget: 0,
        stage: 'Manipulation / Sweep',
      };
    }

    return {
      detected: false,
      type: 'Neutral CRT',
      motherCandle,
      sweepOccurred: false,
      rangeReclaimed: false,
      expansionTarget: 0,
      stage: 'Inside Range',
    };
  }
}
