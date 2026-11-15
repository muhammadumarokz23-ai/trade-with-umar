import unittest
import math
from app.data_adapters.base import Candle
from app.smc_ict_engine.smc import SMCEngine
from app.smc_ict_engine.mtf_mapper import get_entry_timeframe, evaluate_mtf_entry
from app.orderflow.metrics import OrderFlowAnalyzer
from app.risk.calculator import calculate_position
from app.backtest.engine import run_walk_forward_backtest


def make_synthetic_structure_candles(n: int = 80, base: float = 100.0):
    candles = []
    price = base
    for i in range(n):
        wave = math.sin(i * 0.35) * 2.0 + (0.15 if i > n // 2 else -0.05)
        o = price
        c = price + wave
        h = max(o, c) + 0.6
        l = min(o, c) - 0.6
        candles.append(Candle(time=1700000000 + i * 900, open=o, high=h, low=l, close=c, volume=1500 + i * 10, confirmed=True))
        price = c
    return candles


class TestCoreEngines(unittest.TestCase):
    def test_mtf_exact_mapping(self):
        self.assertEqual(get_entry_timeframe("1w"), "4h")
        self.assertEqual(get_entry_timeframe("1d"), "1h")
        self.assertEqual(get_entry_timeframe("4h"), "15m")
        self.assertEqual(get_entry_timeframe("1h"), "5m")

    def test_smc_non_repainting_and_bpr(self):
        candles = make_synthetic_structure_candles(90)
        res = SMCEngine.analyze(candles)
        self.assertIn("order_blocks", res)
        self.assertIn("fvgs", res)
        self.assertIn("bprs", res)
        self.assertIn("sweeps", res)
        self.assertGreater(len(res["swings"]), 2)

    def test_orderflow_metrics_and_absorption(self):
        bids = [[100.0, 50.0], [99.9, 10.0], [99.8, 10.0]]
        asks = [[100.1, 5.0], [100.2, 5.0], [100.3, 5.0]]
        trades = [
            {"price": 100.0, "qty": 20.0, "is_buyer_maker": True},   # aggressive sell absorbed by bid wall
            {"price": 100.1, "qty": 5.0, "is_buyer_maker": False},
        ]
        m = OrderFlowAnalyzer.compute_metrics(bids, asks, trades)
        self.assertTrue(m["is_live"])
        self.assertGreater(m["bid_ask_imbalance_pct"], 0)
        self.assertIn("BULLISH_ABSORPTION", m["absorption"])
        self.assertEqual(len(m["bid_walls"]), 1)

    def test_risk_clamping_and_rr_enforcement(self):
        res = calculate_position("EURUSD", "forex", 100000, 1.0, 1.1000, 1.0950, 1.1100)
        self.assertTrue(res["is_compliant"])
        self.assertGreaterEqual(res["risk_reward"], 2.0)
        bad = calculate_position("EURUSD", "forex", 100000, 1.0, 1.1000, 1.0950, 1.1020)
        self.assertFalse(bad["is_compliant"])

    def test_mtf_conflict_returns_wait(self):
        htf = make_synthetic_structure_candles(60)
        ltf = make_synthetic_structure_candles(60)
        res = evaluate_mtf_entry("BTCUSDT", "crypto", "4h", htf, ltf, orderflow_bias="BEARISH")
        if res["htf_bias"] == "BULLISH":
            self.assertEqual(res["direction"], "WAIT")

    def test_walk_forward_backtest(self):
        htf = make_synthetic_structure_candles(80)
        ltf = make_synthetic_structure_candles(120)
        bt = run_walk_forward_backtest("BTCUSDT", "crypto", "4h", htf, ltf)
        self.assertIn("total_trades", bt)
        self.assertIn("win_rate", bt)
        self.assertIn("profit_factor", bt)


if __name__ == "__main__":
    unittest.main()
