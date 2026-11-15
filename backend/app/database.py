from datetime import datetime, timezone
from typing import AsyncGenerator
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, Text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import get_settings


class Base(DeclarativeBase):
    pass


class SignalRecord(Base):
    __tablename__ = "signals"

    id = Column(String(64), primary_key=True)
    symbol = Column(String(32), index=True, nullable=False)
    market = Column(String(16), index=True, nullable=False)
    direction = Column(String(16), nullable=False)
    analysis_timeframe = Column(String(8), nullable=False)
    entry_timeframe = Column(String(8), nullable=False)
    entry_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=False)
    tp1 = Column(Float, nullable=False)
    tp2 = Column(Float, nullable=False)
    tp3 = Column(Float, nullable=False)
    risk_reward = Column(Float, nullable=False)
    confidence_score = Column(Integer, nullable=False)
    status = Column(String(24), default="ACTIVE")
    session_name = Column(String(64))
    invalidation_level = Column(Float)
    passed_conditions = Column(JSON, default=list)
    failed_conditions = Column(JSON, default=list)
    ai_explanation = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True))


class PaperTradeRecord(Base):
    __tablename__ = "paper_trades"

    id = Column(String(64), primary_key=True)
    symbol = Column(String(32), index=True, nullable=False)
    market = Column(String(16), nullable=False)
    direction = Column(String(16), nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=False)
    take_profit = Column(Float, nullable=False)
    lot_size = Column(Float, nullable=False)
    pnl_currency = Column(Float, default=0.0)
    status = Column(String(24), default="OPEN")
    is_live_execution = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(64), index=True, nullable=False)
    actor = Column(String(64), default="SYSTEM")
    endpoint = Column(String(128))
    details = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
