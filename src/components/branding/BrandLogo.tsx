import React from 'react';

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 42, showText = true }) => {
  return (
    <div className="flex items-center space-x-3 shrink-0">
      {/* Custom SVG Shield/Hexagon Emblem with Rising Institutional Chart Line */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_0_12px_rgba(0,210,255,0.4)]"
        aria-label="UMAR WITH TRADE Emblem"
      >
        <defs>
          <linearGradient id="uwt-shield-grad" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00d2ff" />
            <stop offset="52%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="uwt-chart-grad" x1="14" y1="42" x2="50" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00d2ff" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="uwt-fill-grad" x1="32" y1="18" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#060913" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Outer Hexagon Shield */}
        <path
          d="M32 3L57 16.5V37.5C57 49.2 46.2 57.6 32 61C17.8 57.6 7 49.2 7 37.5V16.5L32 3Z"
          fill="#060913"
          stroke="url(#uwt-shield-grad)"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />

        {/* Inner Technical Hex Frame */}
        <path
          d="M32 8.5L51.5 19.2V36.8C51.5 45.8 43 52.6 32 55.4C21 52.6 12.5 45.8 12.5 36.8V19.2L32 8.5Z"
          fill="url(#uwt-fill-grad)"
          stroke="#1e293b"
          strokeWidth="1.2"
        />

        {/* Rising Institutional Chart Trajectory */}
        <path
          d="M17 41L25.5 33L31.5 37.5L46 21"
          stroke="url(#uwt-chart-grad)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Breakout Arrow Tip */}
        <path
          d="M39.5 21H46V27.5"
          stroke="#fbbf24"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Subtle Liquidity Nodes */}
        <circle cx="17" cy="41" r="2.3" fill="#00d2ff" />
        <circle cx="25.5" cy="33" r="2.3" fill="#8b5cf6" />
        <circle cx="31.5" cy="37.5" r="2.3" fill="#a855f7" />
        <circle cx="46" cy="21" r="2.6" fill="#fbbf24" />
      </svg>

      {showText && (
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-black tracking-wider text-white font-mono">
              UMAR WITH TRADE
            </h1>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono font-bold border border-cyan-500/30">
              QUANT v4.0
            </span>
          </div>
          <p className="text-[10px] text-amber-400 font-mono uppercase tracking-widest hidden sm:block">
            THINK LIKE INSTITUTIONS. TRADE WITH INTELLIGENCE.
          </p>
        </div>
      )}
    </div>
  );
};
