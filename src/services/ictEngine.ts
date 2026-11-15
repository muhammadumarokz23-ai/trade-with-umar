import {
  Candle,
  KillZoneInfo,
  SilverBulletSetup,
  JudasSwingSetup,
  ICTModel2022Setup,
  FairValueGap,
  LiquiditySweep,
  StructureBreak,
} from '../types/trading';

/**
 * Advanced ICT (Inner Circle Trader) Engine
 * Time & Price algorithms, institutional Kill Zones, AMD (Power of Three),
 * Silver Bullet, Judas Swing, and the ICT 2022 Mentorship Model.
 */
export class ICTEngine {
  /**
   * Calculate current active ICT Kill Zones based on current UTC time.
   * Converted to New York (EST/EDT) institutional trading clock.
   */
  static getKillZones(timestamp = Date.now()): KillZoneInfo[] {
    const date = new Date(timestamp);
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const decimalUtcTime = utcHours + utcMinutes / 60;

    // Approximate NY time = UTC - 5 (standard) or UTC - 4 (daylight savings)
    // Using UTC benchmark:
    // Asian Session: 01:00 - 05:00 UTC (20:00 - 00:00 NY)
    // London Open: 07:00 - 10:00 UTC (02:00 - 05:00 NY)
    // New York Open: 12:00 - 15:00 UTC (07:00 - 10:00 NY)
    // London Close: 15:00 - 17:00 UTC (10:00 - 12:00 NY)

    const isAsian = decimalUtcTime >= 1 && decimalUtcTime <= 5;
    const isLondon = decimalUtcTime >= 7 && decimalUtcTime <= 10;
    const isNY = decimalUtcTime >= 12 && decimalUtcTime <= 15;
    const isLondonClose = decimalUtcTime >= 15 && decimalUtcTime <= 17;

    return [
      {
        name: 'Asian',
        isActive: isAsian,
        nyTimeWindow: '20:00 - 00:00 EST',
        utcTimeWindow: '01:00 - 05:00 UTC',
        description: 'Range accumulation phase. Sets key high/low reference liquidity for London raid.',
      },
      {
        name: 'London Open',
        isActive: isLondon,
        nyTimeWindow: '02:00 - 05:00 EST',
        utcTimeWindow: '07:00 - 10:00 UTC',
        description: 'Prime institutional manipulation window. Often forms the high or low of the daily candle (Judas Swing).',
      },
      {
        name: 'New York Open',
        isActive: isNY,
        nyTimeWindow: '07:00 - 10:00 EST',
        utcTimeWindow: '12:00 - 15:00 UTC',
        description: 'Highest volume session. Massive displacement, Silver Bullet 10-11 AM, continuation or reversal of London trend.',
      },
      {
        name: 'London Close',
        isActive: isLondonClose,
        nyTimeWindow: '10:00 - 12:00 EST',
        utcTimeWindow: '15:00 - 17:00 UTC',
        description: 'Profit taking and daily range exhaustion. Pullbacks into London daily value areas.',
      },
    ];
  }

  /**
   * Detect ICT Silver Bullet Setup.
   * Specific 60-minute windows:
   * - London: 03:00 - 04:00 AM NY (08:00 - 09:00 UTC)
   * - NY AM: 10:00 - 11:00 AM NY (15:00 - 16:00 UTC)
   * - NY PM: 02:00 - 03:00 PM NY (19:00 - 20:00 UTC)
   */
  static detectSilverBullet(
    candles: Candle[],
    fvgs: FairValueGap[],
    latestBreak: StructureBreak | null,
    timestamp = Date.now()
  ): SilverBulletSetup {
    const date = new Date(timestamp);
    const utcHours = date.getUTCHours();
    const utcMin = date.getUTCMinutes();
    const decTime = utcHours + utcMin / 60;

    let activeSession: SilverBulletSetup['session'] | null = null;
    if (decTime >= 8 && decTime <= 9.2) {
      activeSession = 'London (3-4 AM NY)';
    } else if (decTime >= 15 && decTime <= 16.2) {
      activeSession = 'NY AM (10-11 AM NY)';
    } else if (decTime >= 19 && decTime <= 20.2) {
      activeSession = 'NY PM (2-3 PM NY)';
    }

    if (!activeSession) {
      return {
        detected: false,
        session: 'NY AM (10-11 AM NY)',
        direction: 'bullish',
        fvg: null,
        targetPrice: 0,
      };
    }

    // Check for fresh unmitigated FVG formed during this time with structure alignment
    const recentFvg = fvgs.slice(-5).find(f => !f.filled);
    if (!recentFvg) {
      return {
        detected: false,
        session: activeSession,
        direction: 'bullish',
        fvg: null,
        targetPrice: 0,
      };
    }

    const direction = recentFvg.direction;
    const lastCandle = candles[candles.length - 1];
    const targetPrice =
      direction === 'bullish'
        ? lastCandle.close + (recentFvg.top - recentFvg.bottom) * 3
        : lastCandle.close - (recentFvg.top - recentFvg.bottom) * 3;

    return {
      detected: true,
      session: activeSession,
      direction,
      fvg: recentFvg,
      targetPrice,
    };
  }

  /**
   * Detect Judas Swing Setup.
   * Asian range high/low false breakout during the London Open window (07:00 - 08:30 UTC),
   * creating an institutional trap before reversing into the real trend.
   */
  static detectJudasSwing(candles: Candle[], sweeps: LiquiditySweep[]): JudasSwingSetup {
    if (candles.length < 24) {
      return {
        detected: false,
        asianRangeHigh: 0,
        asianRangeLow: 0,
        manipulationType: 'bullish_trap',
        expectedReversal: 'bearish',
      };
    }

    // Asian range = candles from previous day 20:00 to 00:00 NY (approx 01:00 to 05:00 UTC)
    // Filter candles within recent 24h that fall into Asian window
    const asianCandles = candles.filter(c => {
      const h = new Date(c.time * 1000).getUTCHours();
      return h >= 1 && h <= 5;
    });

    if (asianCandles.length < 3) {
      return {
        detected: false,
        asianRangeHigh: 0,
        asianRangeLow: 0,
        manipulationType: 'bullish_trap',
        expectedReversal: 'bearish',
      };
    }

    const asianHigh = Math.max(...asianCandles.map(c => c.high));
    const asianLow = Math.min(...asianCandles.map(c => c.low));

    // Check if a recent sweep pierced the Asian high or low during London Open
    const recentSweep = sweeps.slice(-3).find(s => {
      const sweepHour = new Date(s.time * 1000).getUTCHours();
      return sweepHour >= 7 && sweepHour <= 10;
    });

    if (recentSweep) {
      if (recentSweep.direction === 'bearish' && recentSweep.wickExtreme >= asianHigh) {
        // Pierced Asian high then closed lower -> Bullish trap (Judas Swing High)
        return {
          detected: true,
          asianRangeHigh: asianHigh,
          asianRangeLow: asianLow,
          manipulationType: 'bullish_trap',
          expectedReversal: 'bearish',
        };
      }
      if (recentSweep.direction === 'bullish' && recentSweep.wickExtreme <= asianLow) {
        // Pierced Asian low then closed higher -> Bearish trap (Judas Swing Low)
        return {
          detected: true,
          asianRangeHigh: asianHigh,
          asianRangeLow: asianLow,
          manipulationType: 'bearish_trap',
          expectedReversal: 'bullish',
        };
      }
    }

    return {
      detected: false,
      asianRangeHigh: asianHigh,
      asianRangeLow: asianLow,
      manipulationType: 'bullish_trap',
      expectedReversal: 'bearish',
    };
  }

  /**
   * Detect ICT 2022 Mentorship Model:
   * 1. Clear Liquidity Sweep (BSL or SSL raid)
   * 2. Aggressive Market Structure Shift (MSS) with displacement
   * 3. Formation of an unmitigated Fair Value Gap (FVG)
   * 4. Retracement into the FVG / OTE zone (0.62 - 0.79 Fib)
   * 5. Target opposing liquidity pool
   */
  static detectICT2022Model(
    candles: Candle[],
    sweeps: LiquiditySweep[],
    breaks: StructureBreak[],
    fvgs: FairValueGap[]
  ): ICTModel2022Setup {
    if (sweeps.length === 0 || breaks.length === 0 || fvgs.length === 0 || candles.length === 0) {
      return {
        detected: false,
        direction: 'bullish',
        liquiditySweep: null,
        mss: null,
        fvg: null,
        oteEntryRange: { min: 0, max: 0 },
        targetLiquidity: 0,
      };
    }

    const lastCandle = candles[candles.length - 1];
    const recentSweep = sweeps[sweeps.length - 1];
    const recentBreak = breaks[breaks.length - 1];
    const recentFvg = fvgs[fvgs.length - 1];

    // Align directions
    // Bullish Model: SSL swept -> Bullish MSS/CHoCH -> Bullish FVG
    if (
      recentSweep.direction === 'bullish' &&
      recentBreak.direction === 'bullish' &&
      recentFvg.direction === 'bullish' &&
      !recentFvg.filled
    ) {
      const impulseLow = recentSweep.wickExtreme;
      const impulseHigh = recentBreak.breakPrice;
      const range = impulseHigh - impulseLow;

      if (range > 0) {
        const oteMin = impulseLow + range * 0.618;
        const oteMax = impulseLow + range * 0.786;

        // Is price currently hovering around FVG or OTE?
        const isNearEntry = lastCandle.low <= recentFvg.top && lastCandle.close >= recentFvg.bottom * 0.998;

        if (isNearEntry) {
          return {
            detected: true,
            direction: 'bullish',
            liquiditySweep: recentSweep,
            mss: recentBreak,
            fvg: recentFvg,
            oteEntryRange: { min: oteMin, max: oteMax },
            targetLiquidity: impulseHigh + range * 1.0,
          };
        }
      }
    }

    // Bearish Model: BSL swept -> Bearish MSS/CHoCH -> Bearish FVG
    if (
      recentSweep.direction === 'bearish' &&
      recentBreak.direction === 'bearish' &&
      recentFvg.direction === 'bearish' &&
      !recentFvg.filled
    ) {
      const impulseHigh = recentSweep.wickExtreme;
      const impulseLow = recentBreak.breakPrice;
      const range = impulseHigh - impulseLow;

      if (range > 0) {
        const oteMax = impulseHigh - range * 0.618;
        const oteMin = impulseHigh - range * 0.786;

        const isNearEntry = lastCandle.high >= recentFvg.bottom && lastCandle.close <= recentFvg.top * 1.002;

        if (isNearEntry) {
          return {
            detected: true,
            direction: 'bearish',
            liquiditySweep: recentSweep,
            mss: recentBreak,
            fvg: recentFvg,
            oteEntryRange: { min: oteMin, max: oteMax },
            targetLiquidity: impulseLow - range * 1.0,
          };
        }
      }
    }

    return {
      detected: false,
      direction: 'bullish',
      liquiditySweep: null,
      mss: null,
      fvg: null,
      oteEntryRange: { min: 0, max: 0 },
      targetLiquidity: 0,
    };
  }

  /**
   * Determine Macro Daily / Weekly Bias using higher timeframe structure.
   */
  static determineMacroBias(candles: Candle[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (candles.length < 20) return 'NEUTRAL';
    const recent = candles.slice(-20);
    const firstClose = recent[0].close;
    const lastClose = recent[recent.length - 1].close;
    const highest = Math.max(...recent.map(c => c.high));
    const lowest = Math.min(...recent.map(c => c.low));

    const pricePercentile = (lastClose - lowest) / (highest - lowest || 1);

    if (lastClose > firstClose && pricePercentile > 0.6) return 'BULLISH';
    if (lastClose < firstClose && pricePercentile < 0.4) return 'BEARISH';
    return 'NEUTRAL';
  }
}
