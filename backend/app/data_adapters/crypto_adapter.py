from datetime import datetime, timezone
import httpx
from .base import BaseMarketAdapter, AdapterResponse, Candle


class CryptoAdapter(BaseMarketAdapter):
    """24/7 Cryptocurrency adapter backed by Binance public REST API."""

    BASE_URL = "https://api.binance.com/api/v3"

    def is_market_open(self) -> bool:
        return True  # Crypto trades 24/7

    @staticmethod
    def _map_tf(tf: str) -> str:
        mapping = {
            "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m",
            "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w",
        }
        return mapping.get(tf.lower(), "15m")

    async def fetch_candles(self, symbol: str, timeframe: str, limit: int = 150) -> AdapterResponse:
        sym = symbol.upper()
        interval = self._map_tf(timeframe)
        url = f"{self.BASE_URL}/klines?symbol={sym}&interval={interval}&limit={min(limit, 500)}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                raw = resp.json()
                candles = [
                    Candle(
                        time=int(k[0] // 1000),
                        open=float(k[1]),
                        high=float(k[2]),
                        low=float(k[3]),
                        close=float(k[4]),
                        volume=float(k[5]),
                        confirmed=i < len(raw) - 1,
                    )
                    for i, k in enumerate(raw)
                ]
                return AdapterResponse(
                    symbol=sym,
                    market="crypto",
                    timeframe=timeframe,
                    is_live=len(candles) > 0,
                    status_message="LIVE BINANCE FEED" if candles else "DEMO MODE - LIVE MARKET DATA UNAVAILABLE",
                    is_market_open=True,
                    candles=candles,
                )
        except Exception:
            return AdapterResponse(
                symbol=sym,
                market="crypto",
                timeframe=timeframe,
                is_live=False,
                status_message="DEMO MODE - LIVE MARKET DATA UNAVAILABLE",
                is_market_open=True,
                candles=[],
            )
