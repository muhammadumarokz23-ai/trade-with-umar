import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  Time,
} from 'lightweight-charts';
import { Candle, SignalCard, Timeframe } from '../../types/trading';
import { Eye, Layers, TrendingUp, ShieldAlert, Target } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  candles: Candle[];
  signal?: SignalCard | null;
  smcData?: {
    orderBlocks: Array<{ high: number; low: number; direction: string; mitigated: boolean }>;
    fvgs: Array<{ top: number; bottom: number; direction: string; filled: boolean; consequentEncroachment: number }>;
    breaks: Array<{ type: string; direction: string; breakPrice: number }>;
  };
  crtData?: {
    motherCandle?: { crh: number; crl: number; crm: number };
    type?: string;
  };
  isLiveFeed: boolean;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  timeframe,
  onTimeframeChange,
  candles,
  signal,
  smcData,
  crtData,
  isLiveFeed,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Overlay toggles
  const [showSMC, setShowSMC] = useState(true);
  const [showCRT, setShowCRT] = useState(true);
  const [showSignals, setShowSignals] = useState(true);

  // Timeframe list
  const timeframes: Timeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: '#080d1a' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
      },
      crosshair: {
        vertLine: { color: '#00d2ff', width: 1, style: 3, labelBackgroundColor: '#0f172a' },
        horzLine: { color: '#00d2ff', width: 1, style: 3, labelBackgroundColor: '#0f172a' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay directly on bottom margin
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // 2. Update Candle & Volume Data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }

    // Filter duplicates and sort chronologically
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const uniqueCandles: Candle[] = [];
    const seenTimes = new Set<number>();

    for (const c of sorted) {
      if (!seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        uniqueCandles.push(c);
      }
    }

    const formattedCandles = uniqueCandles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const formattedVolumes = uniqueCandles.map(c => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
    }));

    candleSeriesRef.current.setData(formattedCandles);
    volumeSeriesRef.current.setData(formattedVolumes);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  // 3. Render SMC, CRT, and Signal Execution Overlays
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    // Clear existing price lines
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        // Line already removed
      }
    }
    priceLinesRef.current = [];

    // Overlay 1: Signal Execution (Entry, SL, TP1, TP2, TP3)
    if (showSignals && signal && signal.direction !== 'WAIT' && signal.entryPrice > 0) {
      const entryLine = series.createPriceLine({
        price: signal.entryPrice,
        color: '#00d2ff',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: `ENTRY (${signal.direction})`,
      });
      priceLinesRef.current.push(entryLine);

      const slLine = series.createPriceLine({
        price: signal.stopLoss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'STOP LOSS',
      });
      priceLinesRef.current.push(slLine);

      const tp1Line = series.createPriceLine({
        price: signal.tp1,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP1 (1:2 R:R)',
      });
      priceLinesRef.current.push(tp1Line);

      const tp2Line = series.createPriceLine({
        price: signal.tp2,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP2 (1:3.5 R:R)',
      });
      priceLinesRef.current.push(tp2Line);
    }

    // Overlay 2: SMC Order Blocks & FVGs
    if (showSMC && smcData) {
      // Order block nearest unmitigated
      const activeOB = smcData.orderBlocks.find(o => !o.mitigated);
      if (activeOB) {
        const obHighLine = series.createPriceLine({
          price: activeOB.high,
          color: activeOB.direction === 'bullish' ? '#8b5cf6' : '#f59e0b',
          lineWidth: 1,
          lineStyle: 1, // Dotted
          axisLabelVisible: true,
          title: `${activeOB.direction.toUpperCase()} OB TOP`,
        });
        const obLowLine = series.createPriceLine({
          price: activeOB.low,
          color: activeOB.direction === 'bullish' ? '#8b5cf6' : '#f59e0b',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `${activeOB.direction.toUpperCase()} OB BOTTOM`,
        });
        priceLinesRef.current.push(obHighLine, obLowLine);
      }

      // Fresh Fair Value Gap
      const freshFvg = smcData.fvgs.find(f => !f.filled);
      if (freshFvg) {
        const ceLine = series.createPriceLine({
          price: freshFvg.consequentEncroachment,
          color: '#ec4899',
          lineWidth: 1,
          lineStyle: 3, // Large dashed
          axisLabelVisible: true,
          title: `FVG C.E. (50%)`,
        });
        priceLinesRef.current.push(ceLine);
      }
    }

    // Overlay 3: CRT Mother Candle High / Low / Midpoint
    if (showCRT && crtData?.motherCandle && crtData.motherCandle.crh > 0) {
      const crh = series.createPriceLine({
        price: crtData.motherCandle.crh,
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'CRH (Range High)',
      });
      const crl = series.createPriceLine({
        price: crtData.motherCandle.crl,
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'CRL (Range Low)',
      });
      const crm = series.createPriceLine({
        price: crtData.motherCandle.crm,
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'CRM (Midpoint 50%)',
      });
      priceLinesRef.current.push(crh, crl, crm);
    }
  }, [signal, smcData, crtData, showSMC, showCRT, showSignals]);

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const firstPrice = candles.length > 0 ? candles[0].open : lastPrice;
  const priceChange = lastPrice - firstPrice;
  const priceChangePct = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  return (
    <div className="flex flex-col w-full bg-[#080d1a] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Chart Top Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60 gap-3">
        {/* Left: Symbol & Live Status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-base font-extrabold text-white font-mono tracking-tight">{symbol}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
              isLiveFeed ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950 text-amber-400 border border-amber-500/30'
            }`}>
              {isLiveFeed ? 'LIVE MARKET FEED' : 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE'}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-slate-100 font-semibold">{lastPrice.toLocaleString()}</span>
            <span className={`font-bold ${priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Center: Timeframe Pills */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                timeframe === tf
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Right: Overlay Toggles */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSMC(!showSMC)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center space-x-1 transition ${
              showSMC
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle Smart Money Concepts (OB, FVG, BOS)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SMC Overlay</span>
          </button>

          <button
            onClick={() => setShowCRT(!showCRT)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center space-x-1 transition ${
              showCRT
                ? 'bg-sky-950/80 text-sky-300 border-sky-500/50'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle Candle Range Theory (CRH, CRL, CRM)"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>CRT Range</span>
          </button>

          <button
            onClick={() => setShowSignals(!showSignals)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center space-x-1 transition ${
              showSignals
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle Active Signal Entry, SL, TP lines"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Execution Levels</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full min-h-[480px]">
        <div ref={chartContainerRef} className="w-full min-h-[480px]" />
        {candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080d1a]/85 pointer-events-none">
            <div className="px-5 py-3 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-xs text-center">
              DEMO MODE - LIVE MARKET DATA UNAVAILABLE ({symbol}) — No fabricated candles rendered.
            </div>
          </div>
        )}
      </div>

      {/* Institutional Legend Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] font-mono text-slate-400 gap-2">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
            <span>Bullish Flow</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
            <span>Bearish Flow</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-0.5 bg-purple-400"></span>
            <span>Order Block (OB)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-0.5 bg-pink-400"></span>
            <span>FVG C.E. (50%)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-0.5 bg-sky-400"></span>
            <span>CRT High/Low</span>
          </span>
        </div>

        <div className="text-slate-500">
          TradingView Engine • Non-Repainting Institutional Feeds
        </div>
      </div>
    </div>
  );
};
