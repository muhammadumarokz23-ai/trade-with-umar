import React, { useEffect, useState } from 'react';
import { InstrumentInfo, Timeframe } from '../../types/trading';
import { MTFEngine, MTFPairEvaluation } from '../../services/mtfEngine';
import { MarketDataService } from '../../services/marketData';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

interface MultiTimeframeViewProps {
  instrument: InstrumentInfo;
  activeTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export const MultiTimeframeView: React.FC<MultiTimeframeViewProps> = ({
  instrument,
  activeTimeframe,
  onSelectTimeframe,
}) => {
  const [evaluations, setEvaluations] = useState<MTFPairEvaluation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const runLiveEvaluation = async () => {
    setLoading(true);
    try {
      const of = await MarketDataService.fetchOrderFlow(instrument.symbol);
      const res = await MTFEngine.evaluateAllPairs(instrument, of);
      setEvaluations(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runLiveEvaluation();
  }, [instrument.symbol, instrument.market]);

  const CheckBadge: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
    <div
      className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between ${
        ok
          ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
          : 'bg-slate-950 border-slate-800 text-slate-500'
      }`}
    >
      <span>{label}</span>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
    </div>
  );

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>EXACT MULTI-TIMEFRAME (MTF) ENTRY MATRIX</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Confirmed closed candles only (zero repainting): 1W→4H • 1D→1H • 4H→15M • 1H→5M.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-400 font-bold border border-cyan-500/40">
            CHART TF: {activeTimeframe.toUpperCase()}
          </span>
          <button
            onClick={runLiveEvaluation}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold flex items-center space-x-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Evaluating...' : 'Re-Scan MTF'}</span>
          </button>
        </div>
      </div>

      {/* Exact 4 MTF Pairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {loading && evaluations.length === 0 ? (
          <div className="col-span-full p-10 text-center text-slate-500 rounded-2xl bg-slate-900/80 border border-slate-800">
            Fetching live confirmed candles across 1W, 1D, 4H, 1H, 15M, and 5M...
          </div>
        ) : (
          evaluations.map((ev) => {
            const isSelected = activeTimeframe === ev.entryTf;
            return (
              <div
                key={`${ev.analysisTf}-${ev.entryTf}`}
                onClick={() => onSelectTimeframe(ev.entryTf)}
                className={`p-5 rounded-2xl border transition cursor-pointer space-y-4 ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-500 shadow-xl shadow-cyan-950/30'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-black text-white flex items-center space-x-2">
                      <span>
                        {ev.analysisTf.toUpperCase()} Analysis ➔ {ev.entryTf.toUpperCase()} Entry
                      </span>
                      {isSelected && (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold">
                          ACTIVE ENTRY TF
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      HTF Zone: <span className="text-purple-300 font-bold">{ev.htfZoneLabel}</span> • BPRs: {ev.htfBprs.length} • OBs: {ev.htfOrderBlocks.length} • FVGs: {ev.htfFvgs.length}
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-black border ${
                        ev.verdict === 'BUY'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                          : ev.verdict === 'SELL'
                          ? 'bg-rose-950 text-rose-400 border-rose-500/40'
                          : 'bg-amber-950 text-amber-400 border-amber-500/40'
                      }`}
                    >
                      {ev.verdict}
                    </span>
                    <span className="text-[10px] text-slate-500">HTF Bias: {ev.htfBias}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CheckBadge ok={ev.priceInHtfZone} label={`Price inside ${ev.analysisTf.toUpperCase()} OB/FVG/BPR`} />
                  <CheckBadge ok={ev.ltfSweepConfirmed} label={`${ev.entryTf.toUpperCase()} Liquidity Sweep`} />
                  <CheckBadge ok={ev.ltfChochOrMssConfirmed} label={`${ev.entryTf.toUpperCase()} CHoCH / MSS`} />
                  <CheckBadge ok={ev.ltfRetestConfirmed} label={`${ev.entryTf.toUpperCase()} FVG / OB Retest`} />
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
                  {ev.reason}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Institutional Multi-Timeframe Rule Notice */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
        <div className="flex items-center space-x-1.5 text-cyan-400 font-bold mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>INSTITUTIONAL ENTRY GATEKEEPING</span>
        </div>
        Entry is permitted ONLY when price sits inside an aligned higher-timeframe zone (OB, FVG, or BPR) AND the mapped entry timeframe confirms a liquidity sweep + CHoCH/MSS + FVG/OB retest on closed candles without order-flow conflict.
      </div>
    </div>
  );
};
