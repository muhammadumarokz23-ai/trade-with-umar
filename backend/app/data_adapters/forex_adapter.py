from datetime import datetime, timezone
import httpx
from .base import BaseMarketAdapter, AdapterResponse, Candle


class ForexAdapter(BaseMarketAdapter):
    """Forex & Metals adapter. Enforces weekend closure & session detection."""

    SYMBOL_MAP = {
        "EURUSD": "EURUSD=X",
        "GBPUSD": "GBPUSD=X",
        "USDJPY": "JPY=X",
        "AUDUSD": "AUDUSD=X",
        "USDCAD": "CAD=X",
        "USDCHF": "CHF=X",
        "NZDUSD": "NZDUSD=X",
        "XAUUSD": "GC=F",
        "XAGUSD": "SI=F",
    }

    def is_market_open(self) -> bool:
        now = datetime.now(timezone.utc)
        wd = now.weekday()  # Mon=0 .. Sun=6
        if wd == 5:  # Saturday closed
            return False
        if wd == 4 and now.hour >= 22:  # Friday after 22:00 UTC
            return False
        if wd == 6 and now.hour < 21:  # Sunday before 21:00 UTC
            return False
        return True

    async def fetch_candles(self, symbol: str, timeframe: str, limit: int = 150) -> AdapterResponse:
        sym = symbol.upper()
        yf_sym = self.SYMBOL_MAP.get(sym, f"{sym}=X")
        tf_lower = timeframe.lower()
        interval = "1wk" if tf_lower == "1w" else "1d" if tf_lower == "1d" else "1h" if tf_lower in ("1h", "4h") else "15m" if tf_lower in ("15m", "30m") else "5m"
        rng = "2y" if tf_lower in ("1w", "1d") else "60d" if tf_lower in ("1h", "4h") else "5d"

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_sym}?interval={interval}&range={rng}"
        try:
            async with httpx.AsyncClient(timeout=5.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                payload = resp.json()
                result = payload["chart"]["result"][0]
                ts = result["timestamp"]
                quote = result["indicators"]["quote"][0]
                candles = []
                for i in range(len(ts)):
                    o, h, l, c = quote["open"][i], quote["high"][i], quote["low"][i], quote["close"][i]
                    v = quote.get("volume", [0] * len(ts))[i] or 0
                    if None not in (o, h, l, c):
                        candles.append(
                            Candle(
                                time=int(ts[i]),
                                open=round(float(o), 5),
                                high=round(float(h), 5),
                                low=round(float(l), 5),
                                close=round(float(c), 5),
                                volume=float(v),
                                confirmed=i < len(ts) - 1,
                            )
                        )
                candles = candles[-limit:]
                return AdapterResponse(
                    symbol=sym,
                    market="forex",
                    timeframe=timeframe,
                    is_live=len(candles) > 0,
                    status_message="LIVE FOREX FEED" if candles else "DEMO MODE - LIVE MARKET DATA UNAVAILABLE",
                    is_market_open=self.is_market_open(),
                    candles=candles,
                )
        except Exception:
            return AdapterResponse(
                symbol=sym,
                market="forex",
                timeframe=timeframe,
                is_live=False,
                status_message="DEMO MODE - LIVE MARKET DATA UNAVAILABLE",
                is_market_open=self.is_market_open(),
                candles=[],
            )
