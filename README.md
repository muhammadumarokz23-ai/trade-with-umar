# UMAR WITH TRADE
**THINK LIKE INSTITUTIONS. TRADE WITH INTELLIGENCE.**

Institutional Multi-Market AI Trading Terminal supporting **Cryptocurrency**, **Forex**, and **US Equities/ETFs**, powered by Smart Money Concepts (SMC), Inner Circle Trader (ICT), Candle Range Theory (CRT), Real-Time Bookmap-Style Order Flow, a 5-Agent 3D Meeting Room, and a Python FastAPI + PostgreSQL backend.

---

## Architecture Overview

1. **Frontend Terminal (`/src`)**
   - **React 19 + TypeScript + Tailwind CSS v4**
   - **Three.js 3D Interfaces**:
     - `ThreeTerminalHero`: UMAR-X9 Quant Sentinel 3D terminal hero
     - `AgentMeetingRooms3D`: 5 animated 3D cartoon agents (News, Market Analyst, Smart Money, Scanner, Manager) working in individual glass offices, walking into the Manager's conference room, debating live market data, and issuing consensus BUY/SELL/WAIT signal cards.
   - **TradingView Lightweight Charts**: Live candlesticks, volume, OB, FVG C.E., BPR, CRT range, and execution levels.
   - **Real-Time Order Flow (`OrderFlowPanel`)**: Bookmap-style liquidity depth heatmap canvas, Cumulative Volume Delta (CVD), buy inflow vs sell outflow, bid/ask imbalance, resting liquidity walls, absorption detection, and volume spikes via WebSocket (`/ws/terminal`).
   - **Dark & Light Mode**: Persistent theme toggle stored in `localStorage`.

2. **Node.js Bridge & WebSocket Server (`/server.ts`)**
   - Runs Express + Vite + `ws` WebSocket server on port `3000`.
   - Live Binance Spot klines, L2 order book depth, and `aggTrades`.
   - Real financial news RSS & CryptoCompare feed (`/api/news`).
   - Per-IP rate limiting, input validation, audit logging (`/api/audit-logs`), and server-side Google Gemini (`gemini-3.8-flash`) analysis (`/api/gemini/analyze`).
   - Optional proxy delegation to the Python FastAPI backend (`PYTHON_BACKEND_URL`).
   - **Strict No-Fake-Data Policy**: Never fabricates prices or candles. When live feeds are unreachable, displays `DEMO MODE - LIVE MARKET DATA UNAVAILABLE` and generates zero live signals.

3. **Python Analysis Backend (`/backend`)**
   - **FastAPI + asyncio + websockets + SQLAlchemy + PostgreSQL**
   - `app/data_adapters/`: Crypto, Forex, and Stock market adapters with strict market-hours checks.
   - `app/smc_ict_engine/`: Confirmed-candles-only OB, FVG, Balanced Price Range (BPR), BSL/SSL, EQH/EQL, Liquidity Sweeps, BOS/CHoCH/MSS, Premium/Discount, ICT Kill Zones/Silver Bullet/Judas Swing/2022 Model, CRT, and exact MTF mapping (`1W->4H`, `1D->1H`, `4H->15M`, `1H->5M`).
   - `app/orderflow/`: Buy inflow, sell outflow, CVD, bid/ask imbalance, median-threshold resting walls, absorption, and volume spikes.
   - `app/agents/`: Async 5-agent orchestrator.
   - `app/risk/`: Position sizing (0.25%–2.0% clamp), min 1:2.0 R:R enforcement, news blackout check, market-specific lot sizing.
   - `app/backtest/`: Non-repainting walk-forward backtester (70/30 IS/OOS split) with spread, slippage, and commission.

---

## Local Development Setup

### 1. Environment Variables
Copy `.env.example` to `.env` and fill in your secrets on the server only (never expose keys in client bundles):
```bash
cp .env.example .env
```

Key variables:
- `GEMINI_API_KEY`: Server-side Google Gemini API key
- `DATABASE_URL`: PostgreSQL connection string (`postgresql+asyncpg://...`)
- `PYTHON_BACKEND_URL`: Optional URL to Python FastAPI server (e.g. `http://localhost:8000`)
- `ALLOW_LIVE_TRADING`: Must remain `false` for Paper Trading Only safety mode
- Optional market/alert keys: `FINNHUB_API_KEY`, `ALPHAVANTAGE_API_KEY`, `POLYGON_API_KEY`, `TWELVEDATA_API_KEY`, `BOOKMAP_API_KEY`, `NEWS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### 2. Run Node.js + React Terminal
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

### 3. Run Python FastAPI + PostgreSQL Stack (Docker)
```bash
docker compose up --build
```
Or run Python backend standalone:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Verification & Testing

- **Frontend TypeScript Lint & Production Build**:
  ```bash
  npm run lint
  npm run build
  ```
- **Python Quantitative Engine Unit Tests**:
  ```bash
  PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v
  ```

---

## Risk & Statistical Disclaimer
- **Paper Trading Only by Default**: Live order execution is disabled unless explicitly enabled with broker credentials and safeguards.
- **Confluence Score ≠ Win Probability**: The 100-point confluence score (`SMC 25 / ICT 25 / CRT 20 / HTF 15 / Risk 15`) measures deterministic structural alignment only. It does **not** guarantee future outcomes or promise profit.
