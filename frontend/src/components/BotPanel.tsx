import { useState } from 'react';
import { Play, Square, Settings, TrendingUp, TrendingDown } from 'lucide-react';

interface BotConfig {
  momentum_threshold: number;
  momentum_lookback: number;
  profit_target: number;
  trailing_stop: number;
  hard_stop: number;
  red_zone_stop_multiplier: number;
  final_minutes_stop_multiplier: number;
  avoid_final_minutes: boolean;
  final_minutes_threshold: number;
  avoid_q4_underdogs: boolean;
  underdog_price_threshold: number;
  blowout_threshold: number;
  position_size: number;
}

interface Trade {
  id: number;
  side: string;
  team: string;
  entry_price: number;
  exit_price?: number;
  exit_reason?: string;
  pnl?: number;
}

interface BotPanelProps {
  eventTicker: string;
  isRunning: boolean;
  position?: {
    side: string;
    team: string;
    entry_price: number;
    current_price: number;
  };
  trades: Trade[];
  summary?: {
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    total_pnl: number;
  };
  onStart: (config: BotConfig) => void;
  onStop: () => void;
  onUpdateConfig: (config: BotConfig) => void;
}

const defaultConfig: BotConfig = {
  momentum_threshold: 8,
  momentum_lookback: 2,
  profit_target: 12,
  trailing_stop: 8,
  hard_stop: 15,
  red_zone_stop_multiplier: 1.5,
  final_minutes_stop_multiplier: 2.0,
  avoid_final_minutes: true,
  final_minutes_threshold: 180,
  avoid_q4_underdogs: true,
  underdog_price_threshold: 35,
  blowout_threshold: 14,
  position_size: 50,
};

export function BotPanel({
  eventTicker: _eventTicker,
  isRunning,
  position,
  trades,
  summary,
  onStart,
  onStop,
  onUpdateConfig
}: BotPanelProps) {
  const [config, setConfig] = useState<BotConfig>(defaultConfig);
  const [showSettings, setShowSettings] = useState(false);

  const handleConfigChange = (key: keyof BotConfig, value: number | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    if (isRunning) {
      onUpdateConfig(newConfig);
    }
  };

  const unrealizedPnl = position 
    ? (position.current_price - position.entry_price) * (config.position_size / position.entry_price)
    : 0;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          🤖 Dry-Run Bot
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Current Position */}
      {position && (
        <div className={`rounded-lg p-3 mb-4 ${
          unrealizedPnl >= 0 ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-slate-400">Position</div>
              <div className="font-bold">{position.side.toUpperCase()} {position.team}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Entry: {position.entry_price}¢</div>
              <div className={`text-xl font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && summary.total_trades > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
          <div className="bg-slate-900 rounded p-2">
            <div className="text-xs text-slate-400">Trades</div>
            <div className="font-bold">{summary.total_trades}</div>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <div className="text-xs text-slate-400">Win Rate</div>
            <div className="font-bold">{summary.win_rate.toFixed(0)}%</div>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <div className="text-xs text-slate-400">W/L</div>
            <div className="font-bold text-green-400">{summary.wins}<span className="text-slate-500">/</span><span className="text-red-400">{summary.losses}</span></div>
          </div>
          <div className="bg-slate-900 rounded p-2">
            <div className="text-xs text-slate-400">P&L</div>
            <div className={`font-bold ${summary.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${summary.total_pnl.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-slate-900 rounded-lg p-4 mb-4 space-y-4">
          <h4 className="font-bold text-sm text-slate-400 uppercase">Entry Parameters</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Momentum Threshold</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="4"
                  max="20"
                  value={config.momentum_threshold}
                  onChange={(e) => handleConfigChange('momentum_threshold', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-right">{config.momentum_threshold}¢</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-slate-400">Position Size</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={config.position_size}
                  onChange={(e) => handleConfigChange('position_size', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-12 text-right">${config.position_size}</span>
              </div>
            </div>
          </div>

          <h4 className="font-bold text-sm text-slate-400 uppercase pt-2">Exit Parameters</h4>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400">Profit Target</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="6"
                  max="25"
                  value={config.profit_target}
                  onChange={(e) => handleConfigChange('profit_target', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-right">{config.profit_target}¢</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-slate-400">Trailing Stop</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="4"
                  max="20"
                  value={config.trailing_stop}
                  onChange={(e) => handleConfigChange('trailing_stop', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-right">{config.trailing_stop}¢</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-slate-400">Hard Stop</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="30"
                  value={config.hard_stop}
                  onChange={(e) => handleConfigChange('hard_stop', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-right">{config.hard_stop}¢</span>
              </div>
            </div>
          </div>

          <h4 className="font-bold text-sm text-slate-400 uppercase pt-2">Game-Aware Filters</h4>
          
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.avoid_final_minutes}
                onChange={(e) => handleConfigChange('avoid_final_minutes', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Avoid final 3 minutes of close games</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.avoid_q4_underdogs}
                onChange={(e) => handleConfigChange('avoid_q4_underdogs', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Avoid Q4 underdogs (down 14+)</span>
            </label>
          </div>
        </div>
      )}

      {/* Recent Trades */}
      {trades.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm text-slate-400 mb-2">Recent Trades</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {trades.slice(-5).reverse().map((trade) => (
              <div key={trade.id} className="flex justify-between items-center text-sm bg-slate-900 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  {trade.pnl !== undefined && trade.pnl >= 0 ? (
                    <TrendingUp size={14} className="text-green-400" />
                  ) : (
                    <TrendingDown size={14} className="text-red-400" />
                  )}
                  <span>{trade.side} {trade.team}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{trade.entry_price}¢ → {trade.exit_price || '...'}¢</span>
                  {trade.pnl !== undefined && (
                    <span className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start/Stop Button */}
      {!isRunning ? (
        <button
          onClick={() => onStart(config)}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors"
        >
          <Play size={20} />
          Start Bot
        </button>
      ) : (
        <button
          onClick={onStop}
          className="w-full bg-red-600 hover:bg-red-500 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors"
        >
          <Square size={20} />
          Stop Bot
        </button>
      )}
    </div>
  );
}
