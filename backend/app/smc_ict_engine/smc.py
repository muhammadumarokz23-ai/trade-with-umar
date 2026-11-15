from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from ..data_adapters.base import Candle


@dataclass
class SwingPoint:
    index: int
    time: int
    price: float
    type: str  # 'high' | 'low'
    confirmed: bool = True


@dataclass
class StructureBreak:
    type: str  # 'BOS' | 'CHoCH' | 'MSS'
    direction: str  # 'bullish' | 'bearish'
    time: int
    break_price: float


@dataclass
class OrderBlock:
    id: str
    direction: str
    start_time: int
    high: float
    low: float
    mitigated: bool


@dataclass
class FairValueGap:
    id: str
    direction: str
    start_time: int
    top: float
    bottom: float
    consequent_encroachment: float
    filled: bool


@dataclass
class BalancedPriceRange:
    id: str
    top: float
    bottom: float
    direction: str
    bullish_fvg_id: str
    bearish_fvg_id: str


@dataclass
class LiquidityLevel:
    id: str
    type: str  # 'BSL' | 'SSL' | 'EQH' | 'EQL'
    price: float
    time: int
    swept: bool = False


@dataclass
class LiquiditySweep:
    time: int
    level_price: float
    level_type: str
    wick_extreme: float
    close_price: float
    direction: str


class SMCEngine:
    """Non-repainting Smart Money Concepts engine operating strictly on confirmed closed candles."""

    @staticmethod
    def confirmed_only(candles: List[Candle]) -> List[Candle]:
        confirmed = [c for c in candles if c.confirmed]
        return confirmed if len(confirmed) >= 10 else candles[:-1] if len(candles) > 10 else candles

    @staticmethod
    def find_swings(candles: List[Candle], lookback: int = 3) -> List[SwingPoint]:
        pts: List[SwingPoint] = []
        n = len(candles)
        if n < lookback * 2 + 1:
            return pts
        for i in range(lookback, n - lookback):
            cur = candles[i]
            is_high = all(candles[i - j].high < cur.high and candles[i + j].high <= cur.high for j in range(1, lookback + 1))
            is_low = all(candles[i - j].low > cur.low and candles[i + j].low >= cur.low for j in range(1, lookback + 1))
            if is_high:
                pts.append(SwingPoint(i, cur.time, cur.high, "high", True))
            if is_low:
                pts.append(SwingPoint(i, cur.time, cur.low, "low", True))
        return pts

    @staticmethod
    def detect_breaks(swings: List[SwingPoint]) -> List[StructureBreak]:
        breaks: List[StructureBreak] = []
        trend = "neutral"
        last_h: Optional[SwingPoint] = None
        last_l: Optional[SwingPoint] = None
        for sp in swings:
            if sp.type == "high":
                if last_h and sp.price > last_h.price:
                    if trend == "bearish":
                        breaks.append(StructureBreak("CHoCH", "bullish", sp.time, sp.price))
                        trend = "bullish"
                    elif trend == "bullish":
                        breaks.append(StructureBreak("BOS", "bullish", sp.time, sp.price))
                    else:
                        trend = "bullish"
                last_h = sp
            else:
                if last_l and sp.price < last_l.price:
                    if trend == "bullish":
                        breaks.append(StructureBreak("CHoCH", "bearish", sp.time, sp.price))
                        trend = "bearish"
                    elif trend == "bearish":
                        breaks.append(StructureBreak("BOS", "bearish", sp.time, sp.price))
                    else:
                        trend = "bearish"
                last_l = sp
        return breaks

    @staticmethod
    def find_fvgs(candles: List[Candle]) -> List[FairValueGap]:
        fvgs: List[FairValueGap] = []
        n = len(candles)
        for i in range(2, n):
            c1, c2, c3 = candles[i - 2], candles[i - 1], candles[i]
            if c1.high < c3.low and c2.close > c2.open:
                top, bottom = c3.low, c1.high
                filled = any(candles[k].low <= bottom for k in range(i + 1, n))
                fvgs.append(FairValueGap(f"FVG-BULL-{c2.time}", "bullish", c2.time, top, bottom, (top + bottom) / 2, filled))
            elif c1.low > c3.high and c2.close < c2.open:
                top, bottom = c1.low, c3.high
                filled = any(candles[k].high >= top for k in range(i + 1, n))
                fvgs.append(FairValueGap(f"FVG-BEAR-{c2.time}", "bearish", c2.time, top, bottom, (top + bottom) / 2, filled))
        return fvgs

    @staticmethod
    def find_bpr(fvgs: List[FairValueGap]) -> List[BalancedPriceRange]:
        """Detect Balanced Price Ranges (overlapping bullish + bearish FVGs)."""
        bprs: List[BalancedPriceRange] = []
        bulls = [f for f in fvgs if f.direction == "bullish"]
        bears = [f for f in fvgs if f.direction == "bearish"]
        for b in bulls[-10:]:
            for s in bears[-10:]:
                overlap_top = min(b.top, s.top)
                overlap_bottom = max(b.bottom, s.bottom)
                if overlap_top > overlap_bottom:
                    direction = "bullish" if b.start_time > s.start_time else "bearish"
                    bprs.append(
                        BalancedPriceRange(
                            id=f"BPR-{b.start_time}-{s.start_time}",
                            top=overlap_top,
                            bottom=overlap_bottom,
                            direction=direction,
                            bullish_fvg_id=b.id,
                            bearish_fvg_id=s.id,
                        )
                    )
        return bprs

    @staticmethod
    def find_order_blocks(candles: List[Candle], breaks: List[StructureBreak]) -> List[OrderBlock]:
        obs: List[OrderBlock] = []
        time_idx = {c.time: idx for idx, c in enumerate(candles)}
        n = len(candles)
        for brk in breaks:
            idx = time_idx.get(brk.time, -1)
            if idx <= 3:
                continue
            for i in range(idx - 1, max(-1, idx - 8), -1):
                c = candles[i]
                if brk.direction == "bullish" and c.close < c.open:
                    mitigated = any(candles[k].low <= c.high for k in range(idx + 1, n))
                    obs.append(OrderBlock(f"OB-BULL-{c.time}", "bullish", c.time, c.high, c.low, mitigated))
                    break
                if brk.direction == "bearish" and c.close > c.open:
                    mitigated = any(candles[k].high >= c.low for k in range(idx + 1, n))
                    obs.append(OrderBlock(f"OB-BEAR-{c.time}", "bearish", c.time, c.high, c.low, mitigated))
                    break
        return obs

    @staticmethod
    def find_liquidity_and_sweeps(candles: List[Candle], swings: List[SwingPoint]) -> Dict[str, Any]:
        levels: List[LiquidityLevel] = []
        sweeps: List[LiquiditySweep] = []
        highs = [s for s in swings if s.type == "high"]
        lows = [s for s in swings if s.type == "low"]

        for i, h in enumerate(highs):
            is_eq = any(abs(h.price - highs[j].price) / (h.price or 1) <= 0.0015 for j in range(i + 1, len(highs)))
            levels.append(LiquidityLevel(f"{'EQH' if is_eq else 'BSL'}-{h.time}", "EQH" if is_eq else "BSL", h.price, h.time))
        for i, l in enumerate(lows):
            is_eq = any(abs(l.price - lows[j].price) / (l.price or 1) <= 0.0015 for j in range(i + 1, len(lows)))
            levels.append(LiquidityLevel(f"{'EQL' if is_eq else 'SSL'}-{l.time}", "EQL" if is_eq else "SSL", l.price, l.time))

        time_idx = {c.time: idx for idx, c in enumerate(candles)}
        for lvl in levels:
            start = time_idx.get(lvl.time, -1)
            if start == -1:
                continue
            for c in candles[start + 1:]:
                if lvl.type in ("BSL", "EQH") and c.high > lvl.price and c.close < lvl.price:
                    lvl.swept = True
                    sweeps.append(LiquiditySweep(c.time, lvl.price, lvl.type, c.high, c.close, "bearish"))
                    break
                if lvl.type in ("SSL", "EQL") and c.low < lvl.price and c.close > lvl.price:
                    lvl.swept = True
                    sweeps.append(LiquiditySweep(c.time, lvl.price, lvl.type, c.low, c.close, "bullish"))
                    break

        return {"levels": levels, "sweeps": sweeps}

    @classmethod
    def analyze(cls, raw_candles: List[Candle]) -> Dict[str, Any]:
        candles = cls.confirmed_only(raw_candles)
        swings = cls.find_swings(candles)
        breaks = cls.detect_breaks(swings)
        fvgs = cls.find_fvgs(candles)
        bprs = cls.find_bpr(fvgs)
        obs = cls.find_order_blocks(candles, breaks)
        liq = cls.find_liquidity_and_sweeps(candles, swings)

        highs = [s.price for s in swings if s.type == "high"]
        lows = [s.price for s in swings if s.type == "low"]
        pd_zone = "Equilibrium"
        if highs and lows and candles:
            sh, sl = highs[-1], lows[-1]
            rng = sh - sl
            cur = candles[-1].close
            if rng > 0:
                eq = sl + 0.5 * rng
                if cur < sl + 0.25 * rng:
                    pd_zone = "Deep Discount"
                elif cur < eq:
                    pd_zone = "Discount"
                elif cur > sl + 0.75 * rng:
                    pd_zone = "Deep Premium"
                elif cur > eq:
                    pd_zone = "Premium"

        return {
            "swings": [asdict(s) for s in swings],
            "breaks": [asdict(b) for b in breaks],
            "order_blocks": [asdict(o) for o in obs],
            "fvgs": [asdict(f) for f in fvgs],
            "bprs": [asdict(r) for r in bprs],
            "liquidity_levels": [asdict(l) for l in liq["levels"]],
            "sweeps": [asdict(w) for w in liq["sweeps"]],
            "premium_discount_zone": pd_zone,
        }
