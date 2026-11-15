import React, { useState, useEffect } from 'react';
import { MarketType } from '../../types/trading';
import { ICTEngine } from '../../services/ictEngine';
import { BrandLogo } from '../branding/BrandLogo';
import { useTheme } from '../../context/ThemeContext';
import { Clock, Wallet, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  currentMarket: MarketType;
  onMarketChange: (m: MarketType) => void;
  isLiveFeed: boolean;
  paperBalance: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentMarket,
  onMarketChange,
  isLiveFeed,
  paperBalance,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [timeUtc, setTimeUtc] = useState<string>('');
  const [timeNy, setTimeNy] = useState<string>('');
  const killzones = ICTEngine.getKillZones();
  const activeKZ = killzones.find(k => k.isActive);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + ' UTC');
      const nyDate = new Date(now.getTime() - 5 * 3600 * 1000);
      setTimeNy(nyDate.toUTCString().slice(17, 25) + ' EST');
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#060913]/95 border-b border-slate-800 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Section with Custom Shield/Hexagon SVG Logo */}
        <BrandLogo size={42} showText={true} />

        {/* Center: Live Institutional Market Clocks & Kill Zone */}
        <div className="hidden lg:flex items-center space-x-4 text-xs font-mono bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>NY: <span className="text-white font-bold">{timeNy}</span></span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="text-slate-400">
            <span>UTC: <span className="text-slate-200">{timeUtc}</span></span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-cyan-400 font-bold uppercase text-[11px]">
              {activeKZ ? `${activeKZ.name} Kill Zone` : 'Inter-Market Liquidity'}
            </span>
          </div>
        </div>

        {/* Right Section: Market Selector, Theme Toggle & Feed Status */}
        <div className="flex items-center space-x-2.5">
          {/* Market Tab Switcher */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => onMarketChange('crypto')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                currentMarket === 'crypto'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CRYPTO
            </button>
            <button
              onClick={() => onMarketChange('forex')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                currentMarket === 'forex'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              FOREX
            </button>
            <button
              onClick={() => onMarketChange('stock')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                currentMarket === 'stock'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              STOCKS
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Light/Dark Mode"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-500" />}
          </button>

          {/* Feed Status Badge */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border ${
              isLiveFeed
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLiveFeed ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span>{isLiveFeed ? 'LIVE FEED' : 'DEMO MODE'}</span>
          </div>

          {/* Paper Capital Badge */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Paper:</span>
            <span className="text-white font-bold">${paperBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
