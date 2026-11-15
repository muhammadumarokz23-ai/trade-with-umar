from typing import Dict, Any, List


def calculate_position(
    symbol: str,
    market: str,
    account_balance: float,
    risk_pct: float,
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    spread_pips: float = 1.0,
    slippage_pips: float = 0.5,
    news_blackout: bool = False,
) -> Dict[str, Any]:
    warnings: List[str] = []
    clamped_risk = max(0.25, min(2.0, risk_pct))
    if risk_pct != clamped_risk:
        warnings.append(f"Risk % clamped to institutional bounds (0.25%-2.0%): {clamped_risk}%")
    if news_blackout:
        warnings.append("High-impact economic news blackout active: new entries restricted.")

    risk_dist = abs(entry_price - stop_loss)
    reward_dist = abs(take_profit - entry_price)
    if risk_dist <= 0:
        return {"is_compliant": False, "warnings": ["Stop loss must differ from entry price."], "recommended_lots": 0.0}

    rr = round(reward_dist / risk_dist, 2)
    if rr < 2.0:
        warnings.append(f"R:R ratio 1:{rr} is below mandatory institutional minimum 1:2.0.")

    risk_usd = (account_balance * clamped_risk) / 100.0
    if market == "forex":
        pip_size = 0.01 if "JPY" in symbol else 0.1 if symbol.startswith("XAU") else 0.0001
        sl_pips = risk_dist / pip_size
        lots = round(risk_usd / ((sl_pips + slippage_pips) * 10.0), 2)
        units = int(lots * (100 if symbol.startswith("XAU") else 100000))
    elif market == "crypto":
        units = round(risk_usd / risk_dist, 4)
        lots = units
    else:
        units = int(risk_usd // risk_dist)
        lots = float(units)

    return {
        "symbol": symbol,
        "market": market,
        "risk_amount_usd": round(risk_usd, 2),
        "risk_reward": rr,
        "recommended_lots": lots,
        "position_size_units": units,
        "spread_pips": spread_pips,
        "slippage_pips": slippage_pips,
        "is_compliant": len(warnings) == 0,
        "warnings": warnings,
    }
