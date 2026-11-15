import React from 'react';
import { InstrumentInfo, MarketTicker, MarketType } from '../../types/trading';
import { Coins, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, Shield, Clock } from 'lucide-react';

interface MarketOverviewProps {
  instruments: InstrumentInfo[];
  tickers: MarketTicker[];
  selectedSymbol: string;
  onSelectInstrument: (symbol: string, market: MarketType) => void;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  instruments,
  tickers,
  selectedSymbol,
  onSelectInstrument,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 font-mono">
      {instruments.slice(0, 10).map(inst => {
        const ticker = tickers.find(t => t.symbol === inst.symbol);
        const price = ticker ? ticker.price : 0;
        const change = ticker ? ticker.change24h : 0;
        const isSelected = selectedSymbol === inst.symbol;
        const isUp = change >= 0;

        return (
          <div
            key={inst.symbol}
            onClick={() => onSelectInstrument(inst.symbol, inst.market)}
            className={`p-3.5 rounded-2xl border transition cursor-pointer relative overflow-hidden group ${
              isSelected
                ? 'bg-slate-900 border-cyan-500 shadow-xl shadow-cyan-950/30'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-white text-sm">{inst.symbol}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {inst.market}
                </span>
              </div>

              <span className={`text-xs font-bold flex items-center space-x-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{isUp ? '+' : ''}{change.toFixed(2)}%</span>
              </span>
            </div>

            <div className="text-base font-black text-slate-100">
              {price.toLocaleString()}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span>Spread: {inst.spreadTypicalPips} pips</span>
              <span className="text-cyan-400 group-hover:underline flex items-center">
                <span>Analyze</span>
                <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
