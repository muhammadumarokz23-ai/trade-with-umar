from typing import Dict, Any, List
from ..data_adapters.base import Candle
from .smc import SMCEngine
from .ict import ICTEngine, CRTEngine

# Exact Multi-Timeframe Entry Mapping specified by architecture
ANALYSIS_TO_ENTRY_MAP: Dict[str, str] = {
    "1w": "4h",
    "1d": "1h",
    "4h": "15m",
    "1h": "5m",
}


def get_entry_timeframe(analysis_tf: str) -> str:
    return ANALYSIS_TO_ENTRY_MAP.get(analysis_tf.lower(), "15m")


def evaluate_mtf_entry(
    symbol: str,
    market: str,
    analysis_tf: str,
    htf_candles: List[Candle],
    ltf_candles: List[Candle],
    orderflow_bias: str = "NEUTRAL",
) -> Dict[str, Any]:
    """
    Entry is allowed ONLY when:
    1. Price is inside an HTF zone (OB, FVG, BPR, Discount/Premium) aligned with HTF bias
    2. Mapped Entry Timeframe shows Liquidity Sweep + CHoCH/MSS + FVG/OB retest
    3. SMC, ICT, CRT, Order Flow, and HTF bias agree (otherwise WAIT)
    """
    entry_tf = get_entry_timeframe(analysis_tf)
    if len(htf_candles) < 15 or len(ltf_candles) < 15:
        return {
            "symbol": symbol,
            "market": market,
            "analysis_tf": analysis_tf,
            "entry_tf": entry_tf,
            "direction": "WAIT",
            "confidence_score": 0,
            "passed_conditions": [],
            "failed_conditions": ["Insufficient confirmed candle history for MTF validation"],
        }

    htf_smc = SMCEngine.analyze(htf_candles)
    ltf_smc = SMCEngine.analyze(ltf_candles)
    htf_bias = ICTEngine.macro_bias(htf_candles)
    kz = ICTEngine.get_active_kill_zone()
    crt = CRTEngine.evaluate(ltf_candles)

    cur_price = ltf_candles[-2].close  # confirmed candle close
    passed: List[str] = []
    failed: List[str] = []

    # Check if price is inside an unmitigated HTF OB, FVG, or BPR
    in_htf_bull_zone = any(
        (not ob["mitigated"] and ob["direction"] == "bullish" and ob["low"] <= cur_price <= ob["high"] * 1.005)
        for ob in htf_smc["order_blocks"]
    ) or any(
        (not f["filled"] and f["direction"] == "bullish" and f["bottom"] <= cur_price <= f["top"] * 1.005)
        for f in htf_smc["fvgs"]
    )

    in_htf_bear_zone = any(
        (not ob["mitigated"] and ob["direction"] == "bearish" and ob["low"] * 0.995 <= cur_price <= ob["high"])
        for ob in htf_smc["order_blocks"]
    ) or any(
        (not f["filled"] and f["direction"] == "bearish" and f["bottom"] * 0.995 <= cur_price <= f["top"])
        for f in htf_smc["fvgs"]
    )

    ltf_sweep_bull = any(s["direction"] == "bullish" for s in ltf_smc["sweeps"][-3:])
    ltf_sweep_bear = any(s["direction"] == "bearish" for s in ltf_smc["sweeps"][-3:])
    ltf_choch_bull = any(b["direction"] == "bullish" and b["type"] in ("CHoCH", "MSS") for b in ltf_smc["breaks"][-3:])
    ltf_choch_bear = any(b["direction"] == "bearish" and b["type"] in ("CHoCH", "MSS") for b in ltf_smc["breaks"][-3:])
    ltf_retest_bull = any(not f["filled"] and f["direction"] == "bullish" for f in ltf_smc["fvgs"][-3:])
    ltf_retest_bear = any(not f["filled"] and f["direction"] == "bearish" for f in ltf_smc["fvgs"][-3:])

    # 100-Point Confluence Weights: SMC 25, ICT 25, CRT 20, HTF 15, Risk 15
    smc_score = 0
    ict_score = 0
    crt_score = 0
    htf_score = 0
    risk_score = 0

    target_dir = "NEUTRAL"
    if htf_bias == "BULLISH" and (in_htf_bull_zone or htf_smc["premium_discount_zone"] in ("Discount", "Deep Discount")):
        target_dir = "BULLISH"
    elif htf_bias == "BEARISH" and (in_htf_bear_zone or htf_smc["premium_discount_zone"] in ("Premium", "Deep Premium")):
        target_dir = "BEARISH"

    # Reject if orderflow strongly disagrees
    of_conflict = (target_dir == "BULLISH" and orderflow_bias == "BEARISH") or (
        target_dir == "BEARISH" and orderflow_bias == "BULLISH"
    )

    if target_dir == "BULLISH":
        if ltf_sweep_bull:
            smc_score += 9
            passed.append(f"{entry_tf.upper()} Bullish Liquidity Sweep confirmed (+9)")
        else:
            failed.append(f"Missing {entry_tf.upper()} bullish liquidity sweep")
        if ltf_choch_bull:
            smc_score += 8
            passed.append(f"{entry_tf.upper()} CHoCH/MSS bullish shift confirmed (+8)")
        else:
            failed.append(f"Missing {entry_tf.upper()} CHoCH/MSS confirmation")
        if ltf_retest_bull:
            smc_score += 8
            passed.append(f"{entry_tf.upper()} FVG/OB retest zone active (+8)")
        else:
            failed.append(f"Missing {entry_tf.upper()} FVG/OB retest")
    elif target_dir == "BEARISH":
        if ltf_sweep_bear:
            smc_score += 9
            passed.append(f"{entry_tf.upper()} Bearish Liquidity Sweep confirmed (+9)")
        else:
            failed.append(f"Missing {entry_tf.upper()} bearish liquidity sweep")
        if ltf_choch_bear:
            smc_score += 8
            passed.append(f"{entry_tf.upper()} CHoCH/MSS bearish shift confirmed (+8)")
        else:
            failed.append(f"Missing {entry_tf.upper()} CHoCH/MSS confirmation")
        if ltf_retest_bear:
            smc_score += 8
            passed.append(f"{entry_tf.upper()} FVG/OB retest zone active (+8)")
        else:
            failed.append(f"Missing {entry_tf.upper()} FVG/OB retest")
    else:
        failed.append(f"Price not aligned inside {analysis_tf.upper()} HTF zone with {htf_bias} bias")

    if kz["active"]:
        ict_score += 12
        passed.append(f"Active ICT Kill Zone: {kz['name']} (+12)")
    else:
        failed.append("Outside prime ICT Kill Zone window")

    if (target_dir == "BULLISH" and htf_smc["premium_discount_zone"] in ("Discount", "Deep Discount")) or (
        target_dir == "BEARISH" and htf_smc["premium_discount_zone"] in ("Premium", "Deep Premium")
    ):
        ict_score += 13
        passed.append(f"Aligned PD Array: {htf_smc['premium_discount_zone']} (+13)")
    else:
        failed.append(f"PD Array misaligned ({htf_smc['premium_discount_zone']})")

    if crt.get("detected") and ((target_dir == "BULLISH" and crt["type"] == "Bullish CRT") or (target_dir == "BEARISH" and crt["type"] == "Bearish CRT")):
        crt_score = 20
        passed.append(f"CRT {crt['type']} ({crt['stage']}) confirmed (+20)")
    elif crt.get("sweep_occurred"):
        crt_score = 10
        passed.append("CRT manipulation sweep observed (+10)")
    else:
        failed.append("No confirmed CRT range reclaim")

    if target_dir != "NEUTRAL" and (in_htf_bull_zone or in_htf_bear_zone):
        htf_score = 15
        passed.append(f"{analysis_tf.upper()} HTF Zone + Bias aligned (+15)")
    elif target_dir != "NEUTRAL":
        htf_score = 8
        passed.append(f"{analysis_tf.upper()} HTF Bias aligned (+8)")

    # Structure-based SL and minimum 1:2 R:R
    atr = sum(c.high - c.low for c in ltf_candles[-15:-1]) / 14.0
    if target_dir == "BULLISH":
        sl = min(c.low for c in ltf_candles[-9:-1]) - atr * 0.25
        risk_dist = max(cur_price - sl, cur_price * 0.002)
        tp1, tp2, tp3 = cur_price + risk_dist * 2.0, cur_price + risk_dist * 3.5, cur_price + risk_dist * 5.0
        rr = round((tp1 - cur_price) / risk_dist, 2)
    elif target_dir == "BEARISH":
        sl = max(c.high for c in ltf_candles[-9:-1]) + atr * 0.25
        risk_dist = max(sl - cur_price, cur_price * 0.002)
        tp1, tp2, tp3 = cur_price - risk_dist * 2.0, cur_price - risk_dist * 3.5, cur_price - risk_dist * 5.0
        rr = round((cur_price - tp1) / risk_dist, 2)
    else:
        sl = tp1 = tp2 = tp3 = cur_price
        rr = 0.0

    if rr >= 2.0 and not of_conflict:
        risk_score = 15
        passed.append(f"Structure SL + 1:{rr} R:R + OrderFlow validated (+15)")
    elif of_conflict:
        failed.append(f"Order Flow ({orderflow_bias}) conflicts with HTF setup")

    total = smc_score + ict_score + crt_score + htf_score + risk_score
    if of_conflict or target_dir == "NEUTRAL" or total < 70:
        direction = "WAIT"
    elif total >= 85:
        direction = "STRONG BUY" if target_dir == "BULLISH" else "STRONG SELL"
    else:
        direction = "BUY" if target_dir == "BULLISH" else "SELL"

    return {
        "symbol": symbol,
        "market": market,
        "analysis_tf": analysis_tf.upper(),
        "entry_tf": entry_tf.upper(),
        "direction": direction,
        "entry_price": round(cur_price, 5),
        "stop_loss": round(sl, 5),
        "tp1": round(tp1, 5),
        "tp2": round(tp2, 5),
        "tp3": round(tp3, 5),
        "risk_reward": rr,
        "confidence_score": total,
        "breakdown": {
            "smc": smc_score,
            "ict": ict_score,
            "crt": crt_score,
            "htf": htf_score,
            "risk": risk_score,
        },
        "session": kz["name"],
        "htf_bias": htf_bias,
        "passed_conditions": passed,
        "failed_conditions": failed,
        "htf_smc": htf_smc,
        "ltf_smc": ltf_smc,
        "crt": crt,
    }
