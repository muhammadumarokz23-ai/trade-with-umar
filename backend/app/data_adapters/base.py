from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Literal

MarketType = Literal["crypto", "forex", "stock"]


@dataclass
class Candle:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    confirmed: bool = True


@dataclass
class AdapterResponse:
    symbol: str
    market: MarketType
    timeframe: str
    is_live: bool
    status_message: str
    is_market_open: bool
    candles: List[Candle]


class BaseMarketAdapter(ABC):
    @abstractmethod
    async def fetch_candles(self, symbol: str, timeframe: str, limit: int = 150) -> AdapterResponse:
        pass

    @abstractmethod
    def is_market_open(self) -> bool:
        pass
