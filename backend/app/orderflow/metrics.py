from typing import Dict, Any, List


class OrderFlowAnalyzer:
    """Bookmap-style order flow processor: depth walls, buy inflow, sell outflow, CVD, imbalance, absorption."""

    @staticmethod
    def compute_metrics(
        bids: List[List[float]],
        asks: List[List[float]],
        trades: List[Dict[str, Any]],
        prev_cvd: float = 0.0,
    ) -> Dict[str, Any]:
        bid_vol = sum(float(q) for _, q in bids) if bids else 0.0
        ask_vol = sum(float(q) for _, q in asks) if asks else 0.0
        total_book = bid_vol + ask_vol or 1.0
        bid_ask_imbalance = round(((bid_vol - ask_vol) / total_book) * 100.0, 2)

        buy_inflow = 0.0
        sell_outflow = 0.0
        for t in trades:
            qty = float(t.get("qty", 0.0))
            price = float(t.get("price", 0.0))
            notional = qty * price
            # Binance aggTrade: m=True means buyer is maker (aggressive sell)
            if t.get("is_buyer_maker", False):
                sell_outflow += notional
            else:
                buy_inflow += notional

        delta = buy_inflow - sell_outflow
        cvd = prev_cvd + delta

        sorted_bids = sorted(float(q) for _, q in bids) if bids else [0.0]
        sorted_asks = sorted(float(q) for _, q in asks) if asks else [0.0]
        med_bid = sorted_bids[len(sorted_bids) // 2]
        med_ask = sorted_asks[len(sorted_asks) // 2]
        bid_walls = [{"price": float(p), "qty": float(q)} for p, q in bids if float(q) > med_bid * 2.2][:5]
        ask_walls = [{"price": float(p), "qty": float(q)} for p, q in asks if float(q) > med_ask * 2.2][:5]

        # Absorption: high aggressive volume with strong opposing resting liquidity wall
        total_flow = buy_inflow + sell_outflow
        absorption = "NONE"
        if sell_outflow > buy_inflow * 1.4 and bid_ask_imbalance > 15:
            absorption = "BULLISH_ABSORPTION (Passive Bids Absorbing Aggressive Selling)"
        elif buy_inflow > sell_outflow * 1.4 and bid_ask_imbalance < -15:
            absorption = "BEARISH_ABSORPTION (Passive Asks Absorbing Aggressive Buying)"

        bias = "BULLISH" if (delta > 0 and bid_ask_imbalance > 5) else "BEARISH" if (delta < 0 and bid_ask_imbalance < -5) else "NEUTRAL"

        return {
            "is_live": len(bids) > 0 or len(trades) > 0,
            "buy_inflow_usd": round(buy_inflow, 2),
            "sell_outflow_usd": round(sell_outflow, 2),
            "delta_usd": round(delta, 2),
            "cumulative_delta_usd": round(cvd, 2),
            "bid_ask_imbalance_pct": bid_ask_imbalance,
            "bid_walls": bid_walls,
            "ask_walls": ask_walls,
            "absorption": absorption,
            "volume_spike": total_flow > 250000,
            "institutional_bias": bias,
        }

    @classmethod
    async def fetch_binance_orderflow(cls, symbol: str = "BTCUSDT", prev_cvd: float = 0.0) -> Dict[str, Any]:
        import httpx
        sym = symbol.upper()
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                depth_resp, trades_resp = await (
                    client.get(f"https://api.binance.com/api/v3/depth?symbol={sym}&limit=20"),
                    client.get(f"https://api.binance.com/api/v3/aggTrades?symbol={sym}&limit=100"),
                )
                depth_resp.raise_for_status()
                trades_resp.raise_for_status()
                depth = depth_resp.json()
                raw_trades = trades_resp.json()
                bids = [[float(p), float(q)] for p, q in depth.get("bids", [])]
                asks = [[float(p), float(q)] for p, q in depth.get("asks", [])]
                trades = [
                    {"price": float(t["p"]), "qty": float(t["q"]), "is_buyer_maker": bool(t["m"])}
                    for t in raw_trades
                ]
                metrics = cls.compute_metrics(bids, asks, trades, prev_cvd)
                metrics["symbol"] = sym
                metrics["bids"] = bids[:15]
                metrics["asks"] = asks[:15]
                return metrics
        except Exception:
            return {
                "symbol": sym,
                "is_live": False,
                "status_message": "DEMO MODE - LIVE MARKET DATA UNAVAILABLE",
                "buy_inflow_usd": 0.0,
                "sell_outflow_usd": 0.0,
                "delta_usd": 0.0,
                "cumulative_delta_usd": prev_cvd,
                "bid_ask_imbalance_pct": 0.0,
                "bid_walls": [],
                "ask_walls": [],
                "absorption": "NONE",
                "volume_spike": False,
                "institutional_bias": "NEUTRAL",
                "bids": [],
                "asks": [],
            }
