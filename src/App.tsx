import React, { useState, useEffect } from 'react';
import {
  Candle,
  InstrumentInfo,
  MarketTicker,
  MarketType,
  SignalCard,
  Timeframe,
} from './types/trading';
import { SUPPORTED_INSTRUMENTS, getInstrument, getInstrumentsByMarket } from './services/instruments';
import { MarketDataService } from './services/marketData';
import { ConfluenceEngine } from './services/confluenceEngine';
import { Header } from './components/dashboard/Header';
import { Sidebar, NavSection } from './components/dashboard/Sidebar';
import { MarketOverview } from './components/dashboard/MarketOverview';
import { ThreeTerminalHero } from './components/terminal/ThreeTerminalHero';
import { TradingViewChart } from './components/charts/TradingViewChart';
import { SignalCardComponent } from './components/signals/SignalCardComponent';
import { MarketScanner } from './components/scanner/MarketScanner';
import { SMCAnalysisView } from './components/smc/SMCAnalysisView';
import { ICTAnalysisView } from './components/ict/ICTAnalysisView';
import { CRTAnalysisView } from './components/crt/CRTAnalysisView';
import { RiskCalculatorView } from './components/risk/RiskCalculatorView';
import { BacktestingView } from './components/backtesting/BacktestingView';
import { TradeHistoryView, PaperTradeRecord } from './components/history/TradeHistoryView';
import { GeminiAssistantView } from './components/gemini/GeminiAssistantView';
import { MultiTimeframeView } from './components/mtf/MultiTimeframeView';
import { SettingsView } from './components/settings/SettingsView';
import { AgentMeetingRooms3D } from './components/terminal/AgentMeetingRooms3D';
import { OrderFlowPanel } from './components/orderflow/OrderFlowPanel';
import { BackgroundLayer } from './components/background/BackgroundLayer';
import {
  Bot,
  Layers,
  Compass,
  Box,
  Zap,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Flame,
} from 'lucide-react';

export default function App() {
  // Navigation & Market State
  const [currentSection, setCurrentSection] = useState<NavSection>('home');
  const [currentMarket, setCurrentMarket] = useState<MarketType>('crypto');
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSDT');
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('15m');

  // Market Data & Tickers
  const [candles, setCandles] = useState<Candle[]>([]);
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [isLiveFeed, setIsLiveFeed] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to Institutional Stream...');
  const [loadingCandles, setLoadingCandles] = useState<boolean>(true);

  // Paper Trading State
  const [paperBalance, setPaperBalance] = useState<number>(100000);
  const [activeTrades, setActiveTrades] = useState<PaperTradeRecord[]>([]);
  const [closedTrades, setClosedTrades] = useState<PaperTradeRecord[]>([]);

  // Confluence Analysis Result
  const [analysisResult, setAnalysisResult] = useState<ReturnType<typeof ConfluenceEngine.analyze> | null>(null);

  const currentInstrument: InstrumentInfo = getInstrument(activeSymbol);

  // 1. Fetch Market Tickers periodically
  useEffect(() => {
    let isMounted = true;
    const fetchTickers = async () => {
      try {
        const data = await MarketDataService.fetchTickers();
        if (isMounted) setTickers(data);
      } catch (err) {
        console.warn('Ticker update error:', err);
      }
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Fetch Candles & Order Flow, then Run Confluence Engine whenever Symbol or Timeframe changes
  const loadMarketData = async () => {
    setLoadingCandles(true);
    try {
      const [response, orderFlowSnap] = await Promise.all([
        MarketDataService.fetchCandles(activeSymbol, currentMarket, activeTimeframe, 140),
        MarketDataService.fetchOrderFlow(activeSymbol),
      ]);

      setCandles(response.candles);
      setIsLiveFeed(response.isLiveFeed);
      setStatusMessage(response.statusMessage);

      // Run Confluence Engine immediately (strictly passes isLiveFeed & orderFlow conflict gate)
      const result = ConfluenceEngine.analyze(currentInstrument, response.candles, activeTimeframe, {
        isLiveFeed: response.isLiveFeed,
        orderFlow: orderFlowSnap,
      });
      setAnalysisResult(result);
    } catch (err) {
      console.error('Failed to load market candles:', err);
    } finally {
      setLoadingCandles(false);
    }
  };

  useEffect(() => {
    loadMarketData();
  }, [activeSymbol, activeTimeframe, currentMarket]);

  // Handle Switching Instrument
  const handleSelectInstrument = (symbol: string, market: MarketType) => {
    setActiveSymbol(symbol);
    setCurrentMarket(market);
  };

  // Handle Paper Trade Execution
  const handleExecutePaperTrade = (signal: SignalCard) => {
    const isBuy = signal.direction.includes('BUY');
    const newTrade: PaperTradeRecord = {
      id: `PTR-${signal.symbol}-${Date.now().toString().slice(-4)}`,
      symbol: signal.symbol,
      market: signal.market,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      currentPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.tp1,
      lotSize: signal.market === 'forex' ? 1.0 : signal.market === 'crypto' ? 0.25 : 50,
      pnlCurrency: 0,
      status: 'OPEN',
      timestamp: Date.now(),
    };

    setActiveTrades(prev => [newTrade, ...prev]);
    setCurrentSection('history');
  };

  const handleCloseTrade = (tradeId: string) => {
    const trade = activeTrades.find(t => t.id === tradeId);
    if (!trade) return;

    const closed = { ...trade, status: 'CLOSED_MANUAL' as const };
    setClosedTrades(prev => [closed, ...prev]);
    setActiveTrades(prev => prev.filter(t => t.id !== tradeId));
    setPaperBalance(prev => prev + trade.pnlCurrency);
  };

  const handleEmergencyCloseAll = () => {
    const closed = activeTrades.map(t => ({ ...t, status: 'CLOSED_MANUAL' as const }));
    const totalPnl = activeTrades.reduce((acc, t) => acc + t.pnlCurrency, 0);
    setClosedTrades(prev => [...closed, ...prev]);
    setActiveTrades([]);
    setPaperBalance(prev => prev + totalPnl);
  };

  const activeSignal = analysisResult?.signal || null;

  return (
    <div className="uwt-shell min-h-screen bg-transparent text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950 font-sans transition-colors duration-200">
      <BackgroundLayer />
      {/* Top Header */}
      <Header
        currentMarket={currentMarket}
        onMarketChange={m => {
          setCurrentMarket(m);
          const firstInMarket = getInstrumentsByMarket(m)[0];
          if (firstInMarket) setActiveSymbol(firstInMarket.symbol);
        }}
        isLiveFeed={isLiveFeed}
        paperBalance={paperBalance}
      />

      {/* Demo Mode Notification Banner if offline/unreachable */}
      {!isLiveFeed && (
        <div className="bg-amber-950/80 border-b border-amber-500/40 px-4 py-2 text-center text-xs font-mono text-amber-300 flex items-center justify-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold">DEMO MODE - LIVE MARKET DATA UNAVAILABLE.</span>
          <span className="text-amber-200/80 hidden sm:inline">
            No live signals generated for {activeSymbol}. Live signal generation requires an active exchange feed.
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentSection={currentSection}
          onSelectSection={sec => {
            setCurrentSection(sec);
            // Quick market routing
            if (sec === 'crypto') setCurrentMarket('crypto');
            if (sec === 'forex') setCurrentMarket('forex');
            if (sec === 'stocks') setCurrentMarket('stock');
          }}
          activeSignalCount={analysisResult && analysisResult.signal.direction !== 'WAIT' ? 1 : 0}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Quick Market Overview Cards Bar */}
          <MarketOverview
            instruments={getInstrumentsByMarket(currentMarket)}
            tickers={tickers}
            selectedSymbol={activeSymbol}
            onSelectInstrument={handleSelectInstrument}
          />

          {/* VIEW ROUTING */}
          {/* 1. HOME DASHBOARD */}
          {currentSection === 'home' && (
            <div className="space-y-6">
              {/* 3D AI Robot Terminal Hero */}
              <ThreeTerminalHero
                currentMarket={currentMarket}
                activeSymbol={activeSymbol}
                signalDirection={activeSignal ? activeSignal.direction : 'SCANNING'}
                confidenceScore={activeSignal ? activeSignal.confidenceScore : 82}
              />

              {/* Chart & Active Signal Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <TradingViewChart
                    symbol={activeSymbol}
                    timeframe={activeTimeframe}
                    onTimeframeChange={setActiveTimeframe}
                    candles={candles}
                    signal={activeSignal}
                    smcData={analysisResult?.smc}
                    crtData={analysisResult?.crt}
                    isLiveFeed={isLiveFeed}
                  />
                </div>

                <div>
                  {activeSignal ? (
                    <SignalCardComponent
                      signal={activeSignal}
                      onExecutePaperTrade={handleExecutePaperTrade}
                      onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
                    />
                  ) : (
                    <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center font-mono text-slate-500">
                      Loading institutional confluence signal...
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Launch Cards for 5-Agent 3D War Room & Bookmap Order Flow */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                <button
                  onClick={() => setCurrentSection('warroom')}
                  className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-purple-950/40 to-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-left transition shadow-xl"
                >
                  <div className="text-xs font-bold text-cyan-400 uppercase">Multi-Agent Institutional Desk</div>
                  <div className="text-base font-black text-white mt-1">Launch 5-Agent 3D War Room &amp; Meeting</div>
                  <p className="text-xs text-slate-400 mt-1">
                    Watch News, Market Analyst, Smart Money, Scanner, and Manager cartoon agents convene live.
                  </p>
                </button>
                <button
                  onClick={() => setCurrentSection('orderflow')}
                  className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-amber-950/30 to-slate-900 border border-purple-500/40 hover:border-purple-400 text-left transition shadow-xl"
                >
                  <div className="text-xs font-bold text-amber-400 uppercase">Level-2 Institutional Depth</div>
                  <div className="text-base font-black text-white mt-1">Open Bookmap-Style Order Flow Heatmap</div>
                  <p className="text-xs text-slate-400 mt-1">
                    Inspect live buy inflow, sell outflow, cumulative delta, liquidity walls &amp; absorption.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* 1B. 5-AGENT 3D WAR ROOM */}
          {currentSection === 'warroom' && (
            <AgentMeetingRooms3D
              instrument={currentInstrument}
              timeframe={activeTimeframe}
              onSelectInstrument={handleSelectInstrument}
              onExecutePaperTrade={handleExecutePaperTrade}
              onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
            />
          )}

          {/* 1C. REAL-TIME ORDER FLOW HEATMAP */}
          {currentSection === 'orderflow' && (
            <OrderFlowPanel
              symbol={activeSymbol}
              market={currentMarket}
            />
          )}

          {/* 2. CRYPTO TRADING */}
          {currentSection === 'crypto' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-900 border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white font-mono">CRYPTOCURRENCY INSTITUTIONAL DESK</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    24/7 Liquidity scanning, high-beta order flow, funding rate awareness, and Binance WebSocket feeds.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                  24/7 OPEN
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <TradingViewChart
                    symbol={activeSymbol}
                    timeframe={activeTimeframe}
                    onTimeframeChange={setActiveTimeframe}
                    candles={candles}
                    signal={activeSignal}
                    smcData={analysisResult?.smc}
                    crtData={analysisResult?.crt}
                    isLiveFeed={isLiveFeed}
                  />
                </div>
                <div>
                  {activeSignal && (
                    <SignalCardComponent
                      signal={activeSignal}
                      onExecutePaperTrade={handleExecutePaperTrade}
                      onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. FOREX TRADING */}
          {currentSection === 'forex' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/30 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white font-mono">FOREX & COMMODITIES INSTITUTIONAL DESK</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    London Open & NY Kill Zone execution, Gold/Silver liquidity sweeps, and pip spread protection.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-500/40">
                  INTER-BANK LIQUIDITY
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <TradingViewChart
                    symbol={activeSymbol}
                    timeframe={activeTimeframe}
                    onTimeframeChange={setActiveTimeframe}
                    candles={candles}
                    signal={activeSignal}
                    smcData={analysisResult?.smc}
                    crtData={analysisResult?.crt}
                    isLiveFeed={isLiveFeed}
                  />
                </div>
                <div>
                  {activeSignal && (
                    <SignalCardComponent
                      signal={activeSignal}
                      onExecutePaperTrade={handleExecutePaperTrade}
                      onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. STOCK TRADING */}
          {currentSection === 'stocks' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white font-mono">US EQUITIES & ETFS INSTITUTIONAL DESK</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    NASDAQ/NYSE opening range breakouts, Silver Bullet 10-11 AM setups, and institutional gap analysis.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-500/40">
                  SESSION-SYNCED
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <TradingViewChart
                    symbol={activeSymbol}
                    timeframe={activeTimeframe}
                    onTimeframeChange={setActiveTimeframe}
                    candles={candles}
                    signal={activeSignal}
                    smcData={analysisResult?.smc}
                    crtData={analysisResult?.crt}
                    isLiveFeed={isLiveFeed}
                  />
                </div>
                <div>
                  {activeSignal && (
                    <SignalCardComponent
                      signal={activeSignal}
                      onExecutePaperTrade={handleExecutePaperTrade}
                      onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. UNIVERSAL SCANNER */}
          {currentSection === 'scanner' && (
            <MarketScanner
              onSelectInstrument={(sym, mkt) => {
                handleSelectInstrument(sym, mkt);
                setCurrentSection('charts');
              }}
              onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
            />
          )}

          {/* 6. LIVE TRADING CHARTS */}
          {currentSection === 'charts' && (
            <div className="space-y-6">
              <TradingViewChart
                symbol={activeSymbol}
                timeframe={activeTimeframe}
                onTimeframeChange={setActiveTimeframe}
                candles={candles}
                signal={activeSignal}
                smcData={analysisResult?.smc}
                crtData={analysisResult?.crt}
                isLiveFeed={isLiveFeed}
              />

              {activeSignal && (
                <SignalCardComponent
                  signal={activeSignal}
                  onExecutePaperTrade={handleExecutePaperTrade}
                  onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
                />
              )}
            </div>
          )}

          {/* 7. SMC ANALYSIS */}
          {currentSection === 'smc' && analysisResult && (
            <SMCAnalysisView
              instrument={currentInstrument}
              candles={candles}
              smc={analysisResult.smc}
            />
          )}

          {/* 8. ICT ANALYSIS */}
          {currentSection === 'ict' && analysisResult && (
            <ICTAnalysisView
              instrument={currentInstrument}
              ict={analysisResult.ict}
            />
          )}

          {/* 9. CRT ANALYSIS */}
          {currentSection === 'crt' && analysisResult && (
            <CRTAnalysisView
              instrument={currentInstrument}
              candles={candles}
              crt={analysisResult.crt}
            />
          )}

          {/* 10. AI SIGNAL CENTER */}
          {currentSection === 'signals' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white font-mono flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span>AI SIGNAL COMMAND CENTER</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    High-confluence 100-point validated signals with deterministic Stop Loss and 1:2+ R:R minimums.
                  </p>
                </div>
              </div>

              {activeSignal && (
                <SignalCardComponent
                  signal={activeSignal}
                  onExecutePaperTrade={handleExecutePaperTrade}
                  onRequestGeminiDeepDive={() => setCurrentSection('assistant')}
                />
              )}

              <MarketScanner
                onSelectInstrument={(sym, mkt) => {
                  handleSelectInstrument(sym, mkt);
                }}
              />
            </div>
          )}

          {/* 11. MULTI-TIMEFRAME ANALYSIS */}
          {currentSection === 'mtf' && (
            <MultiTimeframeView
              instrument={currentInstrument}
              activeTimeframe={activeTimeframe}
              onSelectTimeframe={setActiveTimeframe}
              macroBias={analysisResult?.ict.macroBias || 'NEUTRAL'}
            />
          )}

          {/* 12. RISK MANAGEMENT */}
          {currentSection === 'risk' && (
            <RiskCalculatorView
              instrument={currentInstrument}
              currentPrice={candles.length > 0 ? candles[candles.length - 1].close : 100}
            />
          )}

          {/* 13. BACKTESTING */}
          {currentSection === 'backtest' && (
            <BacktestingView
              instrument={currentInstrument}
              candles={candles}
            />
          )}

          {/* 14. TRADE HISTORY */}
          {currentSection === 'history' && (
            <TradeHistoryView
              paperBalance={paperBalance}
              activeTrades={activeTrades}
              closedTrades={closedTrades}
              onCloseTrade={handleCloseTrade}
              onEmergencyCloseAll={handleEmergencyCloseAll}
            />
          )}

          {/* 15. AI TRADING ASSISTANT (GEMINI) */}
          {currentSection === 'assistant' && (
            <GeminiAssistantView
              instrument={currentInstrument}
              timeframe={activeTimeframe}
              signal={activeSignal}
            />
          )}

          {/* 16. SETTINGS & APIS */}
          {currentSection === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
