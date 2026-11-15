import React from 'react';
import { Candle, InstrumentInfo, OrderBlock, FairValueGap, BalancedPriceRange, StructureBreak, LiquiditySweep, PremiumDiscount } from '../../types/trading';
import { Layers, Shield, TrendingUp, TrendingDown } from 'lucide-react';

interface SMCAnalysisViewProps {
  instrument: InstrumentInfo;
  candles: Candle[];
  smc: {
    breaks: StructureBreak[];
    orderBlocks: OrderBlock[];
    fvgs: FairValueGap[];
    bprs?: BalancedPriceRange[];
    sweeps: LiquiditySweep[];
    premiumDiscount: PremiumDiscount | null;
  };
}

export const SMCAnalysisView: React.FC<SMCAnalysisViewProps> = ({
  instrument,
  candles,
  smc,
}) => {
  const lastCandle = candles[candles.length - 1] || { close: 0, high: 0, low: 0 };
  const currentPrice = lastCandle.close;

  const unmitigatedOBs = smc.orderBlocks.filter(o => !o.mitigated);
  const unfilledFVGs = smc.fvgs.filter(f => !f.filled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white font-mono flex items-center space-x-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <span>SMART MONEY CONCEPTS (SMC) DEEP ENGINE</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Institutional footprint analysis for {instrument.symbol}: BOS, CHoCH, Order Blocks, FVGs, Sweeps, and PD Arrays.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            Unmitigated OBs: <span className="text-purple-400 font-bold">{unmitigatedOBs.length}</span>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            Open FVGs: <span className="text-pink-400 font-bold">{unfilledFVGs.length}</span>
          </span>
        </div>
      </div>

      {/* Premium & Discount Array Gauge */}
      {smc.premiumDiscount && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-300 uppercase">Premium / Discount Pricing Array</span>
            <span className={`px-2.5 py-0.5 rounded font-bold ${
              smc.premiumDiscount.currentZone.includes('Discount')
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                : smc.premiumDiscount.currentZone.includes('Premium')
                ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                : 'bg-amber-950 text-amber-400 border border-amber-500/30'
            }`}>
              {smc.premiumDiscount.currentZone}
            </span>
          </div>

          {/* Visual Range Bar */}
          <div className="relative w-full h-8 rounded-xl bg-gradient-to-r from-emerald-950/60 via-amber-950/40 to-rose-950/60 border border-slate-800 overflow-hidden flex items-center justify-between px-3 text-[10px] font-mono text-slate-400">
            <span>Discount (Buy Zone)</span>
            <span className="text-slate-300 font-bold">50% Equilibrium ({smc.premiumDiscount.equilibrium.toFixed(instrument.precision)})</span>
            <span>Premium (Sell Zone)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Range High (BSL)</span>
              <span className="text-slate-200 font-bold">{smc.premiumDiscount.swingHigh}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">OTE 0.62 - 0.79</span>
              <span className="text-amber-400 font-bold">
                {smc.premiumDiscount.oteStart.toFixed(instrument.precision)} - {smc.premiumDiscount.oteEnd.toFixed(instrument.precision)}
              </span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Equilibrium (0.50)</span>
              <span className="text-cyan-400 font-bold">{smc.premiumDiscount.equilibrium.toFixed(instrument.precision)}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Range Low (SSL)</span>
              <span className="text-slate-200 font-bold">{smc.premiumDiscount.swingLow}</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Order Blocks & Fair Value Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Blocks */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>DETECTED ORDER BLOCKS (OB)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Total: {smc.orderBlocks.length}</span>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
            {smc.orderBlocks.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">No confirmed Order Blocks in recent lookback.</div>
            ) : (
              smc.orderBlocks.map((ob, idx) => (
                <div
                  key={ob.id || idx}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    ob.mitigated
                      ? 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                      : ob.direction === 'bullish'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center space-x-1.5">
                      <span>{ob.direction.toUpperCase()} OB</span>
                      {!ob.mitigated && <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 text-[9px]">UNMITIGATED</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Range: {ob.low} - {ob.high}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] font-bold ${ob.mitigated ? 'text-slate-500' : 'text-cyan-400'}`}>
                      {ob.mitigated ? 'Mitigated' : 'Active Defense'}
                    </span>
                    <div className="text-[10px] text-slate-500">{new Date(ob.startTime * 1000).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fair Value Gaps (FVG) */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-pink-400" />
              <span>FAIR VALUE GAPS (FVG / IMBALANCES)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Total: {smc.fvgs.length}</span>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
            {smc.fvgs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">No Fair Value Gaps detected in current candle window.</div>
            ) : (
              smc.fvgs.map((fvg, idx) => (
                <div
                  key={fvg.id || idx}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    fvg.filled
                      ? 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                      : fvg.direction === 'bullish'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center space-x-1.5">
                      <span>{fvg.direction.toUpperCase()} FVG</span>
                      {!fvg.filled && <span className="px-1.5 py-0.2 rounded bg-pink-950 text-pink-300 text-[9px]">OPEN GAP</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      C.E. (50%): <span className="text-pink-400 font-bold">{fvg.consequentEncroachment.toFixed(instrument.precision)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">
                      Filled: {fvg.fillPercentage.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-slate-500">{new Date(fvg.startTime * 1000).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Structure Breaks (BOS / CHoCH) & Liquidity Sweeps */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
          <TrendingDown className="w-4 h-4 text-cyan-400" />
          <span>MARKET STRUCTURE BREAKS & LIQUIDITY SWEEPS</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-400 font-mono mb-2 uppercase">BOS & CHoCH Events</div>
            <div className="space-y-2">
              {smc.breaks.length === 0 ? (
                <div className="text-xs text-slate-500 font-mono">No recent structure breaks.</div>
              ) : (
                smc.breaks.slice(-4).map((brk, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between">
                    <span className="font-bold text-cyan-400">{brk.type} ({brk.direction.toUpperCase()})</span>
                    <span className="text-slate-300">Level: {brk.breakPrice}</span>
                    <span className="text-slate-500">{new Date(brk.time * 1000).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400 font-mono mb-2 uppercase">Liquidity Raids / Sweeps</div>
            <div className="space-y-2">
              {smc.sweeps.length === 0 ? (
                <div className="text-xs text-slate-500 font-mono">No sweeps detected.</div>
              ) : (
                smc.sweeps.slice(-4).map((swp, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between">
                    <span className="font-bold text-amber-400">{swp.levelType} RAID</span>
                    <span className="text-slate-300">Wick: {swp.wickExtreme}</span>
                    <span className="text-slate-500">{new Date(swp.time * 1000).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Balanced Price Ranges (BPR) */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>BALANCED PRICE RANGES (BPR — OVERLAPPING OPPOSING FVGs)</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">Detected: {smc.bprs?.length || 0}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          {!smc.bprs || smc.bprs.length === 0 ? (
            <div className="col-span-full p-3 text-center text-slate-500">
              No overlapping Bullish/Bearish FVG Balanced Price Ranges in current window.
            </div>
          ) : (
            smc.bprs.slice(-6).map((bpr) => (
              <div
                key={bpr.id}
                className={`p-3 rounded-xl border ${
                  bpr.direction === 'bullish'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>{bpr.direction.toUpperCase()} BPR</span>
                  <span className="text-[10px] text-amber-300">{bpr.retested ? 'RETESTED' : 'UNRETESTED'}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Zone: {bpr.bottom.toFixed(instrument.precision)} – {bpr.top.toFixed(instrument.precision)}
                </div>
                <div className="text-[10px] text-slate-400">
                  50% Midpoint: {bpr.midpoint.toFixed(instrument.precision)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
