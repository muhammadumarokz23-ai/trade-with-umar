import React, { useState, useEffect } from 'react';
import { MarketType, SignalCard, Timeframe } from '../../types/trading';
import { SUPPORTED_INSTRUMENTS } from '../../services/instruments';
import { MarketDataService } from '../../services/marketData';
import { ConfluenceEngine } from '../../services/confluenceEngine';
import {
  Search,
  Filter,
  Flame,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Clock,
  Target,
} from 'lucide-react';

interface MarketScannerProps {
  onSelectInstrument: (symbol: string, market: MarketType) => void;
  onRequestGeminiDeepDive?: (signal: SignalCard) => void;
}

export const MarketScanner: React.FC<MarketScannerProps> = ({
  onSelectInstrument,
  onRequestGeminiDeepDive,
}) => {
  const [selectedMarket, setSelectedMarket] = useState<'all' | MarketType>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('15m');
  const [minScore, setMinScore] = useState<number>(70);
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'WAIT'>('ALL');
  const [scanning, setScanning] = useState(false);
  const [signals, setSignals] = useState<SignalCard[]>([]);
  const [lastScannedTime, setLastScannedTime] = useState<number>(Date.now());

  const runScan = async () => {
    setScanning(true);
    const scannedSignals: SignalCard[] = [];

    // Filter instruments
    const targetInstruments = SUPPORTED_INSTRUMENTS.filter(
      inst => selectedMarket === 'all' || inst.market === selectedMarket
    );

    for (const inst of targetInstruments) {
      try {
        const { candles, isLiveFeed } = await MarketDataService.fetchCandles(
          inst.symbol,
          inst.market,
          selectedTimeframe,
          80
        );
        const { signal } = ConfluenceEngine.analyze(inst, candles, selectedTimeframe, { isLiveFeed });
        scannedSignals.push(signal);
      } catch (err) {
        console.warn(`Scan error for ${inst.symbol}:`, err);
      }
    }

    setSignals(scannedSignals);
    setLastScannedTime(Date.now());
    setScanning(false);
  };

  useEffect(() => {
    runScan();
  }, [selectedMarket, selectedTimeframe]);

  // Filter signals based on UI controls
  const filteredSignals = signals.filter(sig => {
    if (directionFilter === 'BUY' && !sig.direction.includes('BUY')) return false;
    if (directionFilter === 'SELL' && !sig.direction.includes('SELL')) return false;
    if (directionFilter === 'WAIT' && sig.direction !== 'WAIT') return false;
    if (directionFilter !== 'WAIT' && sig.confidenceScore < minScore) return false;
    return true;
  });

  const highConfluenceSetups = signals.filter(s => s.confidenceScore >= 85);
  const topBullish = signals
    .filter(s => s.direction.includes('BUY'))
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3);
  const topBearish = signals
    .filter(s => s.direction.includes('SELL'))
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Scanner Header & Filter Controls */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white font-mono flex items-center space-x-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <span>UNIVERSAL MULTI-MARKET AI SCANNER</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous continuous scanning across Crypto, Forex, and Stock instruments for SMC / ICT / CRT confluence.
            </p>
          </div>

          <button
            onClick={runScan}
            disabled={scanning}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono flex items-center space-x-2 transition shadow-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning Matrix...' : 'Run New Scan'}</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* Market Filter */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">Market</label>
            <select
              value={selectedMarket}
              onChange={e => setSelectedMarket(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500 outline-none"
            >
              <option value="all">All Markets (3)</option>
              <option value="crypto">Cryptocurrency (24/7)</option>
              <option value="forex">Forex & Gold</option>
              <option value="stock">US Stocks & ETFs</option>
            </select>
          </div>

          {/* Timeframe Filter */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">Timeframe</label>
            <select
              value={selectedTimeframe}
              onChange={e => setSelectedTimeframe(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500 outline-none"
            >
              <option value="5m">5M (Scalping Execution)</option>
              <option value="15m">15M (Intraday Institutional)</option>
              <option value="1h">1H (Structure Alignment)</option>
              <option value="4h">4H (Macro Swings)</option>
              <option value="1d">1D (Daily Bias)</option>
            </select>
          </div>

          {/* Direction Filter */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">Direction</label>
            <select
              value={directionFilter}
              onChange={e => setDirectionFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500 outline-none"
            >
              <option value="ALL">All Directions</option>
              <option value="BUY">BUY & STRONG BUY</option>
              <option value="SELL">SELL & STRONG SELL</option>
              <option value="WAIT">WAIT / NO-TRADE</option>
            </select>
          </div>

          {/* Min Score Filter */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
              Min Confluence Score: <span className="text-amber-400">{minScore} pts</span>
            </label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Top Opportunity Highlights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: High Confluence 85-100 */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-amber-950/30 to-slate-950 border border-amber-500/30 shadow-lg">
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs font-mono mb-2">
            <Flame className="w-4 h-4" />
            <span>HIGH-CONFLUENCE SETUPS (85+)</span>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {highConfluenceSetups.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Institutional tier with simultaneous SMC, ICT, and CRT alignment.
          </p>
        </div>

        {/* Card 2: Top Bullish */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-950/30 to-slate-950 border border-emerald-500/30 shadow-lg">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs font-mono mb-2">
            <TrendingUp className="w-4 h-4" />
            <span>TOP BULLISH DISPLACEMENTS</span>
          </div>
          <div className="space-y-1.5">
            {topBullish.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono">No active bullish setups above filter</span>
            ) : (
              topBullish.map(s => (
                <div
                  key={s.symbol}
                  onClick={() => onSelectInstrument(s.symbol, s.market)}
                  className="flex items-center justify-between text-xs font-mono p-1.5 rounded bg-slate-900 hover:bg-slate-800 cursor-pointer transition"
                >
                  <span className="font-bold text-slate-200">{s.symbol}</span>
                  <span className="text-emerald-400 font-bold">{s.confidenceScore} pts</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 3: Top Bearish */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-rose-950/30 to-slate-950 border border-rose-500/30 shadow-lg">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs font-mono mb-2">
            <TrendingDown className="w-4 h-4" />
            <span>TOP BEARISH LIQUIDITY RAIDS</span>
          </div>
          <div className="space-y-1.5">
            {topBearish.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono">No active bearish setups above filter</span>
            ) : (
              topBearish.map(s => (
                <div
                  key={s.symbol}
                  onClick={() => onSelectInstrument(s.symbol, s.market)}
                  className="flex items-center justify-between text-xs font-mono p-1.5 rounded bg-slate-900 hover:bg-slate-800 cursor-pointer transition"
                >
                  <span className="font-bold text-slate-200">{s.symbol}</span>
                  <span className="text-rose-400 font-bold">{s.confidenceScore} pts</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Scanned Results Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Detected Instruments ({filteredSignals.length})
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Last scan: {new Date(lastScannedTime).toLocaleTimeString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-4">Market</th>
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Confluence</th>
                <th className="py-3 px-4">Entry</th>
                <th className="py-3 px-4">Stop Loss</th>
                <th className="py-3 px-4">TP1 (1:2)</th>
                <th className="py-3 px-4">SMC Trigger</th>
                <th className="py-3 px-4">ICT Window</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No setups currently meet the specified confluence thresholds. Try lowering minimum score or switching markets.
                  </td>
                </tr>
              ) : (
                filteredSignals.map(sig => {
                  const isBuy = sig.direction.includes('BUY');
                  const isSell = sig.direction.includes('SELL');

                  return (
                    <tr
                      key={sig.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => onSelectInstrument(sig.symbol, sig.market)}
                    >
                      <td className="py-3 px-4 font-bold text-white flex items-center space-x-1.5">
                        <span>{sig.symbol}</span>
                      </td>
                      <td className="py-3 px-4 uppercase text-slate-400 text-[10px]">
                        {sig.market}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isBuy
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : isSell
                            ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                        }`}>
                          {sig.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={sig.confidenceScore >= 85 ? 'text-amber-400' : sig.confidenceScore >= 70 ? 'text-cyan-400' : 'text-slate-400'}>
                          {sig.confidenceScore}/100
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-semibold">{sig.entryPrice || '-'}</td>
                      <td className="py-3 px-4 text-rose-400">{sig.stopLoss || '-'}</td>
                      <td className="py-3 px-4 text-emerald-400">{sig.tp1 || '-'}</td>
                      <td className="py-3 px-4 text-purple-300 truncate max-w-[140px]">{sig.smcConfirmation}</td>
                      <td className="py-3 px-4 text-slate-400 truncate max-w-[120px]">{sig.marketSession}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onSelectInstrument(sig.symbol, sig.market);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 group-hover:bg-cyan-500 group-hover:text-slate-950 text-slate-300 transition text-[11px] font-bold flex items-center space-x-1 ml-auto"
                        >
                          <span>Trade</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
