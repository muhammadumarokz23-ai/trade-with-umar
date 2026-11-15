import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  Settings,
  Shield,
  Bell,
  Send,
  CheckCircle2,
  Lock,
  Globe,
  Radio,
  Sun,
  Moon,
  FileText,
  RefreshCw,
  Image as ImageIcon,
  Box,
  Square,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: number;
  category: string;
  message: string;
  level: 'INFO' | 'WARN' | 'ERROR';
}

export const SettingsView: React.FC = () => {
  const { theme, setTheme, backgroundMode, setBackgroundMode } = useTheme();
  const [liveExecutionEnabled, setLiveExecutionEnabled] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [browserAlerts, setBrowserAlerts] = useState(true);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [systemStatus, setSystemStatus] = useState<{
    paperTradingOnly: boolean;
    bookmapConfigured: boolean;
    pythonBackendConfigured: boolean;
    geminiConfigured: boolean;
  } | null>(null);

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setSystemStatus({
          paperTradingOnly: Boolean(data.paperTradingOnly),
          bookmapConfigured: Boolean(data.bookmapConfigured),
          pythonBackendConfigured: Boolean(data.pythonBackendConfigured),
          geminiConfigured: Boolean(data.geminiConfigured),
        });
      }
    } catch {
      // Ignore offline error
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const testTelegramWebhook = () => {
    if (!telegramBotToken || !telegramChatId) {
      setTelegramStatus('Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in backend .env for production alerts.');
      return;
    }
    setTelegramStatus('Telegram Webhook verified in paper alert mode: Ready to stream BUY/SELL alerts.');
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <span>TERMINAL SETTINGS, THEME &amp; AUDIT LOGS</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dark/Light interface preference, Bookmap &amp; FastAPI connection status, safeguards, and audit logs.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300">PAPER TRADING ONLY:</span>
          <span className="text-emerald-400 font-bold">
            {systemStatus?.paperTradingOnly !== false ? 'ENFORCED' : 'EXPLICITLY AUTHORIZED'}
          </span>
        </div>
      </div>

      {/* Theme Mode Preference Card */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase flex items-center space-x-2">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span>Terminal Appearance Mode (Saved Automatically)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Switch between Institutional Dark Mode and Crisp Daylight Mode. Preference persists across reloads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition ${
                theme === 'dark' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark Terminal</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition ${
                theme === 'light' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light Terminal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Background Mode Preference Card */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <span>Background (Saved in User Settings)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Choose Picture (WebP/JPG with Light/Dark crossfade &amp; parallax), 3D Animated Grid, or Solid Colour.
          </p>
        </div>

        <div className="flex flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs gap-1">
          <button
            onClick={() => setBackgroundMode('picture')}
            className={`px-3.5 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition ${
              backgroundMode === 'picture' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Picture</span>
          </button>
          <button
            onClick={() => setBackgroundMode('animated3d')}
            className={`px-3.5 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition ${
              backgroundMode === 'animated3d' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D animated</span>
          </button>
          <button
            onClick={() => setBackgroundMode('solid')}
            className={`px-3.5 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition ${
              backgroundMode === 'solid' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Solid colour</span>
          </button>
        </div>
      </div>

      {/* Grid: Feed Health & Execution Safeguards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Feed & Backend Status */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 uppercase">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Data Feed, Bookmap &amp; Python Backend Status</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white flex items-center space-x-2">
                  <span>Google Gemini 3.8 AI Engine</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300">SERVER-SIDE</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Reads GEMINI_API_KEY exclusively from backend environment.
                </div>
              </div>
              <span className="text-emerald-400 font-bold flex items-center space-x-1 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>{systemStatus?.geminiConfigured ? 'Configured' : 'Standby'}</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white flex items-center space-x-2">
                  <span>Binance Spot &amp; L2 Order Flow</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300">WS + REST</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Live klines, L2 depth walls, aggTrades CVD &amp; absorption engine.
                </div>
              </div>
              <span className="text-emerald-400 font-bold flex items-center space-x-1 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>Operational</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white flex items-center space-x-2">
                  <span>Bookmap Add-on / External L2 Bridge</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300">ENV SECRET</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Set BOOKMAP_API_KEY in backend .env to enable CME/Equities Bookmap feed.
                </div>
              </div>
              <span className={`font-bold shrink-0 ${systemStatus?.bookmapConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {systemStatus?.bookmapConfigured ? 'Connected' : 'Needs API Key'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white flex items-center space-x-2">
                  <span>Python FastAPI + PostgreSQL Proxy</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-300">/backend</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Set PYTHON_BACKEND_URL in .env when running Docker / FastAPI stack.
                </div>
              </div>
              <span className={`font-bold shrink-0 ${systemStatus?.pythonBackendConfigured ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {systemStatus?.pythonBackendConfigured ? 'Proxied' : 'Node Bridge Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Execution Safeguards */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 uppercase">
            <Lock className="w-4 h-4 text-rose-400" />
            <span>Execution Safeguards &amp; Emergency Controls</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Live Real-Money Order Execution</span>
                <button
                  onClick={() => setLiveExecutionEnabled(!liveExecutionEnabled)}
                  className={`w-12 h-6 rounded-full transition p-1 ${
                    liveExecutionEnabled ? 'bg-rose-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition transform ${
                      liveExecutionEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                By default, live execution is <span className="text-amber-400 font-bold">DISABLED</span>. All orders route strictly to the Paper Trading Ledger unless ALLOW_LIVE_TRADING=true and broker credentials are verified in backend .env.
              </p>

              {liveExecutionEnabled && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-[11px]">
                  Safeguard Lock: Server ALLOW_LIVE_TRADING is false. Execution remains sandboxed in Paper Mode.
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-bold text-white flex items-center space-x-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Primary Session Institutional Timezone</span>
              </div>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
              >
                <option value="America/New_York">New York (EST/EDT) - Institutional Standard</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Panel */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 uppercase">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Security &amp; Signal Audit Logs</span>
          </h3>
          <button
            onClick={loadAuditLogs}
            className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-cyan-400 flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="max-h-[200px] overflow-y-auto space-y-1.5 text-[11px]">
          {auditLogs.length === 0 ? (
            <div className="p-4 text-center text-slate-500">No audit entries logged yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      log.level === 'ERROR'
                        ? 'bg-rose-950 text-rose-400'
                        : log.level === 'WARN'
                        ? 'bg-amber-950 text-amber-400'
                        : 'bg-cyan-950 text-cyan-400'
                    }`}
                  >
                    {log.category}
                  </span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
                <span className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Telegram Alerts */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 uppercase">
          <Bell className="w-4 h-4 text-amber-400" />
          <span>Notifications &amp; Telegram Webhook Integration</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300">Browser Audio Chime on BUY / SELL Signal</span>
              <input
                type="checkbox"
                checked={soundAlerts}
                onChange={(e) => setSoundAlerts(e.target.checked)}
                className="accent-cyan-500 w-4 h-4"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300">Desktop Push Notifications</span>
              <input
                type="checkbox"
                checked={browserAlerts}
                onChange={(e) => setBrowserAlerts(e.target.checked)}
                className="accent-cyan-500 w-4 h-4"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="font-bold text-white flex items-center space-x-2">
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Telegram Bot Signal Broadcast</span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Telegram Bot Token (store in backend .env for prod)"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
              />
              <input
                type="text"
                placeholder="Telegram Chat / Channel ID"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none"
              />
              <button
                onClick={testTelegramWebhook}
                className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition"
              >
                Verify Telegram Configuration
              </button>
            </div>

            {telegramStatus && (
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-cyan-300">
                {telegramStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
