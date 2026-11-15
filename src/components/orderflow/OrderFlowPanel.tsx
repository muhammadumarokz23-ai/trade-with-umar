import React, { useEffect, useRef, useState } from 'react';
import { MarketDataService, OrderFlowSnapshot } from '../../services/marketData';
import { MarketType } from '../../types/trading';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Layers,
  Radio,
  ShieldAlert,
  Waves,
} from 'lucide-react';

interface OrderFlowPanelProps {
  symbol: string;
  market: MarketType;
  onSnapshotUpdate?: (snap: OrderFlowSnapshot) => void;
}

interface HeatmapColumn {
  timestamp: number;
  bestBid: number;
  bestAsk: number;
  bids: Array<{ price: number; qty: number }>;
  asks: Array<{ price: number; qty: number }>;
  cvd: number;
}

export const OrderFlowPanel: React.FC<OrderFlowPanelProps> = ({
  symbol,
  market,
  onSnapshotUpdate,
}) => {
  const [snapshot, setSnapshot] = useState<OrderFlowSnapshot | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [history, setHistory] = useState<HeatmapColumn[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset history when symbol changes
  useEffect(() => {
    setHistory([]);
    let active = true;

    const loadInitial = async () => {
      const snap = await MarketDataService.fetchOrderFlow(symbol);
      if (!active) return;
      setSnapshot(snap);
      onSnapshotUpdate?.(snap);
      if (snap.isLive) {
        setHistory([
          {
            timestamp: snap.timestamp,
            bestBid: snap.bestBid,
            bestAsk: snap.bestAsk,
            bids: snap.bids,
            asks: snap.asks,
            cvd: snap.cumulativeDelta,
          },
        ]);
      }
    };

    loadInitial();

    // Live WebSocket stream to /ws/terminal
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/terminal`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setWsConnected(true);
        ws?.send(JSON.stringify({ type: 'subscribe', symbol }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'orderflow' && msg?.data?.symbol === symbol) {
            const snap: OrderFlowSnapshot = msg.data;
            setSnapshot(snap);
            onSnapshotUpdate?.(snap);
            if (snap.isLive) {
              setHistory((prev) => [
                ...prev.slice(-39),
                {
                  timestamp: snap.timestamp,
                  bestBid: snap.bestBid,
                  bestAsk: snap.bestAsk,
                  bids: snap.bids,
                  asks: snap.asks,
                  cvd: snap.cumulativeDelta,
                },
              ]);
            }
          }
        } catch {
          // Ignore malformed ws payload
        }
      };
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
    } catch {
      setWsConnected(false);
    }

    return () => {
      active = false;
      ws?.close();
    };
  }, [symbol, market]);

  // Draw Bookmap-style Liquidity Heatmap + Price Ribbon on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#050813';
    ctx.fillRect(0, 0, w, h);

    if (history.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        snapshot?.isLive === false
          ? snapshot.statusMessage || 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE'
          : 'Waiting for live L2 order book depth stream...',
        w / 2,
        h / 2
      );
      return;
    }

    // Determine price bounds across visible history
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxQty = 0.0001;

    for (const col of history) {
      for (const b of col.bids) {
        if (b.price < minPrice) minPrice = b.price;
        if (b.price > maxPrice) maxPrice = b.price;
        if (b.qty > maxQty) maxQty = b.qty;
      }
      for (const a of col.asks) {
        if (a.price < minPrice) minPrice = a.price;
        if (a.price > maxPrice) maxPrice = a.price;
        if (a.qty > maxQty) maxQty = a.qty;
      }
    }

    if (!Number.isFinite(minPrice) || maxPrice <= minPrice) return;
    const priceRange = maxPrice - minPrice;

    const cols = Math.max(history.length, 24);
    const colWidth = (w - 84) / cols;

    // Render grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 1;
    for (let g = 1; g < 5; g++) {
      const y = (h / 5) * g;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w - 80, y);
      ctx.stroke();

      const priceAtY = maxPrice - (priceRange * g) / 5;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(priceAtY.toFixed(priceAtY < 10 ? 4 : 2), w - 76, y + 3);
    }

    // Draw Heat Blocks
    history.forEach((col, cIdx) => {
      const x = cIdx * colWidth;
      const drawOrders = (orders: Array<{ price: number; qty: number }>, isBid: boolean) => {
        for (const o of orders) {
          const yNorm = 1 - (o.price - minPrice) / priceRange;
          const y = Math.max(2, Math.min(h - 6, yNorm * (h - 16) + 8));
          const intensity = Math.min(1, Math.pow(o.qty / maxQty, 0.6));
          if (intensity < 0.08) continue;

          if (intensity > 0.72) {
            // Institutional Liquidity Wall Highlight (Gold/Amber)
            ctx.fillStyle = `rgba(245, 158, 11, ${0.45 + intensity * 0.5})`;
          } else if (isBid) {
            ctx.fillStyle = `rgba(0, 210, 255, ${0.15 + intensity * 0.65})`;
          } else {
            ctx.fillStyle = `rgba(168, 85, 247, ${0.15 + intensity * 0.65})`;
          }
          ctx.fillRect(x, y - 3, Math.max(colWidth - 1, 4), 6);
        }
      };

      drawOrders(col.bids, true);
      drawOrders(col.asks, false);
    });

    // Draw Best Bid / Best Ask Line
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    history.forEach((col, cIdx) => {
      const x = cIdx * colWidth + colWidth / 2;
      const y = (1 - (col.bestBid - minPrice) / priceRange) * (h - 16) + 8;
      if (cIdx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = '#f43f5e';
    ctx.beginPath();
    history.forEach((col, cIdx) => {
      const x = cIdx * colWidth + colWidth / 2;
      const y = (1 - (col.bestAsk - minPrice) / priceRange) * (h - 16) + 8;
      if (cIdx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [history, snapshot]);

  const totalFlow = (snapshot?.buyInflow || 0) + (snapshot?.sellOutflow || 0);
  const buyPct = totalFlow > 0 ? ((snapshot?.buyInflow || 0) / totalFlow) * 100 : 50;

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <Waves className="w-5 h-5 text-cyan-400" />
            <span>REAL-TIME ORDER FLOW & BOOKMAP LIQUIDITY HEATMAP</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live Level-2 order book resting liquidity walls, aggressive trade delta, absorption, and volume spikes for {symbol}.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span
            className={`px-3 py-1.5 rounded-xl font-bold border flex items-center space-x-1.5 ${
              snapshot?.isLive
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{snapshot?.isLive ? (wsConnected ? 'WS STREAMING' : 'LIVE L2 FEED') : 'FEED UNAVAILABLE'}</span>
          </span>
        </div>
      </div>

      {/* Warning banner when unavailable */}
      {snapshot && !snapshot.isLive && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{snapshot.statusMessage}</span>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Buy Inflow</div>
          <div className="text-lg font-black text-emerald-400 mt-1">
            ${(snapshot?.buyInflow || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Aggressive market buys</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Sell Outflow</div>
          <div className="text-lg font-black text-rose-400 mt-1">
            ${(snapshot?.sellOutflow || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Aggressive market sells</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Cumulative Delta (CVD)</div>
          <div
            className={`text-lg font-black mt-1 ${
              (snapshot?.cumulativeDelta || 0) >= 0 ? 'text-cyan-400' : 'text-rose-400'
            }`}
          >
            {(snapshot?.cumulativeDelta || 0) >= 0 ? '+' : ''}
            {(snapshot?.cumulativeDelta || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Net institutional flow</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Bid / Ask Imbalance</div>
          <div
            className={`text-lg font-black mt-1 ${
              (snapshot?.bidAskImbalance || 0) >= 0 ? 'text-emerald-400' : 'text-purple-400'
            }`}
          >
            {((snapshot?.bidAskImbalance || 0) * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">L2 Resting Depth Ratio</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">Absorption & Spike</div>
          <div className="text-sm font-black text-amber-400 mt-1 truncate">
            {snapshot?.absorptionDetected !== 'NONE'
              ? snapshot?.absorptionDetected.replace('_', ' ')
              : snapshot?.volumeSpike
              ? `VOL SPIKE (${snapshot.volumeSpikeRatio}x)`
              : snapshot?.institutionalBias || 'NEUTRAL'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Ratio: {snapshot?.volumeSpikeRatio || 1}x avg trade
          </div>
        </div>
      </div>

      {/* Buy/Sell Aggression Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-emerald-400 font-bold">BUY PRESSURE ({buyPct.toFixed(1)}%)</span>
          <span className="text-slate-400">
            Institutional Bias:{' '}
            <span className="text-white font-bold">{snapshot?.institutionalBias || 'NEUTRAL'}</span>
          </span>
          <span className="text-rose-400 font-bold">SELL PRESSURE ({(100 - buyPct).toFixed(1)}%)</span>
        </div>
        <div className="w-full h-3 rounded-full bg-rose-950 overflow-hidden flex border border-slate-800">
          <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${buyPct}%` }} />
        </div>
      </div>

      {/* Bookmap-Style Heatmap Canvas */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-white flex items-center space-x-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>LIQUIDITY DEPTH HEATMAP (TIME × PRICE)</span>
          </div>
          <div className="flex items-center space-x-4 text-[10px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
              <span>Bid Depth</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              <span>Ask Depth</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
              <span>Institutional Wall</span>
            </span>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={920}
          height={280}
          className="w-full h-[260px] rounded-xl border border-slate-800 bg-[#050813]"
        />
      </div>

      {/* Resting Walls + Aggressive Tape */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bid Walls */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-cyan-400 uppercase flex items-center space-x-1.5">
            <ArrowUpRight className="w-4 h-4" />
            <span>Large Resting Bid Walls (Support)</span>
          </h3>
          <div className="space-y-2 text-xs">
            {!snapshot || snapshot.bidWalls.length === 0 ? (
              <div className="text-slate-500 py-4 text-center">No anomalous bid walls detected.</div>
            ) : (
              snapshot.bidWalls.map((w, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between"
                >
                  <span className="text-white font-bold">{w.price}</span>
                  <span className="text-cyan-400">{w.qty.toFixed(3)} units</span>
                  <span className="text-amber-400 font-bold">${w.notional.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ask Walls */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-purple-400 uppercase flex items-center space-x-1.5">
            <ArrowDownRight className="w-4 h-4" />
            <span>Large Resting Ask Walls (Resistance)</span>
          </h3>
          <div className="space-y-2 text-xs">
            {!snapshot || snapshot.askWalls.length === 0 ? (
              <div className="text-slate-500 py-4 text-center">No anomalous ask walls detected.</div>
            ) : (
              snapshot.askWalls.map((w, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30 flex items-center justify-between"
                >
                  <span className="text-white font-bold">{w.price}</span>
                  <span className="text-purple-400">{w.qty.toFixed(3)} units</span>
                  <span className="text-amber-400 font-bold">${w.notional.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Aggressive Trades */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-amber-400 uppercase flex items-center space-x-1.5">
            <Flame className="w-4 h-4" />
            <span>Live Aggressive Tape (aggTrade)</span>
          </h3>
          <div className="space-y-1.5 text-[11px] max-h-[210px] overflow-y-auto pr-1">
            {!snapshot || snapshot.recentTrades.length === 0 ? (
              <div className="text-slate-500 py-4 text-center">Awaiting aggressive trade prints...</div>
            ) : (
              snapshot.recentTrades.slice(0, 12).map((t, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                >
                  <span className={t.side === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {t.side}
                  </span>
                  <span className="text-slate-200">{t.price}</span>
                  <span className="text-slate-400">{t.qty.toFixed(4)}</span>
                  <span className="text-slate-500">{new Date(t.time).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
