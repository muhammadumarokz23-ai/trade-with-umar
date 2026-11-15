from typing import Dict, Any, List
from ..data_adapters.base import Candle
from ..smc_ict_engine.mtf_mapper import evaluate_mtf_entry


def run_walk_forward_backtest(
    symbol: str,
    market: str,
    analysis_tf: str,
    htf_candles: List[Candle],
    ltf_candles: List[Candle],
    risk_pct: float = 1.0,
    spread_bps: float = 2.0,
    slippage_bps: float = 1.0,
    commission_usd: float = 3.5,
) -> Dict[str, Any]:
    """Non-repainting walk-forward backtest with out-of-sample split (70% IS / 30% OOS)."""
    if len(ltf_candles) < 40 or len(htf_candles) < 20:
        return {"total_trades": 0, "win_rate": 0.0, "profit_factor": 0.0, "trades": []}

    split_idx = int(len(ltf_candles) * 0.7)
    equity = 100000.0
    peak = equity
    max_dd = 0.0
    trades: List[Dict[str, Any]] = []
    active = None

    for i in range(25, len(ltf_candles) - 1):
        cur_bar = ltf_candles[i]
        next_bar = ltf_candles[i + 1]
        is_oos = i >= split_idx

        if active:
            closed = False
            pnl_r = 0.0
            if active["dir"] == "BUY":
                if next_bar.low <= active["sl"]:
                    pnl_r, closed = -1.0, True
                elif next_bar.high >= active["tp1"]:
                    pnl_r, closed = 2.0, True
            else:
                if next_bar.high >= active["sl"]:
                    pnl_r, closed = -1.0, True
                elif next_bar.low <= active["tp1"]:
                    pnl_r, closed = 2.0, True
            if closed:
                pnl_usd = active["risk_usd"] * pnl_r - commission_usd
                equity += pnl_usd
                peak = max(peak, equity)
                dd = ((peak - equity) / peak) * 100.0
                max_dd = max(max_dd, dd)
                trades.append({"sample": "OOS" if is_oos else "IS", "pnl_usd": round(pnl_usd, 2), "pnl_r": pnl_r})
                active = None
            continue

        htf_slice = [c for c in htf_candles if c.time <= cur_bar.time]
        ltf_slice = ltf_candles[: i + 1]
        if len(htf_slice) < 15:
            continue
        res = evaluate_mtf_entry(symbol, market, analysis_tf, htf_slice, ltf_slice)
        if res["direction"] in ("BUY", "STRONG BUY", "SELL", "STRONG SELL"):
            is_buy = "BUY" in res["direction"]
            cost_mult = (spread_bps + slippage_bps) / 10000.0
            entry = next_bar.open * (1 + cost_mult if is_buy else 1 - cost_mult)
            active = {
                "dir": "BUY" if is_buy else "SELL",
                "entry": entry,
                "sl": res["stop_loss"],
                "tp1": res["tp1"],
                "risk_usd": (equity * risk_pct) / 100.0,
            }

    wins = [t for t in trades if t["pnl_usd"] > 0]
    losses = [t for t in trades if t["pnl_usd"] <= 0]
    gross_win = sum(t["pnl_usd"] for t in wins)
    gross_loss = abs(sum(t["pnl_usd"] for t in losses))
    return {
        "symbol": symbol,
        "market": market,
        "total_trades": len(trades),
        "oos_trades": len([t for t in trades if t["sample"] == "OOS"]),
        "win_rate": round((len(wins) / len(trades)) * 100.0, 2) if trades else 0.0,
        "profit_factor": round(gross_win / gross_loss, 2) if gross_loss > 0 else (9.99 if gross_win > 0 else 0.0),
        "max_drawdown_pct": round(max_dd, 2),
        "final_equity": round(equity, 2),
        "trades": trades,
    }
