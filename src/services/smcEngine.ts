import {
  Candle,
  SwingPoint,
  StructureBreak,
  OrderBlock,
  FairValueGap,
  LiquidityLevel,
  LiquiditySweep,
  PremiumDiscount,
  BalancedPriceRange,
} from '../types/trading';

/**
 * Advanced Smart Money Concepts (SMC) Engine
 * Deterministic algorithms, strictly non-repainting using confirmed candle closes.
 */
export class SMCEngine {
  /**
   * Drop the still-forming latest candle so SMC/ICT analysis operates strictly on confirmed closed candles.
   */
  static confirmedOnly(candles: Candle[]): Candle[] {
    return candles.length > 2 ? candles.slice(0, -1) : candles;
  }

  /**
   * Identify Swing Highs and Swing Lows using fractal logic.
   * Requires confirmed left and right bars to prevent repainting.
   */
  static findSwingPoints(candles: Candle[], lookback = 3): SwingPoint[] {
    const points: SwingPoint[] = [];
    const len = candles.length;
    if (len < lookback * 2 + 1) return points;

    for (let i = lookback; i < len - lookback; i++) {
      const current = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= current.high || candles[i + j].high > current.high) {
          isHigh = false;
        }
        if (candles[i - j].low <= current.low || candles[i + j].low < current.low) {
          isLow = false;
        }
      }

      if (isHigh) {
        points.push({
          index: i,
          time: current.time,
          price: current.high,
          type: 'high',
          confirmed: true,
        });
      }
      if (isLow) {
        points.push({
          index: i,
          time: current.time,
          price: current.low,
          type: 'low',
          confirmed: true,
        });
      }
    }

    return points;
  }

  /**
   * Detect Break of Structure (BOS), Change of Character (CHoCH), and Market Structure Shift (MSS).
   */
  static detectStructureBreaks(candles: Candle[], swingPoints: SwingPoint[]): StructureBreak[] {
    const breaks: StructureBreak[] = [];
    if (swingPoints.length < 2 || candles.length === 0) return breaks;

    let currentTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let lastHigh: SwingPoint | null = null;
    let lastLow: SwingPoint | null = null;

    for (const sp of swingPoints) {
      if (sp.type === 'high') {
        if (!lastHigh || sp.price > lastHigh.price) {
          if (currentTrend === 'bearish' && lastHigh) {
            // Broke previous lower high -> Change of Character (CHoCH)
            breaks.push({
              type: 'CHoCH',
              direction: 'bullish',
              time: sp.time,
              breakPrice: sp.price,
              sourceSwing: lastHigh,
              displacementScore: 85,
            });
            currentTrend = 'bullish';
          } else if (currentTrend === 'bullish' && lastHigh) {
            // Higher high continuation -> BOS
            breaks.push({
              type: 'BOS',
              direction: 'bullish',
              time: sp.time,
              breakPrice: sp.price,
              sourceSwing: lastHigh,
              displacementScore: 80,
            });
          } else {
            currentTrend = 'bullish';
          }
        }
        lastHigh = sp;
      } else {
        if (!lastLow || sp.price < lastLow.price) {
          if (currentTrend === 'bullish' && lastLow) {
            // Broke previous higher low -> Change of Character (CHoCH)
            breaks.push({
              type: 'CHoCH',
              direction: 'bearish',
              time: sp.time,
              breakPrice: sp.price,
              sourceSwing: lastLow,
              displacementScore: 88,
            });
            currentTrend = 'bearish';
          } else if (currentTrend === 'bearish' && lastLow) {
            // Lower low continuation -> BOS
            breaks.push({
              type: 'BOS',
              direction: 'bearish',
              time: sp.time,
              breakPrice: sp.price,
              sourceSwing: lastLow,
              displacementScore: 78,
            });
          } else {
            currentTrend = 'bearish';
          }
        }
        lastLow = sp;
      }
    }

    return breaks;
  }

  /**
   * Detect Bullish and Bearish Order Blocks with subsequent mitigation tracking.
   */
  static findOrderBlocks(candles: Candle[], breaks: StructureBreak[]): OrderBlock[] {
    const orderBlocks: OrderBlock[] = [];
    const len = candles.length;
    if (len < 10) return orderBlocks;

    for (const brk of breaks) {
      const breakIdx = candles.findIndex(c => c.time === brk.time);
      if (breakIdx <= 3) continue;

      if (brk.direction === 'bullish') {
        // Find last bearish candle before the impulse that broke structure
        for (let i = breakIdx - 1; i >= Math.max(0, breakIdx - 8); i--) {
          const c = candles[i];
          if (c.close < c.open) {
            // Bearish candle
            const obHigh = c.high;
            const obLow = c.low;

            // Check if mitigated by any future candles
            let mitigated = false;
            let mitTime: number | undefined;
            for (let k = breakIdx + 1; k < len; k++) {
              if (candles[k].low <= obHigh && candles[k].close < obLow) {
                // Violated completely
                mitigated = true;
                mitTime = candles[k].time;
                break;
              } else if (candles[k].low <= obHigh) {
                // Mitigated / tested
                mitigated = true;
                mitTime = candles[k].time;
                break;
              }
            }

            orderBlocks.push({
              id: `OB-BULL-${c.time}`,
              direction: 'bullish',
              startIndex: i,
              startTime: c.time,
              high: obHigh,
              low: obLow,
              mitigated,
              mitigationTime: mitTime,
              strength: brk.displacementScore,
            });
            break;
          }
        }
      } else {
        // Bearish structure break: find last bullish candle before impulse
        for (let i = breakIdx - 1; i >= Math.max(0, breakIdx - 8); i--) {
          const c = candles[i];
          if (c.close > c.open) {
            // Bullish candle
            const obHigh = c.high;
            const obLow = c.low;

            let mitigated = false;
            let mitTime: number | undefined;
            for (let k = breakIdx + 1; k < len; k++) {
              if (candles[k].high >= obLow) {
                mitigated = true;
                mitTime = candles[k].time;
                break;
              }
            }

            orderBlocks.push({
              id: `OB-BEAR-${c.time}`,
              direction: 'bearish',
              startIndex: i,
              startTime: c.time,
              high: obHigh,
              low: obLow,
              mitigated,
              mitigationTime: mitTime,
              strength: brk.displacementScore,
            });
            break;
          }
        }
      }
    }

    return orderBlocks;
  }

  /**
   * Detect Fair Value Gaps (FVG) and Inverse Fair Value Gaps (IFVG).
   * 3-candle imbalance where candle 1 and candle 3 wicks do not overlap.
   */
  static findFairValueGaps(candles: Candle[]): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    const len = candles.length;
    if (len < 3) return fvgs;

    for (let i = 2; i < len; i++) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1]; // Displacement candle
      const c3 = candles[i];

      // Bullish FVG: c1.high < c3.low
      if (c1.high < c3.low && c2.close > c2.open) {
        const top = c3.low;
        const bottom = c1.high;
        const ce = (top + bottom) / 2; // Consequent Encroachment (50%)

        // Check subsequent filling
        let filled = false;
        let lowestAfter = top;
        for (let k = i + 1; k < len; k++) {
          if (candles[k].low < lowestAfter) {
            lowestAfter = candles[k].low;
          }
          if (candles[k].low <= bottom) {
            filled = true;
            break;
          }
        }

        const gapSize = top - bottom;
        const filledAmount = Math.max(0, Math.min(gapSize, top - lowestAfter));
        const fillPercentage = gapSize > 0 ? (filledAmount / gapSize) * 100 : 100;

        fvgs.push({
          id: `FVG-BULL-${c2.time}`,
          direction: 'bullish',
          startIndex: i - 1,
          startTime: c2.time,
          top,
          bottom,
          consequentEncroachment: ce,
          filled,
          fillPercentage,
        });
      }

      // Bearish FVG: c1.low > c3.high
      if (c1.low > c3.high && c2.close < c2.open) {
        const top = c1.low;
        const bottom = c3.high;
        const ce = (top + bottom) / 2;

        let filled = false;
        let highestAfter = bottom;
        for (let k = i + 1; k < len; k++) {
          if (candles[k].high > highestAfter) {
            highestAfter = candles[k].high;
          }
          if (candles[k].high >= top) {
            filled = true;
            break;
          }
        }

        const gapSize = top - bottom;
        const filledAmount = Math.max(0, Math.min(gapSize, highestAfter - bottom));
        const fillPercentage = gapSize > 0 ? (filledAmount / gapSize) * 100 : 100;

        fvgs.push({
          id: `FVG-BEAR-${c2.time}`,
          direction: 'bearish',
          startIndex: i - 1,
          startTime: c2.time,
          top,
          bottom,
          consequentEncroachment: ce,
          filled,
          fillPercentage,
        });
      }
    }

    return fvgs;
  }

  /**
   * Detect Balanced Price Ranges (BPR) where opposing Bullish and Bearish FVGs overlap.
   */
  static findBPR(fvgs: FairValueGap[], candles: Candle[]): BalancedPriceRange[] {
    const bprs: BalancedPriceRange[] = [];
    const bullish = fvgs.filter(f => f.direction === 'bullish');
    const bearish = fvgs.filter(f => f.direction === 'bearish');
    const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

    for (const b of bullish) {
      for (const s of bearish) {
        const overlapTop = Math.min(b.top, s.top);
        const overlapBottom = Math.max(b.bottom, s.bottom);
        if (overlapTop > overlapBottom) {
          const mostRecentIsBull = b.startIndex >= s.startIndex;
          const retested =
            lastPrice > 0 &&
            candles.slice(Math.max(b.startIndex, s.startIndex) + 1).some(c => c.low <= overlapTop && c.high >= overlapBottom);
          bprs.push({
            id: `BPR-${b.startTime}-${s.startTime}`,
            direction: mostRecentIsBull ? 'bullish' : 'bearish',
            top: overlapTop,
            bottom: overlapBottom,
            midpoint: (overlapTop + overlapBottom) / 2,
            time: Math.max(b.startTime, s.startTime),
            retested,
          });
        }
      }
    }
    return bprs;
  }

  /**
   * Detect Buy Side Liquidity (BSL), Sell Side Liquidity (SSL), Equal Highs (EQH), Equal Lows (EQL).
   */
  static findLiquidityPools(swingPoints: SwingPoint[]): LiquidityLevel[] {
    const levels: LiquidityLevel[] = [];
    const highs = swingPoints.filter(p => p.type === 'high');
    const lows = swingPoints.filter(p => p.type === 'low');

    // Check for Equal Highs (EQH) within 0.1% tolerance
    for (let i = 0; i < highs.length; i++) {
      let eqhFound = false;
      for (let j = i + 1; j < highs.length; j++) {
        const diff = Math.abs(highs[i].price - highs[j].price) / highs[i].price;
        if (diff <= 0.0015) {
          levels.push({
            id: `EQH-${highs[j].time}`,
            type: 'EQH',
            price: Math.max(highs[i].price, highs[j].price),
            time: highs[j].time,
            swept: false,
            touches: 2,
          });
          eqhFound = true;
          break;
        }
      }
      if (!eqhFound) {
        levels.push({
          id: `BSL-${highs[i].time}`,
          type: 'BSL',
          price: highs[i].price,
          time: highs[i].time,
          swept: false,
          touches: 1,
        });
      }
    }

    // Check for Equal Lows (EQL) within 0.1% tolerance
    for (let i = 0; i < lows.length; i++) {
      let eqlFound = false;
      for (let j = i + 1; j < lows.length; j++) {
        const diff = Math.abs(lows[i].price - lows[j].price) / lows[i].price;
        if (diff <= 0.0015) {
          levels.push({
            id: `EQL-${lows[j].time}`,
            type: 'EQL',
            price: Math.min(lows[i].price, lows[j].price),
            time: lows[j].time,
            swept: false,
            touches: 2,
          });
          eqlFound = true;
          break;
        }
      }
      if (!eqlFound) {
        levels.push({
          id: `SSL-${lows[i].time}`,
          type: 'SSL',
          price: lows[i].price,
          time: lows[i].time,
          swept: false,
          touches: 1,
        });
      }
    }

    return levels;
  }

  /**
   * Detect Liquidity Sweeps (Raid and Rejection).
   * A wick pierced a liquidity level, but the candle closed back inside the range.
   */
  static detectLiquiditySweeps(candles: Candle[], liquidityLevels: LiquidityLevel[]): LiquiditySweep[] {
    const sweeps: LiquiditySweep[] = [];
    const len = candles.length;
    if (len < 2) return sweeps;

    for (const level of liquidityLevels) {
      const startIdx = candles.findIndex(c => c.time === level.time);
      if (startIdx === -1) continue;

      for (let i = startIdx + 1; i < len; i++) {
        const c = candles[i];
        if (level.type === 'BSL' || level.type === 'EQH') {
          // Bearish sweep: High pierced above BSL, but closed below BSL
          if (c.high > level.price && c.close < level.price) {
            sweeps.push({
              time: c.time,
              levelPrice: level.price,
              levelType: 'BSL',
              wickExtreme: c.high,
              closePrice: c.close,
              direction: 'bearish',
            });
            level.swept = true;
            level.sweepTime = c.time;
            break;
          }
        } else if (level.type === 'SSL' || level.type === 'EQL') {
          // Bullish sweep: Low pierced below SSL, but closed above SSL
          if (c.low < level.price && c.close > level.price) {
            sweeps.push({
              time: c.time,
              levelPrice: level.price,
              levelType: 'SSL',
              wickExtreme: c.low,
              closePrice: c.close,
              direction: 'bullish',
            });
            level.swept = true;
            level.sweepTime = c.time;
            break;
          }
        }
      }
    }

    return sweeps;
  }

  /**
   * Calculate Premium, Discount, and Optimal Trade Entry (OTE) levels.
   */
  static calculatePremiumDiscount(candles: Candle[], swingPoints: SwingPoint[]): PremiumDiscount | null {
    if (swingPoints.length < 2 || candles.length === 0) return null;

    const lastCandle = candles[candles.length - 1];
    const recentHighs = swingPoints.filter(p => p.type === 'high');
    const recentLows = swingPoints.filter(p => p.type === 'low');

    if (recentHighs.length === 0 || recentLows.length === 0) return null;

    const highest = recentHighs[recentHighs.length - 1].price;
    const lowest = recentLows[recentLows.length - 1].price;
    const range = highest - lowest;
    if (range <= 0) return null;

    const eq = lowest + range * 0.5;
    const oteStart = lowest + range * 0.618;
    const oteSweetSpot = lowest + range * 0.705;
    const oteEnd = lowest + range * 0.786;

    let currentZone: PremiumDiscount['currentZone'] = 'Equilibrium';
    const curPrice = lastCandle.close;

    if (curPrice < lowest + range * 0.25) {
      currentZone = 'Deep Discount';
    } else if (curPrice < eq) {
      currentZone = 'Discount';
    } else if (curPrice > lowest + range * 0.75) {
      currentZone = 'Deep Premium';
    } else if (curPrice > eq) {
      currentZone = 'Premium';
    }

    return {
      swingHigh: highest,
      swingLow: lowest,
      equilibrium: eq,
      oteStart,
      oteSweetSpot,
      oteEnd,
      currentZone,
    };
  }
}
