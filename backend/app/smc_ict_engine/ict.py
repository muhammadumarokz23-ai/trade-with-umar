from datetime import datetime, timezone
from typing import Dict, Any, List
from ..data_adapters.base import Candle


class ICTEngine:
    """Time & Price engine: Kill Zones, Silver Bullet, Macro Bias."""

    @staticmethod
    def get_active_kill_zone(ts: int | None = None) -> Dict[str, Any]:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)
        dec = dt.hour + dt.minute / 60.0
        if 1.0 <= dec <= 5.0:
            return {"name": "Asian", "active": True}
        if 7.0 <= dec <= 10.0:
            return {"name": "London Open", "active": True}
        if 12.0 <= dec <= 15.0:
            return {"name": "New York Open", "active": True}
        if 15.0 <= dec <= 17.0:
            return {"name": "London Close", "active": True}
        return {"name": "Inter-Session", "active": False}

    @staticmethod
    def macro_bias(candles: List[Candle]) -> str:
        if len(candles) < 20:
            return "NEUTRAL"
        recent = candles[-20:]
        highest = max(c.high for c in recent)
        lowest = min(c.low for c in recent)
        pct = (recent[-1].close - lowest) / ((highest - lowest) or 1.0)
        if recent[-1].close > recent[0].close and pct > 0.55:
            return "BULLISH"
        if recent[-1].close < recent[0].close and pct < 0.45:
            return "BEARISH"
        return "NEUTRAL"


class CRTEngine:
    """Candle Range Theory (CRH / CRL / CRM / Sweep / Reclaim)."""

    @staticmethod
    def evaluate(candles: List[Candle]) -> Dict[str, Any]:
        if len(candles) < 6:
            return {"detected": False, "type": "Neutral CRT", "stage": "Inside Range"}
        mother = candles[-5]
        crh, crl = mother.high, mother.low
        crm = (crh + crl) / 2.0
        subsequent = candles[-4:-1]
        cur = candles[-2]

        low_sweep = any(c.low < crl for c in subsequent)
        low_reclaim = any(c.low < crl and c.close > crl for c in subsequent)
        high_sweep = any(c.high > crh for c in subsequent)
        high_reclaim = any(c.high > crh and c.close < crh for c in subsequent)

        if low_sweep and low_reclaim and cur.close >= crl:
            return {
                "detected": True,
                "type": "Bullish CRT",
                "crh": crh,
                "crl": crl,
                "crm": crm,
                "sweep_occurred": True,
                "range_reclaimed": True,
                "stage": "Expansion Phase" if cur.close > crm else "Range Reclaimed",
            }
        if high_sweep and high_reclaim and cur.close <= crh:
            return {
                "detected": True,
                "type": "Bearish CRT",
                "crh": crh,
                "crl": crl,
                "crm": crm,
                "sweep_occurred": True,
                "range_reclaimed": True,
                "stage": "Expansion Phase" if cur.close < crm else "Range Reclaimed",
            }
        return {
            "detected": False,
            "type": "Neutral CRT",
            "crh": crh,
            "crl": crl,
            "crm": crm,
            "sweep_occurred": low_sweep or high_sweep,
            "range_reclaimed": False,
            "stage": "Manipulation / Sweep" if (low_sweep or high_sweep) else "Inside Range",
        }
