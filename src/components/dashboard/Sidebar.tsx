import React from 'react';
import {
  LayoutDashboard,
  Coins,
  DollarSign,
  TrendingUp,
  Search,
  LineChart,
  Layers,
  Compass,
  Box,
  Zap,
  Clock,
  ShieldAlert,
  Activity,
  History,
  Bot,
  Settings,
  Waves,
  Users,
} from 'lucide-react';

export type NavSection =
  | 'home'
  | 'warroom'
  | 'orderflow'
  | 'crypto'
  | 'forex'
  | 'stocks'
  | 'scanner'
  | 'charts'
  | 'smc'
  | 'ict'
  | 'crt'
  | 'signals'
  | 'mtf'
  | 'risk'
  | 'backtest'
  | 'history'
  | 'assistant'
  | 'settings';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  activeSignalCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  activeSignalCount = 3,
}) => {
  const navItems: Array<{ id: NavSection; label: string; icon: React.FC<any>; badge?: string | number; group: string }> = [
    // Terminal Core
    { id: 'home', label: '1. 3D AI Home Dashboard', icon: LayoutDashboard, group: 'Terminal & Markets' },
    { id: 'warroom', label: '5-Agent 3D War Room', icon: Users, badge: '5 AI', group: 'Terminal & Markets' },
    { id: 'orderflow', label: 'Bookmap Order Flow', icon: Waves, badge: 'L2', group: 'Terminal & Markets' },
    { id: 'crypto', label: '2. Crypto Trading', icon: Coins, group: 'Terminal & Markets' },
    { id: 'forex', label: '3. Forex Trading', icon: DollarSign, group: 'Terminal & Markets' },
    { id: 'stocks', label: '4. Stock Trading', icon: TrendingUp, group: 'Terminal & Markets' },

    // Institutional Engines
    { id: 'scanner', label: '5. Universal Market Scanner', icon: Search, badge: 'AUTO', group: 'Analysis & Signals' },
    { id: 'charts', label: '6. Live Trading Charts', icon: LineChart, group: 'Analysis & Signals' },
    { id: 'smc', label: '7. SMC Analysis', icon: Layers, group: 'Analysis & Signals' },
    { id: 'ict', label: '8. ICT Analysis', icon: Compass, group: 'Analysis & Signals' },
    { id: 'crt', label: '9. CRT Analysis', icon: Box, group: 'Analysis & Signals' },
    { id: 'signals', label: '10. AI Signal Center', icon: Zap, badge: activeSignalCount, group: 'Analysis & Signals' },
    { id: 'mtf', label: '11. Multi-Timeframe Analysis', icon: Clock, group: 'Analysis & Signals' },

    // Quant Execution & Intelligence
    { id: 'risk', label: '12. Risk Management', icon: ShieldAlert, group: 'Execution & Settings' },
    { id: 'backtest', label: '13. Backtesting', icon: Activity, group: 'Execution & Settings' },
    { id: 'history', label: '14. Trade History', icon: History, group: 'Execution & Settings' },
    { id: 'assistant', label: '15. AI Trading Assistant', icon: Bot, badge: 'GEMINI', group: 'Execution & Settings' },
    { id: 'settings', label: '16. Settings & API Connections', icon: Settings, group: 'Execution & Settings' },
  ];

  const groups = ['Terminal & Markets', 'Analysis & Signals', 'Execution & Settings'];

  return (
    <aside className="w-64 bg-[#060913] border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-72px)] font-mono">
      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        {groups.map(grp => {
          const items = navItems.filter(i => i.group === grp);
          return (
            <div key={grp} className="space-y-1.5">
              <div className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {grp}
              </div>
              <div className="space-y-1">
                {items.map(item => {
                  const Icon = item.icon;
                  const isActive = currentSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectSection(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left ${
                        isActive
                          ? 'bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-500/40 shadow-lg shadow-cyan-950/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge != null && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                            typeof item.badge === 'number'
                              ? 'bg-amber-500 text-slate-950'
                              : item.badge === 'GEMINI'
                              ? 'bg-purple-900 text-purple-200'
                              : 'bg-cyan-900 text-cyan-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sentinel Status */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span className="font-bold text-slate-300">UMAR SENTINEL v3.8</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">SMC • ICT • CRT Engines Active</div>
      </div>
    </aside>
  );
};
