import asyncio
import time
from collections import defaultdict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .config import get_settings
from .data_adapters.crypto_adapter import CryptoAdapter
from .data_adapters.forex_adapter import ForexAdapter
from .data_adapters.stock_adapter import StockAdapter
from .smc_ict_engine.mtf_mapper import evaluate_mtf_entry, get_entry_timeframe
from .orderflow.metrics import OrderFlowAnalyzer
from .agents.orchestrator import ManagerAgent
from .risk.calculator import calculate_position
from .backtest.engine import run_walk_forward_backtest

settings = get_settings()
app = FastAPI(title="UMAR WITH TRADE — Quantitative FastAPI Engine", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory rate limiter + audit trail
_rate_buckets: dict[str, list[float]] = defaultdict(list)
_audit_trail: list[dict] = []


@app.middleware("http")
async def security_and_audit_middleware(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    _rate_buckets[ip] = [t for t in _rate_buckets[ip] if now - t < 60.0]
    if len(_rate_buckets[ip]) >= settings.rate_limit_rpm:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    _rate_buckets[ip].append(now)

    response = await call_next(request)
    _audit_trail.append({
        "ts": now,
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "ip": ip,
    })
    if len(_audit_trail) > 500:
        del _audit_trail[:100]
    return response


class RiskRequest(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=20)
    market: str = Field(..., pattern="^(crypto|forex|stock)$")
    account_balance: float = Field(..., gt=0)
    risk_pct: float = Field(1.0, ge=0.25, le=2.0)
    entry_price: float = Field(..., gt=0)
    stop_loss: float = Field(..., gt=0)
    take_profit: float = Field(..., gt=0)
    spread_pips: float = Field(1.0, ge=0)
    slippage_pips: float = Field(0.5, ge=0)
    news_blackout: bool = False


@app.get("/health")
async def health():
    return {
        "status": "operational",
        "service": "UMAR WITH TRADE Python FastAPI",
        "live_trading_enabled": settings.live_trading_enabled,
    }


@app.get("/api/py/candles")
async def get_candles(symbol: str = "BTCUSDT", market: str = "crypto", timeframe: str = "15m", limit: int = 120):
    adapter = CryptoAdapter() if market == "crypto" else ForexAdapter() if market == "forex" else StockAdapter()
    res = await adapter.fetch_candles(symbol, timeframe, limit)
    return {
        "symbol": res.symbol,
        "market": res.market,
        "timeframe": res.timeframe,
        "is_live": res.is_live,
        "status_message": res.status_message,
        "is_market_open": res.is_market_open,
        "candles": [c.__dict__ for c in res.candles],
    }


@app.get("/api/py/mtf-analysis")
async def mtf_analysis(symbol: str = "BTCUSDT", market: str = "crypto", analysis_tf: str = "4h"):
    adapter = CryptoAdapter() if market == "crypto" else ForexAdapter() if market == "forex" else StockAdapter()
    entry_tf = get_entry_timeframe(analysis_tf)
    htf, ltf = await asyncio.gather(
        adapter.fetch_candles(symbol, analysis_tf, 120),
        adapter.fetch_candles(symbol, entry_tf, 120),
    )
    if not htf.is_live or not ltf.is_live:
        return {"is_live": False, "status_message": "DEMO MODE - LIVE MARKET DATA UNAVAILABLE", "signal": None}
    of = await OrderFlowAnalyzer.fetch_binance_orderflow(symbol) if market == "crypto" else {"institutional_bias": "NEUTRAL"}
    result = evaluate_mtf_entry(symbol, market, analysis_tf, htf.candles, ltf.candles, of.get("institutional_bias", "NEUTRAL"))
    return {"is_live": True, "orderflow": of, "signal": result}


@app.get("/api/py/orderflow")
async def get_orderflow(symbol: str = "BTCUSDT"):
    return await OrderFlowAnalyzer.fetch_binance_orderflow(symbol)


@app.post("/api/py/agents/meeting")
async def run_agent_meeting(symbol: str = "BTCUSDT", market: str = "crypto", analysis_tf: str = "4h"):
    return await ManagerAgent.run_meeting(symbol, market, analysis_tf)


@app.post("/api/py/risk/calculate")
async def compute_risk(req: RiskRequest):
    return calculate_position(**req.model_dump())


@app.get("/api/py/backtest")
async def backtest_symbol(symbol: str = "BTCUSDT", market: str = "crypto", analysis_tf: str = "4h"):
    adapter = CryptoAdapter() if market == "crypto" else ForexAdapter() if market == "forex" else StockAdapter()
    entry_tf = get_entry_timeframe(analysis_tf)
    htf, ltf = await asyncio.gather(
        adapter.fetch_candles(symbol, analysis_tf, 200),
        adapter.fetch_candles(symbol, entry_tf, 300),
    )
    if not htf.is_live or not ltf.is_live:
        return {"is_live": False, "status_message": "DEMO MODE - LIVE MARKET DATA UNAVAILABLE"}
    return run_walk_forward_backtest(symbol, market, analysis_tf, htf.candles, ltf.candles)


@app.get("/api/py/audit-logs")
async def get_audit_logs():
    return {"logs": _audit_trail[-50:]}


@app.websocket("/ws/py/stream/{symbol}")
async def websocket_orderflow_stream(websocket: WebSocket, symbol: str = "BTCUSDT"):
    await websocket.accept()
    prev_cvd = 0.0
    try:
        while True:
            of = await OrderFlowAnalyzer.fetch_binance_orderflow(symbol, prev_cvd)
            prev_cvd = of.get("cumulative_delta_usd", prev_cvd)
            await websocket.send_json({"type": "orderflow", "data": of})
            await asyncio.sleep(2.5)
    except WebSocketDisconnect:
        return
