import React, { useState } from 'react';
import { SignalCard } from '../../types/trading';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Flame,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';

interface SignalCardProps {
  signal: SignalCard;
  onExecutePaperTrade?: (signal: SignalCard) => void;
  onRequestGeminiDeepDive?: (signal: SignalCard) => void;
  isPaperTradingActive?: boolean;
}

export const SignalCardComponent: React.FC<SignalCardProps> = ({
  signal,
  onExecutePaperTrade,
  onRequestGeminiDeepDive,
  isPaperTradingActive = false,
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const isBuy = signal.direction.includes('BUY');
  const isSell = signal.direction.includes('SELL');
  const isWait = signal.direction === 'WAIT';

  const copySignalToClipboard = () => {
    const text = `UMAR WITH TRADE SIGNAL
Symbol: ${signal.symbol} (${signal.market.toUpperCase()})
Direction: ${signal.direction}
Entry: ${signal.entryPrice}
Stop Loss: ${signal.stopLoss}
TP1: ${signal.tp1} | TP2: ${signal.tp2} | TP3: ${signal.tp3}
R:R: 1:${signal.riskRewardRatio} | Confluence: ${signal.confidenceScore}/100
Timeframe: ${signal.timeframe} | Session: ${signal.marketSession}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-amber-400 bg-amber-950/80 border-amber-500/40';
    if (score >= 70) return 'text-cyan-400 bg-cyan-950/80 border-cyan-500/40';
    return 'text-slate-400 bg-slate-900 border-slate-700';
  };

  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 shadow-2xl overflow-hidden hover:border-slate-700 transition">
      {/* Top Banner with Direction and Score */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center space-x-3">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold text-white font-mono tracking-tight">{signal.symbol}</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {signal.market}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-cyan-400">
                {signal.analysisTimeframe && signal.entryTimeframe
                  ? `${signal.analysisTimeframe.toUpperCase()} → ${signal.entryTimeframe.toUpperCase()}`
                  : signal.timeframe.toUpperCase()}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-0.5">
              Session: {signal.marketSession}
              {signal.orderflowConfirmation ? ` • Flow: ${signal.orderflowConfirmation}` : ''}
            </span>
          </div>
        </div>

        {/* Direction Badge */}
        <div className="flex items-center space-x-3">
          <div className={`px-4 py-2 rounded-xl font-mono font-black text-sm border flex items-center space-x-1.5 shadow-lg ${
            isBuy
              ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/50 shadow-emerald-950/40'
              : isSell
              ? 'bg-rose-950/90 text-rose-400 border-rose-500/50 shadow-rose-950/40'
              : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
          }`}>
            {isBuy && <TrendingUp className="w-4 h-4" />}
            {isSell && <TrendingDown className="w-4 h-4" />}
            {isWait && <AlertTriangle className="w-4 h-4" />}
            <span>{signal.direction}</span>
          </div>

          {/* Confluence Score Pill */}
          <div className={`px-3 py-1.5 rounded-xl border text-center font-mono ${getScoreColor(signal.confidenceScore)}`}>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">Score</div>
            <div className="text-sm font-black">{signal.confidenceScore}/100</div>
          </div>
        </div>
      </div>

      {/* Main Signal Matrix (Entry, SL, TP1, TP2, TP3) */}
      <div className="p-5 space-y-4">
        {signal.direction === 'WAIT' ? (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 text-amber-300/90 text-xs leading-relaxed font-mono">
            <div className="font-bold flex items-center space-x-1.5 mb-1 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>INSTITUTIONAL FILTER ACTIVE: PATIENCE REQUIRED</span>
            </div>
            {signal.aiExplanation}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Entry Price */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Entry Execution</div>
                <div className="text-base font-extrabold text-cyan-400 font-mono mt-0.5">
                  {signal.entryPrice}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Market Order / OTE</div>
              </div>

              {/* Stop Loss */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/30">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Structure SL</div>
                <div className="text-base font-extrabold text-rose-400 font-mono mt-0.5">
                  {signal.stopLoss}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Invalidation Base</div>
              </div>

              {/* Take Profit 1 */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Take Profit 1</div>
                <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                  {signal.tp1}
                </div>
                <div className="text-[10px] text-emerald-500/80 font-mono">1:2.0 R:R Minimum</div>
              </div>

              {/* Take Profit 2 */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Take Profit 2</div>
                <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                  {signal.tp2}
                </div>
                <div className="text-[10px] text-emerald-500/80 font-mono">1:3.5 Runner Target</div>
              </div>
            </div>

            {/* Extra Row: TP3, R:R, HTF Bias, Invalidation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">TP3 (Expansion):</span>
                <span className="text-slate-200 font-semibold">{signal.tp3}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Risk-to-Reward:</span>
                <span className="text-amber-400 font-bold">1:{signal.riskRewardRatio}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">HTF Daily Bias:</span>
                <span className={`font-semibold ${
                  signal.higherTimeframeBias === 'BULLISH' ? 'text-emerald-400' : signal.higherTimeframeBias === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {signal.higherTimeframeBias}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Status:</span>
                <span className="text-cyan-400 font-semibold">{signal.status}</span>
              </div>
            </div>
          </>
        )}

        {/* Confirmations Trio Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start space-x-2">
            <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <div className="text-slate-400 font-mono">SMC Engine</div>
              <div className="text-slate-200 font-medium truncate">{signal.smcConfirmation}</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <div className="text-slate-400 font-mono">ICT Model</div>
              <div className="text-slate-200 font-medium truncate">{signal.ictConfirmation}</div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start space-x-2">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <div className="text-slate-400 font-mono">CRT Engine</div>
              <div className="text-slate-200 font-medium truncate">{signal.crtConfirmation}</div>
            </div>
          </div>
        </div>

        {/* AI Explanation Snippet */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center space-x-1.5 text-cyan-400 font-bold mb-1 text-[11px] font-mono">
            <Cpu className="w-3.5 h-3.5" />
            <span>AI INSTITUTIONAL THESIS</span>
          </div>
          {signal.aiExplanation}
          <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
            Disclaimer: Confluence score ({signal.confidenceScore}/100) measures structural rule alignment across SMC, ICT, CRT, HTF &amp; Risk — it is NOT a win probability or profit guarantee.
          </div>
        </div>

        {/* Confluence Breakdown Accordion Toggle */}
        <div className="border-t border-slate-800/80 pt-3">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition font-mono"
          >
            <span className="flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Inspect 100-Point Confluence Model</span>
            </span>
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBreakdown && (
            <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-fadeIn">
              {/* Category Scores */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">SMC (25)</span>
                  <span className="font-bold text-purple-400">{signal.breakdown.smcScore} pts</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">ICT (25)</span>
                  <span className="font-bold text-cyan-400">{signal.breakdown.ictScore} pts</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CRT (20)</span>
                  <span className="font-bold text-amber-400">{signal.breakdown.crtScore} pts</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">HTF Bias (15)</span>
                  <span className="font-bold text-emerald-400">{signal.breakdown.htfAlignmentScore} pts</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Risk/R:R (15)</span>
                  <span className="font-bold text-blue-400">{signal.breakdown.riskValidationScore} pts</span>
                </div>
              </div>

              {/* Passed vs Failed Checks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] font-mono">
                <div>
                  <div className="text-emerald-400 font-bold mb-1.5 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>PASSED CRITERIA</span>
                  </div>
                  <ul className="space-y-1 text-slate-300">
                    {signal.breakdown.passedConditions.map((cond, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-emerald-500">✓</span>
                        <span>{cond}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-rose-400 font-bold mb-1.5 flex items-center space-x-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>UNMET OR FILTERED CRITERIA</span>
                  </div>
                  <ul className="space-y-1 text-slate-400">
                    {signal.breakdown.failedConditions.map((cond, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-rose-500">✕</span>
                        <span>{cond}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between pt-2 gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={copySignalToClipboard}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono flex items-center space-x-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Signal'}</span>
            </button>

            {onRequestGeminiDeepDive && (
              <button
                onClick={() => onRequestGeminiDeepDive(signal)}
                className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 text-xs font-mono flex items-center space-x-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Ask Gemini Analyst</span>
              </button>
            )}
          </div>

          {onExecutePaperTrade && signal.direction !== 'WAIT' && (
            <button
              onClick={() => onExecutePaperTrade(signal)}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center space-x-1.5 transition shadow-lg shadow-cyan-950/50"
            >
              <Target className="w-4 h-4" />
              <span>Execute Paper Trade</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
