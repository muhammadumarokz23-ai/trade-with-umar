from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "UMAR WITH TRADE"
    environment: str = "development"
    python_backend_port: int = 8000
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/umar_with_trade"

    # API Keys (loaded exclusively from backend .env)
    gemini_api_key: str = ""
    binance_api_key: str = ""
    binance_api_secret: str = ""
    finnhub_api_key: str = ""
    alphavantage_api_key: str = ""
    polygon_api_key: str = ""
    bookmap_api_key: str = ""
    bookmap_ws_url: str = ""
    news_api_key: str = ""

    # Execution & Risk Safeguards
    live_trading_enabled: bool = False
    default_risk_pct: float = 1.0
    max_risk_pct: float = 2.0
    min_risk_pct: float = 0.25
    max_daily_loss_pct: float = 3.0
    max_open_positions: int = 4
    rate_limit_rpm: int = 120

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
