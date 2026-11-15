import React from 'react';
import { InstrumentInfo, CRTSetup, Candle } from '../../types/trading';
import { TrendingUp, Layers, Target, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface CRTAnalysisViewProps {
  instrument: InstrumentInfo;
  candles: Candle[];
  crt: CRTSetup;
}

export const CRTAnalysisView: React.FC<CRTAnalysisViewProps> = ({
  instrument,
  candles,
  crt,
}) => {
  const lastCandle = candles[candles.length - 1] || { close: 0 };
  const currentPrice = lastCandle.close;

  const isBullish = crt.type === 'Bullish CRT';
  const isBearish = crt.type === 'Bearish CRT';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white font-mono flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <span>CANDLE RANGE THEORY (CRT) SPECIALIST ENGINE</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Mother candle liquidity sweeps, equilibrium reclaims, and fractal range expansion dynamics.
          </p>
        </div>

        <div className={`px-4 py-2 rounded-xl border font-mono font-bold text-xs flex items-center space-x-2 ${
          isBullish
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
            : isBearish
            ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
            : 'bg-slate-950 text-slate-400 border-slate-800'
        }`}>
          <span>{crt.type.toUpperCase()}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300">
            {crt.stage}
          </span>
        </div>
      </div>

      {/* Mother Candle Metrics Matrix */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
          Mother Candle Range Architecture
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30">
            <span className="text-slate-500 text-[10px] block">CRH (Candle Range High)</span>
            <span className="text-base font-extrabold text-cyan-400 mt-0.5 block">
              {crt.motherCandle.crh.toFixed(instrument.precision)}
            </span>
            <span className="text-[10px] text-slate-400">Target for Bullish Expansions</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-700">
            <span className="text-slate-500 text-[10px] block">CRM (50% Midpoint / Equilibrium)</span>
            <span className="text-base font-extrabold text-slate-200 mt-0.5 block">
              {crt.motherCandle.crm.toFixed(instrument.precision)}
            </span>
            <span className="text-[10px] text-slate-400">Structural Pivot Point</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30">
            <span className="text-slate-500 text-[10px] block">CRL (Candle Range Low)</span>
            <span className="text-base font-extrabold text-rose-400 mt-0.5 block">
              {crt.motherCandle.crl.toFixed(instrument.precision)}
            </span>
            <span className="text-[10px] text-slate-400">Target for Bearish Expansions</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30">
            <span className="text-slate-500 text-[10px] block">Expansion Target</span>
            <span className="text-base font-extrabold text-amber-400 mt-0.5 block">
              {crt.expansionTarget ? crt.expansionTarget.toFixed(instrument.precision) : 'Inside Range'}
            </span>
            <span className="text-[10px] text-slate-400">Fibonacci Extension Objective</span>
          </div>
        </div>
      </div>

      {/* 4-Phase Lifecycle Stages */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
          CRT Setup Execution Progression
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
            <span className="text-[10px] text-slate-500 block">Phase 1</span>
            <span className="font-bold text-slate-200">Reference Mother Bar</span>
            <p className="text-[10px] text-slate-500 mt-1">Establishes CRH and CRL boundaries.</p>
          </div>

          <div className={`p-3 rounded-xl border ${
            crt.sweepOccurred ? 'bg-amber-950/30 border-amber-500/50 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}>
            <span className="text-[10px] block">Phase 2</span>
            <span className="font-bold">Liquidity Raid / Wick Sweep</span>
            <p className="text-[10px] mt-1">
              {crt.sweepOccurred ? 'Extreme swept with wick' : 'Awaiting sweep outside boundary'}
            </p>
          </div>

          <div className={`p-3 rounded-xl border ${
            crt.rangeReclaimed ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}>
            <span className="text-[10px] block">Phase 3</span>
            <span className="font-bold">Range Reclaim Confirmation</span>
            <p className="text-[10px] mt-1">
              {crt.rangeReclaimed ? 'Candle closed back inside range' : 'Awaiting close inside range'}
            </p>
          </div>

          <div className={`p-3 rounded-xl border ${
            crt.stage === 'Expansion Phase' ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}>
            <span className="text-[10px] block">Phase 4</span>
            <span className="font-bold">Expansion Phase</span>
            <p className="text-[10px] mt-1">
              {crt.stage === 'Expansion Phase' ? 'Aggressive expansion underway' : 'Pending midpoint cross'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
