import React from 'react';
import { InstrumentInfo, SilverBulletSetup, JudasSwingSetup, ICTModel2022Setup } from '../../types/trading';
import { ICTEngine } from '../../services/ictEngine';
import { Clock, Shield, Flame, Target, Compass, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ICTAnalysisViewProps {
  instrument: InstrumentInfo;
  ict: {
    silverBullet: SilverBulletSetup;
    judasSwing: JudasSwingSetup;
    model2022: ICTModel2022Setup;
    macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
}

export const ICTAnalysisView: React.FC<ICTAnalysisViewProps> = ({
  instrument,
  ict,
}) => {
  const killzones = ICTEngine.getKillZones();
  const activeZone = killzones.find(k => k.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white font-mono flex items-center space-x-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span>INNER CIRCLE TRADER (ICT) ALGORITHMIC ENGINE</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Institutional Time & Price theory: Kill Zones, Silver Bullet, Judas Swings, and the ICT 2022 Model.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-500">Macro Bias: </span>
            <span className={`font-bold ${
              ict.macroBias === 'BULLISH' ? 'text-emerald-400' : ict.macroBias === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
            }`}>
              {ict.macroBias}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-bold">
            {activeZone ? `${activeZone.name.toUpperCase()} KILL ZONE ACTIVE` : 'INTER-SESSION LIQUIDITY'}
          </div>
        </div>
      </div>

      {/* Kill Zone Clock Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {killzones.map(kz => (
          <div
            key={kz.name}
            className={`p-4 rounded-xl border transition ${
              kz.isActive
                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`font-mono text-xs font-bold ${kz.isActive ? 'text-cyan-300' : 'text-slate-300'}`}>
                {kz.name}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                kz.isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-500'
              }`}>
                {kz.isActive ? 'IN SESSION' : 'CLOSED'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
              <div>NY: {kz.nyTimeWindow}</div>
              <div>UTC: {kz.utcTimeWindow}</div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              {kz.description}
            </p>
          </div>
        ))}
      </div>

      {/* ICT 2022 Mentorship Model Detector Card */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>ICT 2022 MENTORSHIP SETUP DETECTOR</span>
          </h3>
          <span className={`text-xs px-3 py-1 rounded-lg font-mono font-bold border ${
            ict.model2022.detected
              ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
              : 'bg-slate-950 text-slate-500 border-slate-800'
          }`}>
            {ict.model2022.detected ? `ACTIVE SETUP: ${ict.model2022.direction.toUpperCase()}` : 'AWAITING DISPLACEMENT'}
          </span>
        </div>

        {/* 5-Step Model Progress Indicator */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs font-mono">
          <div className={`p-3 rounded-xl border ${ict.model2022.liquiditySweep ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <span className="text-[10px] block text-slate-500">Step 1</span>
            <span className="font-bold">Liquidity Raid</span>
            <div className="text-[10px] mt-1">{ict.model2022.liquiditySweep ? `Swept ${ict.model2022.liquiditySweep.levelType}` : 'Pending sweep'}</div>
          </div>

          <div className={`p-3 rounded-xl border ${ict.model2022.mss ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <span className="text-[10px] block text-slate-500">Step 2</span>
            <span className="font-bold">MSS Displacement</span>
            <div className="text-[10px] mt-1">{ict.model2022.mss ? `${ict.model2022.mss.type} Break` : 'Awaiting impulse'}</div>
          </div>

          <div className={`p-3 rounded-xl border ${ict.model2022.fvg ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <span className="text-[10px] block text-slate-500">Step 3</span>
            <span className="font-bold">FVG Creation</span>
            <div className="text-[10px] mt-1">{ict.model2022.fvg ? 'Fresh Imbalance' : 'Pending gap'}</div>
          </div>

          <div className={`p-3 rounded-xl border ${ict.model2022.detected ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <span className="text-[10px] block text-slate-500">Step 4</span>
            <span className="font-bold">OTE Retracement</span>
            <div className="text-[10px] mt-1">{ict.model2022.detected ? '0.62-0.79 Fib' : 'Awaiting pullback'}</div>
          </div>

          <div className={`p-3 rounded-xl border ${ict.model2022.detected ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            <span className="text-[10px] block text-slate-500">Step 5</span>
            <span className="font-bold">Liquidity Target</span>
            <div className="text-[10px] mt-1">{ict.model2022.targetLiquidity ? ict.model2022.targetLiquidity.toFixed(instrument.precision) : 'External BSL/SSL'}</div>
          </div>
        </div>
      </div>

      {/* Silver Bullet & Judas Swing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Silver Bullet */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>ICT SILVER BULLET (60-MIN WINDOWS)</span>
            </h3>
            <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold ${
              ict.silverBullet.detected ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-slate-950 text-slate-500'
            }`}>
              {ict.silverBullet.detected ? 'TRIGGER READY' : 'OFFLINE'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
            <div>
              <span className="text-slate-500">Active Window: </span>
              <span className="text-slate-200 font-bold">{ict.silverBullet.session}</span>
            </div>
            <div>
              <span className="text-slate-500">Directional Flow: </span>
              <span className="text-cyan-400 font-bold">{ict.silverBullet.direction.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-slate-500">Target Objective: </span>
              <span className="text-emerald-400 font-bold">{ict.silverBullet.targetPrice.toFixed(instrument.precision)}</span>
            </div>
          </div>
        </div>

        {/* Judas Swing */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>ICT JUDAS SWING (ASIAN TRAP RADAR)</span>
            </h3>
            <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold ${
              ict.judasSwing.detected ? 'bg-purple-950 text-purple-300 border border-purple-500/30' : 'bg-slate-950 text-slate-500'
            }`}>
              {ict.judasSwing.detected ? 'MANIPULATION ACTIVE' : 'NO TRAP'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
            <div>
              <span className="text-slate-500">Asian Range High: </span>
              <span className="text-slate-200 font-bold">{ict.judasSwing.asianRangeHigh}</span>
            </div>
            <div>
              <span className="text-slate-500">Asian Range Low: </span>
              <span className="text-slate-200 font-bold">{ict.judasSwing.asianRangeLow}</span>
            </div>
            <div>
              <span className="text-slate-500">Reversal Expectation: </span>
              <span className="text-amber-400 font-bold">{ict.judasSwing.expectedReversal.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
