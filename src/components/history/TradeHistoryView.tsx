import React from 'react';
import { SignalCard } from '../../types/trading';
import { History, Target, AlertTriangle, ShieldCheck, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';

export interface PaperTradeRecord {
  id: string;
  symbol: string;
  market: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  pnlCurrency: number;
  status: 'OPEN' | 'TP_HIT' | 'SL_HIT' | 'CLOSED_MANUAL';
  timestamp: number;
}

interface TradeHistoryViewProps {
  paperBalance: number;
  activeTrades: PaperTradeRecord[];
  closedTrades: PaperTradeRecord[];
  onCloseTrade: (id: string) => void;
  onEmergencyCloseAll: () => void;
}

export const TradeHistoryView: React.FC<TradeHistoryViewProps> = ({
  paperBalance,
  activeTrades,
  closedTrades,
  onCloseTrade,
  onEmergencyCloseAll,
}) => {
  const totalUnrealizedPnL = activeTrades.reduce((acc, t) => acc + t.pnlCurrency, 0);

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-cyan-400" />
            <span>INSTITUTIONAL PAPER TRADING & TRADE LOGS</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated forward-testing execution simulation with strict risk controls and position tracking.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">TOTAL CAPITAL</span>
            <span className="text-base font-extrabold text-white">${paperBalance.toLocaleString()}</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">UNREALIZED PnL</span>
            <span className={`text-base font-extrabold ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
            </span>
          </div>

          {activeTrades.length > 0 && (
            <button
              onClick={onEmergencyCloseAll}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center space-x-1.5 transition shadow-lg shadow-rose-950/50"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Emergency Close All</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs uppercase text-slate-400 font-bold">
            Active Open Positions ({activeTrades.length})
          </span>
          <span className="text-[11px] text-cyan-400 font-bold">Paper Execution Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Lots / Volume</th>
                <th className="py-3 px-4">Entry</th>
                <th className="py-3 px-4">Mark Price</th>
                <th className="py-3 px-4">Stop Loss</th>
                <th className="py-3 px-4">Take Profit</th>
                <th className="py-3 px-4">Floating PnL</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No active open trades. Select any high-confluence signal from the Signal Center to initiate a paper position.
                  </td>
                </tr>
              ) : (
                activeTrades.map(trade => {
                  const isBuy = trade.direction.includes('BUY');
                  const isProfit = trade.pnlCurrency >= 0;

                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-white">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isBuy ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                        }`}>
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-bold">{trade.lotSize}</td>
                      <td className="py-3 px-4 text-slate-200">{trade.entryPrice}</td>
                      <td className="py-3 px-4 text-slate-200">{trade.currentPrice}</td>
                      <td className="py-3 px-4 text-rose-400">{trade.stopLoss}</td>
                      <td className="py-3 px-4 text-emerald-400">{trade.takeProfit}</td>
                      <td className={`py-3 px-4 font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${trade.pnlCurrency.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onCloseTrade(trade.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 transition text-[11px]"
                        >
                          Close Order
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

      {/* Closed Positions History */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 text-xs uppercase text-slate-400 font-bold">
          Historical Closed Trades ({closedTrades.length})
        </div>

        <div className="overflow-x-auto max-h-[300px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-4">Instrument</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Entry</th>
                <th className="py-2.5 px-4">Exit</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Realized PnL</th>
                <th className="py-2.5 px-4">Execution Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {closedTrades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No closed paper trades recorded yet.
                  </td>
                </tr>
              ) : (
                closedTrades.map(trade => {
                  const isProfit = trade.pnlCurrency >= 0;
                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/20">
                      <td className="py-2.5 px-4 font-bold text-white">{trade.symbol}</td>
                      <td className="py-2.5 px-4 text-slate-300">{trade.direction}</td>
                      <td className="py-2.5 px-4 text-slate-300">{trade.entryPrice}</td>
                      <td className="py-2.5 px-4 text-slate-300">{trade.currentPrice}</td>
                      <td className="py-2.5 px-4 font-bold text-cyan-400">{trade.status}</td>
                      <td className={`py-2.5 px-4 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${trade.pnlCurrency.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{new Date(trade.timestamp).toLocaleTimeString()}</td>
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
