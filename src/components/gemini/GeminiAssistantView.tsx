import React, { useState } from 'react';
import { InstrumentInfo, SignalCard, Timeframe } from '../../types/trading';
import { Sparkles, Send, Bot, RefreshCw, Cpu, HelpCircle, Shield, AlertCircle } from 'lucide-react';

interface GeminiAssistantViewProps {
  instrument: InstrumentInfo;
  timeframe: Timeframe;
  signal?: SignalCard | null;
}

export const GeminiAssistantView: React.FC<GeminiAssistantViewProps> = ({
  instrument,
  timeframe,
  signal,
}) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; timestamp: number }>>([
    {
      role: 'assistant',
      text: `Greetings. I am UMAR WITH TRADE's Institutional Quantitative Analyst, operating via Google Gemini 3.8.
I am actively monitoring ${instrument.symbol} (${instrument.market.toUpperCase()}) on the ${timeframe} timeframe.
Current Confluence Signal: ${signal?.direction || 'WAIT'} (Score: ${signal?.confidenceScore || 0}/100).

How may I assist your institutional execution or market structure analysis?`,
      timestamp: Date.now(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    `Explain the current market structure for ${instrument.symbol}`,
    `Why is the current confluence score ${signal?.confidenceScore || 0}/100?`,
    `Identify the invalidation criteria for this ${signal?.direction || 'setup'}`,
    `Evaluate ICT Killzone & Silver Bullet timing right now`,
    `Explain the Candle Range Theory (CRT) boundaries on ${timeframe}`,
  ];

  const handleSendMessage = async (promptToSend?: string) => {
    const text = promptToSend || inputPrompt;
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user' as const, text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: instrument.symbol,
          market: instrument.market,
          timeframe,
          signal,
          userPrompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const assistantMsg = {
        role: 'assistant' as const,
        text: data.analysis || 'Analysis compiled successfully.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant' as const,
          text: `UMAR WITH TRADE System Notice: Unable to query Gemini API (${err.message || 'Network delay'}). The deterministic algorithm continues to operate with Confluence Score: ${signal?.confidenceScore || 0}/100.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[680px] rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl overflow-hidden font-mono">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>GEMINI 3.8 AI QUANTITATIVE ADVISOR</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                ACTIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Institutional breakdown of SMC, ICT, and CRT price action for {instrument.symbol}
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-500 text-[10px] block">SIGNAL</span>
          <span className="text-cyan-400 font-bold">{signal?.direction || 'WAIT'}</span>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto text-xs">
        <span className="text-slate-500 text-[10px] shrink-0 uppercase">Quick Inquiries:</span>
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(qp)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 shrink-0 text-[11px] transition"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shrink-0 text-cyan-400 mt-0.5">
                <Cpu className="w-4 h-4" />
              </div>
            )}

            <div
              className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
              <div className="text-[9px] text-slate-400 mt-1.5 text-right">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center space-x-3 text-cyan-400">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
              Synthesizing institutional market structure and liquidity footprint...
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={e => setInputPrompt(e.target.value)}
            placeholder={`Ask Gemini about ${instrument.symbol} Order Blocks, Killzones, or Invalidation levels...`}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition flex items-center space-x-1.5"
          >
            <span>Analyze</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
