import React, { useState } from 'react';
import { InstrumentInfo, PositionCalculation, RiskSettings } from '../../types/trading';
import { RiskEngine, DEFAULT_RISK_SETTINGS } from '../../services/riskEngine';
import { ShieldAlert, Calculator, DollarSign, Percent, AlertTriangle, CheckCircle2, ShieldCheck, Scale } from 'lucide-react';

interface RiskCalculatorViewProps {
  instrument: InstrumentInfo;
  currentPrice: number;
}

export const RiskCalculatorView: React.FC<RiskCalculatorViewProps> = ({
  instrument,
  currentPrice,
}) => {
  const [settings, setSettings] = useState<RiskSettings>(DEFAULT_RISK_SETTINGS);
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice || 100);
  const [stopLoss, setStopLoss] = useState<number>(
    currentPrice ? Number((currentPrice * 0.992).toFixed(instrument.precision)) : 99.2
  );
  const [takeProfit, setTakeProfit] = useState<number>(
    currentPrice ? Number((currentPrice * 1.018).toFixed(instrument.precision)) : 101.8
  );

  const calculation: PositionCalculation = RiskEngine.calculatePosition(
    instrument,
    settings,
    entryPrice,
    stopLoss,
    takeProfit
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white font-mono flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span>INSTITUTIONAL RISK MANAGEMENT & LOT CALCULATOR</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict capital protection: 0.25% - 2.0% risk caps, contract specifications, and margin safeguards.
          </p>
        </div>

        <div className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center space-x-1.5 ${
          calculation.isCompliant
            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
            : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
        }`}>
          {calculation.isCompliant ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{calculation.isCompliant ? 'INSTITUTIONAL COMPLIANT' : 'RISK POLICY BREACHED'}</span>
        </div>
      </div>

      {/* Main Grid: Parameters vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Parameters */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 uppercase">
            <Calculator className="w-4 h-4 text-purple-400" />
            <span>Account & Order Inputs</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {/* Account Balance */}
            <div>
              <label className="text-slate-400 block mb-1">
                Account Capital (USD): <span className="text-cyan-400 font-bold">${settings.accountBalance.toLocaleString()}</span>
              </label>
              <input
                type="number"
                value={settings.accountBalance}
                onChange={e => setSettings({ ...settings, accountBalance: Math.max(100, Number(e.target.value)) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-cyan-500"
              />
            </div>

            {/* Risk Percentage Slider */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Per-Trade Risk (%):</span>
                <span className="text-amber-400 font-bold">{settings.riskPercentage}% (${((settings.accountBalance * settings.riskPercentage) / 100).toFixed(2)})</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="2.00"
                step="0.25"
                value={settings.riskPercentage}
                onChange={e => setSettings({ ...settings, riskPercentage: Number(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>0.25% (Conservative)</span>
                <span>1.0% (Institutional Default)</span>
                <span>2.0% (Max Limit)</span>
              </div>
            </div>

            {/* Execution Prices */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Entry Price</label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={e => setEntryPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg p-2 text-cyan-400 font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={e => setStopLoss(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-rose-500/40 rounded-lg p-2 text-rose-400 font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  value={takeProfit}
                  onChange={e => setTakeProfit(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg p-2 text-emerald-400 font-bold outline-none"
                />
              </div>
            </div>

            {/* Spread & Slippage Overrides */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Typical Spread (Pips)</label>
                <input
                  type="number"
                  step="0.1"
                  value={instrument.spreadTypicalPips}
                  disabled
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Slippage Buffer (Pips)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.slippagePips}
                  onChange={e => setSettings({ ...settings, slippagePips: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Calculation Results */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 uppercase">
            <Scale className="w-4 h-4 text-cyan-400" />
            <span>Position Sizing Output ({instrument.symbol})</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30">
              <span className="text-slate-500 text-[10px] block">Recommended Lot / Volume</span>
              <span className="text-xl font-extrabold text-cyan-400 mt-0.5 block">
                {calculation.recommendedLots} {instrument.market === 'forex' ? 'Lots' : 'Units'}
              </span>
              <span className="text-[10px] text-slate-400">Position: {calculation.positionSizeUnits} units</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30">
              <span className="text-slate-500 text-[10px] block">Risk-to-Reward (R:R)</span>
              <span className="text-xl font-extrabold text-amber-400 mt-0.5 block">
                1:{calculation.riskReward}
              </span>
              <span className="text-[10px] text-slate-400">Min Institutional: 1:{settings.minRiskReward}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30">
              <span className="text-slate-500 text-[10px] block">Max Capital at Risk</span>
              <span className="text-xl font-extrabold text-rose-400 mt-0.5 block">
                ${calculation.riskAmountCurrency}
              </span>
              <span className="text-[10px] text-slate-400">Distance: {calculation.stopLossPipsOrTicks} pips/ticks</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/30">
              <span className="text-slate-500 text-[10px] block">Estimated Margin Required</span>
              <span className="text-xl font-extrabold text-purple-400 mt-0.5 block">
                ${calculation.estimatedMarginRequired}
              </span>
              <span className="text-[10px] text-slate-400">Spread Cost: ~${calculation.spreadCostEstimated}</span>
            </div>
          </div>

          {/* Compliance & Warnings */}
          <div className="pt-2">
            {calculation.warnings.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Trade satisfies all institutional risk management policies and minimum 1:2 R:R guidelines.</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs font-mono space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>RISK WARNINGS DETECTED</span>
                </div>
                {calculation.warnings.map((w, idx) => (
                  <div key={idx} className="text-[11px] text-rose-300/90">• {w}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
