import React, { useState } from 'react';
import { BacktestParams, BacktestResult, Candle, InstrumentInfo, Timeframe } from '../../types/trading';
import { BacktestingEngine } from '../../services/backtestingEngine';
import {
  Activity,
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Award,
  Layers,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface BacktestingViewProps {
  instrument: InstrumentInfo;
  candles: Candle[];
}

export const BacktestingView: React.FC<BacktestingViewProps> = ({
  instrument,
  candles,
}) => {
  const [params, setParams] = useState<BacktestParams>({
    symbol: instrument.symbol,
    market: instrument.market,
    timeframe: '15m',
    lookbackCandles: Math.min(candles.length, 150),
    riskPerTrade: 1.0,
    spreadPips: instrument.spreadTypicalPips,
    slippagePips: 0.5,
    commissionPerLot: 3.5,
    minScoreThreshold: 70,
  });

  const [result, setResult] = useState<BacktestResult | null>(() => {
    return BacktestingEngine.runBacktest(instrument, candles, params);
  });

  const [isRunning, setIsRunning] = useState(false);

  const handleRunBacktest = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = BacktestingEngine.runBacktest(instrument, candles, params);
      setResult(res);
      setIsRunning(false);
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white font-mono flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>INSTITUTIONAL QUANTITATIVE BACKTESTER</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Non-repainting walk-forward validation across historical candle streams with spread, slippage, and commissions.
          </p>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs font-mono flex items-center space-x-2 transition shadow-lg shadow-cyan-950/50"
        >
          <Play className={`w-4 h-4 fill-current ${isRunning ? 'animate-pulse' : ''}`} />
          <span>{isRunning ? 'Simulating Trades...' : 'Run Quantitative Backtest'}</span>
        </button>
      </div>

      {/* Backtest Parameter Configuration Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <label className="text-slate-400 block mb-1">Timeframe</label>
          <select
            value={params.timeframe}
            onChange={e => setParams({ ...params, timeframe: e.target.value as Timeframe })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
          >
            <option value="5m">5M</option>
            <option value="15m">15M</option>
            <option value="1h">1H</option>
            <option value="4h">4H</option>
            <option value="1d">1D</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 block mb-1">Risk per Trade (%)</label>
          <input
            type="number"
            step="0.25"
            value={params.riskPerTrade}
            onChange={e => setParams({ ...params, riskPerTrade: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
          />
        </div>

        <div>
          <label className="text-slate-400 block mb-1">Spread + Slippage (Pips)</label>
          <input
            type="number"
            step="0.1"
            value={params.spreadPips + params.slippagePips}
            onChange={e => setParams({ ...params, spreadPips: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
          />
        </div>

        <div>
          <label className="text-slate-400 block mb-1">Min Confluence Score</label>
          <select
            value={params.minScoreThreshold}
            onChange={e => setParams({ ...params, minScoreThreshold: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
          >
            <option value={70}>70+ (Moderate & High)</option>
            <option value={80}>80+ (High Confluence Only)</option>
            <option value={85}>85+ (Elite Tier Only)</option>
          </select>
        </div>
      </div>

      {result && (
        <>
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 font-mono">
            {/* Win Rate */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Win Rate</span>
              <span className="text-xl font-black text-emerald-400 mt-1 block">
                {result.winRate}%
              </span>
              <span className="text-[10px] text-slate-500">
                {result.winningTrades}W / {result.losingTrades}L
              </span>
            </div>

            {/* Profit Factor */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Profit Factor</span>
              <span className="text-xl font-black text-cyan-400 mt-1 block">
                {result.profitFactor}
              </span>
              <span className="text-[10px] text-slate-500">Institutional threshold: 1.8+</span>
            </div>

            {/* Total PnL */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Net Profit</span>
              <span className={`text-xl font-black mt-1 block ${result.totalPnLCurrency >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.totalPnLCurrency >= 0 ? '+' : ''}${result.totalPnLCurrency.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500">Based on $100k account</span>
            </div>

            {/* Max Drawdown */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Max Drawdown</span>
              <span className="text-xl font-black text-amber-400 mt-1 block">
                {result.maxDrawdownPercentage}%
              </span>
              <span className="text-[10px] text-slate-500">Prop-firm safe (&lt; 5%)</span>
            </div>

            {/* Average R:R */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Average R:R</span>
              <span className="text-xl font-black text-purple-400 mt-1 block">
                1:{result.averageRiskReward}
              </span>
              <span className="text-[10px] text-slate-500">SMC Asymmetric Edge</span>
            </div>

            {/* Total Trades */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Sample Trades</span>
              <span className="text-xl font-black text-slate-200 mt-1 block">
                {result.totalTrades}
              </span>
              <span className="text-[10px] text-slate-500">Non-Repainting Candles</span>
            </div>
          </div>

          {/* Equity Curve SVG Chart */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white uppercase flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Simulated Equity Growth Curve ($100,000 Initial)</span>
              </span>
              <span className="text-slate-400">
                Peak: ${Math.max(...result.equityCurve.map(e => e.equity), 100000).toLocaleString()}
              </span>
            </div>

            {/* SVG Chart */}
            <div className="h-44 w-full bg-slate-950 rounded-xl p-3 border border-slate-800 flex items-end">
              {result.equityCurve.length < 2 ? (
                <div className="w-full text-center text-xs text-slate-500 font-mono py-12">
                  Insufficient trade sample size to graph equity curve.
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 120">
                  {/* Generate Path */}
                  {(() => {
                    const minEq = Math.min(...result.equityCurve.map(e => e.equity)) * 0.99;
                    const maxEq = Math.max(...result.equityCurve.map(e => e.equity)) * 1.01;
                    const range = maxEq - minEq || 1;

                    const points = result.equityCurve.map((pt, i) => {
                      const x = (i / (result.equityCurve.length - 1)) * 500;
                      const y = 120 - ((pt.equity - minEq) / range) * 110;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#00d2ff"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>
          </div>

          {/* Trade Log Table */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 text-xs font-mono uppercase text-slate-400 font-bold">
              Simulated Trade History Records ({result.trades.length})
            </div>

            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Trade ID</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Entry</th>
                    <th className="py-2.5 px-4">Exit</th>
                    <th className="py-2.5 px-4">Result</th>
                    <th className="py-2.5 px-4">PnL (USD)</th>
                    <th className="py-2.5 px-4">PnL (R)</th>
                    <th className="py-2.5 px-4">Setup Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.trades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        No trades triggered during this lookback window.
                      </td>
                    </tr>
                  ) : (
                    result.trades.map(trade => {
                      const isWin = trade.pnlCurrency > 0;
                      return (
                        <tr key={trade.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 text-slate-400">{trade.id}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              trade.direction === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                            }`}>
                              {trade.direction}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-200">{trade.entryPrice}</td>
                          <td className="py-2.5 px-4 text-slate-200">{trade.exitPrice}</td>
                          <td className="py-2.5 px-4">
                            <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {trade.result}
                            </span>
                          </td>
                          <td className={`py-2.5 px-4 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isWin ? '+' : ''}${trade.pnlCurrency}
                          </td>
                          <td className={`py-2.5 px-4 ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.pnlR > 0 ? `+${trade.pnlR}R` : `${trade.pnlR}R`}
                          </td>
                          <td className="py-2.5 px-4 text-purple-300 truncate max-w-[150px]">
                            {trade.setupType}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
