import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Activity, Settings, AlertTriangle, Plus } from 'lucide-react';

interface WalletStatus {
  bankroll: number;
  starting_bankroll: number;
  position_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  total_value: number;
  total_return_pct: number;
  position: {
    side: string;
    entry_price: number;
    contracts: number;
    cost: number;
    current_price: number;
  } | null;
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
  };
}

interface LiveBotPanelProps {
  eventTicker: string;
  gameTitle?: string;
  homeTeam?: string;
  awayTeam?: string;
  tickCount?: number;
  isRunning: boolean;
  wallet: WalletStatus | null;
  trades?: any[];
  lowBalance?: boolean;
  onStart: (config: any) => void;
  onStop: () => void;
  onUpdateConfig: (config: any) => void;
  onTopUp?: (amount: number) => Promise<void>;
}

export function LiveBotPanel({
  eventTicker: _eventTicker,
  gameTitle,
  homeTeam,
  awayTeam,
  tickCount,
  isRunning,
  wallet,
  trades = [],
  lowBalance = false,
  onStart,
  onStop,
  onUpdateConfig,
  onTopUp
}: LiveBotPanelProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(100);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('--');
  const [config, setConfig] = useState({
    momentum_threshold: 8,
    initial_stop: 8,
    profit_target: 15,
    breakeven_trigger: 5,
    position_size_pct: 0.5,
    // Time-based dynamic exits
    enable_time_scaling: true,
    early_game_stop_multiplier: 1.5,
    late_game_stop_multiplier: 0.7,
    early_game_target_multiplier: 1.3,
    late_game_target_multiplier: 0.8,
    // Game context factors
    enable_game_context: true,
    possession_bias_cents: 2,
    score_volatility_multiplier: 1.2,
    favorite_fade_threshold: 65,
    underdog_support_threshold: 35,
    // DCA parameters
    enable_dca: false,
    dca_max_additions: 2,
    dca_trigger_cents: 5,
    dca_size_multiplier: 0.75,
    dca_min_time_remaining: 600,
    dca_max_total_risk_pct: 0.20  // 20% of auto-allocated bankroll
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update last update time when wallet changes
  useEffect(() => {
    if (wallet) {
      setLastUpdate(new Date());
    }
  }, [wallet]);

  // Update time since last update every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastUpdate) {
        const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
        if (seconds < 60) {
          setTimeSinceUpdate(`${seconds}s ago`);
        } else {
          const minutes = Math.floor(seconds / 60);
          setTimeSinceUpdate(`${minutes}m ago`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  const handleStart = () => {
    onStart(config);
  };

  const handleUpdateConfig = () => {
    onUpdateConfig(config);
    setShowConfig(false);
  };

  const handleTopUp = async () => {
    if (onTopUp && topUpAmount > 0) {
      try {
        await onTopUp(topUpAmount);
        setShowTopUp(false);
        setTopUpAmount(100);
      } catch (e: any) {
        alert(e.message || 'Failed to top up bot');
      }
    }
  };

  const gameDisplay = gameTitle || (homeTeam && awayTeam ? `${awayTeam} @ ${homeTeam}` : null);

  return (
    <div className="bg-slate-800 rounded-xl p-4 border-2 border-purple-500/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="text-purple-400" size={20} />
          <h3 className="font-bold">Live Paper Bot</h3>
        </div>
        <div className="flex gap-2">
          {isRunning && (
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          )}
          {isRunning ? (
            <button
              onClick={onStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => setShowConfig(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              Start Live Bot
            </button>
          )}
        </div>
      </div>

      {/* Game Info & Status */}
      {gameDisplay && (
        <div className="mb-3 pb-3 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300 mb-1">{gameDisplay}</div>
          {isRunning && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>Live</span>
              </div>
              {tickCount !== undefined && (
                <span>Tick #{tickCount}</span>
              )}
              <span>{timeSinceUpdate}</span>
            </div>
          )}
        </div>
      )}

      {/* Low Balance Warning */}
      {isRunning && lowBalance && (
        <div className="mb-3 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-yellow-400 flex-shrink-0" size={18} />
            <div>
              <div className="text-sm font-medium text-yellow-400 mb-1">Low Balance Warning</div>
              <div className="text-xs text-yellow-200/80 mb-2">
                Bot has insufficient funds to enter new trades. Top up to continue trading.
              </div>
              {onTopUp && (
                <button
                  onClick={() => setShowTopUp(true)}
                  className="text-xs px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded font-medium transition-colors flex items-center gap-1"
                >
                  <Plus size={14} />
                  Top Up Bot
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Up Panel */}
      {showTopUp && (
        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <h4 className="font-bold mb-3 text-sm">Top Up Bot Bankroll</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Amount to Add ($)</label>
              <input
                type="text" inputMode="numeric"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                step="50"
                min="1"
              />
              <p className="text-xs text-slate-500 mt-1">Funds will be deducted from your wallet</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTopUp}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-sm transition-colors"
              >
                Add ${topUpAmount.toFixed(0)}
              </button>
              <button
                onClick={() => setShowTopUp(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Panel */}
      {showConfig && (
        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600 max-h-[600px] overflow-y-auto">
          <h4 className="font-bold mb-3 text-sm">Bot Configuration</h4>

          {/* Basic Configuration */}
          <div className="space-y-2 text-sm mb-4">
            <div className="text-xs font-bold text-purple-400 mb-2">BASIC SETTINGS</div>
            <div className="mb-3 p-2 bg-purple-600/10 border border-purple-600/30 rounded text-xs text-purple-300">
              💡 Bankroll auto-allocated: 10% of your wallet per game
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Momentum Threshold (¢)</label>
              <input
                type="text" inputMode="numeric"
                value={config.momentum_threshold}
                onChange={(e) => setConfig({ ...config, momentum_threshold: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Initial Stop (¢)</label>
              <input
                type="text" inputMode="numeric"
                value={config.initial_stop}
                onChange={(e) => setConfig({ ...config, initial_stop: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
              <p className="text-xs text-slate-500 mt-1">Base stop loss (scales with time if enabled)</p>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Profit Target (¢)</label>
              <input
                type="text" inputMode="numeric"
                value={config.profit_target}
                onChange={(e) => setConfig({ ...config, profit_target: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
              <p className="text-xs text-slate-500 mt-1">Base profit target (scales with time if enabled)</p>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Breakeven Trigger (¢)</label>
              <input
                type="text" inputMode="numeric"
                value={config.breakeven_trigger}
                onChange={(e) => setConfig({ ...config, breakeven_trigger: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Position Size (%)</label>
              <input
                type="text" inputMode="numeric"
                value={config.position_size_pct * 100}
                onChange={(e) => setConfig({ ...config, position_size_pct: parseFloat(e.target.value) / 100 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                step="5"
              />
            </div>
          </div>

          {/* Advanced Configuration Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-between mb-3"
          >
            <span>Advanced Settings</span>
            <span className="text-xs">{showAdvanced ? '▼' : '▶'}</span>
          </button>

          {/* Advanced Configuration */}
          {showAdvanced && (
            <div className="space-y-4">
              {/* Time-Based Dynamic Exits */}
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-blue-400">TIME-BASED EXITS</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enable_time_scaling}
                      onChange={(e) => setConfig({ ...config, enable_time_scaling: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-slate-400">Enabled</span>
                  </label>
                </div>
                {config.enable_time_scaling && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Early Game Stop Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={config.early_game_stop_multiplier}
                        onChange={(e) => setConfig({ ...config, early_game_stop_multiplier: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q1-Q2: 1.5 = wider stops (12¢ vs 8¢)</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Late Game Stop Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={config.late_game_stop_multiplier}
                        onChange={(e) => setConfig({ ...config, late_game_stop_multiplier: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q4: 0.7 = tighter stops (5.6¢ vs 8¢)</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Early Game Target Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={config.early_game_target_multiplier}
                        onChange={(e) => setConfig({ ...config, early_game_target_multiplier: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q1-Q2: 1.3 = higher targets (20¢ vs 15¢)</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Late Game Target Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={config.late_game_target_multiplier}
                        onChange={(e) => setConfig({ ...config, late_game_target_multiplier: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q4: 0.8 = lower targets (12¢ vs 15¢)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Game Context Factors */}
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-green-400">GAME CONTEXT</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enable_game_context}
                      onChange={(e) => setConfig({ ...config, enable_game_context: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-slate-400">Enabled</span>
                  </label>
                </div>
                {config.enable_game_context && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Possession Bias (¢)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={config.possession_bias_cents}
                        onChange={(e) => setConfig({ ...config, possession_bias_cents: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Favor team with ball possession</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Score Volatility Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={config.score_volatility_multiplier}
                        onChange={(e) => setConfig({ ...config, score_volatility_multiplier: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Wider stops when score is close</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Favorite Fade Threshold</label>
                      <input
                        type="text" inputMode="numeric"
                        value={config.favorite_fade_threshold}
                        onChange={(e) => setConfig({ ...config, favorite_fade_threshold: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Opening price &gt; this = fade favorites</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Underdog Support Threshold</label>
                      <input
                        type="text" inputMode="numeric"
                        value={config.underdog_support_threshold}
                        onChange={(e) => setConfig({ ...config, underdog_support_threshold: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Opening price &lt; this = support underdogs</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dollar Cost Averaging (DCA) */}
              <div className="p-3 bg-slate-800/50 rounded-lg border border-yellow-600/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-yellow-400">DOLLAR COST AVERAGING</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enable_dca}
                      onChange={(e) => setConfig({ ...config, enable_dca: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-slate-400">Enabled</span>
                  </label>
                </div>
                <p className="text-xs text-yellow-200/70 mb-2">⚠️ Higher risk: Adds to losing positions</p>
                {config.enable_dca && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Max Additions</label>
                      <input
                        type="text" inputMode="numeric"
                        value={config.dca_max_additions}
                        onChange={(e) => setConfig({ ...config, dca_max_additions: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        min="1"
                        max="5"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Max times to add to losing position (1-5)</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">DCA Trigger (¢)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={config.dca_trigger_cents}
                        onChange={(e) => setConfig({ ...config, dca_trigger_cents: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Add when price moves against you by this much</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">DCA Size Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={config.dca_size_multiplier}
                        onChange={(e) => setConfig({ ...config, dca_size_multiplier: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        step="0.05"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Each add = previous × this (0.5-1.0)</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Min Time Remaining (seconds)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={config.dca_min_time_remaining}
                        onChange={(e) => setConfig({ ...config, dca_min_time_remaining: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Don't DCA with less than this time left (600 = 10 min)</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Max Total Risk (%)</label>
                      <input
                        type="text" inputMode="decimal"
                        value={config.dca_max_total_risk_pct * 100}
                        onChange={(e) => setConfig({ ...config, dca_max_total_risk_pct: parseFloat(e.target.value) / 100 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm"
                        step="5"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Max % of bankroll at risk across all adds</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-3 flex gap-2">
            {isRunning ? (
              <>
                <button
                  onClick={handleUpdateConfig}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
                >
                  Update Config
                </button>
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStart}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
                >
                  Start Bot
                </button>
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Wallet Display */}
      {isRunning && wallet ? (
        <div className="space-y-4">
          {/* Total Value */}
          <div className="p-4 bg-slate-700/50 rounded-lg">
            <div className="text-slate-400 text-sm mb-1">Total Value</div>
            <div className="text-3xl font-bold">
              ${wallet.total_value.toFixed(2)}
            </div>
            <div className={`text-sm font-medium ${wallet.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {wallet.total_return_pct >= 0 ? '+' : ''}{wallet.total_return_pct.toFixed(1)}%
              ({wallet.total_value >= wallet.starting_bankroll ? '+' : ''}${(wallet.total_value - wallet.starting_bankroll).toFixed(2)})
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-slate-400 mb-1">Cash</div>
              <div className="font-bold">${wallet.bankroll.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-slate-400 mb-1">Position Value</div>
              <div className="font-bold">${wallet.position_value.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-slate-400 mb-1">Realized P&L</div>
              <div className={`font-bold ${wallet.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${wallet.realized_pnl >= 0 ? '+' : ''}{wallet.realized_pnl.toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-slate-400 mb-1">Unrealized P&L</div>
              <div className={`font-bold ${wallet.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${wallet.unrealized_pnl >= 0 ? '+' : ''}{wallet.unrealized_pnl.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Current Position */}
          {wallet.position ? (
            <div className="p-3 bg-purple-900/20 border border-purple-500/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {wallet.position.side === 'long' ? (
                  <TrendingUp className="text-green-400" size={16} />
                ) : (
                  <TrendingDown className="text-red-400" size={16} />
                )}
                <span className="font-bold text-sm uppercase">{wallet.position.side} Position</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Entry:</span>
                  <span className="ml-2 font-medium">{wallet.position.entry_price}¢</span>
                </div>
                <div>
                  <span className="text-slate-400">Current:</span>
                  <span className="ml-2 font-medium">{wallet.position.current_price}¢</span>
                </div>
                <div>
                  <span className="text-slate-400">Contracts:</span>
                  <span className="ml-2 font-medium">{wallet.position.contracts}</span>
                </div>
                <div>
                  <span className="text-slate-400">Cost:</span>
                  <span className="ml-2 font-medium">${wallet.position.cost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg text-center text-slate-400 text-sm">
              <Activity size={16} className="inline mb-1" />
              <div>No open position</div>
            </div>
          )}

          {/* Stats */}
          <div className="p-3 bg-slate-700/30 rounded-lg">
            <div className="text-slate-400 text-xs mb-2">Trading Stats</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-400">Trades</div>
                <div className="font-bold">{wallet.stats.total_trades}</div>
              </div>
              <div>
                <div className="text-slate-400">Win Rate</div>
                <div className="font-bold">{wallet.stats.win_rate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-slate-400">W/L</div>
                <div className="font-bold">
                  <span className="text-green-400">{wallet.stats.wins}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-red-400">{wallet.stats.losses}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trade History */}
          {trades.length > 0 && (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-slate-400 text-xs">Trade History</div>
                <div className="text-xs text-slate-500">{trades.length} trade{trades.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1" style={{scrollbarWidth: 'thin'}}>
                {trades.slice().reverse().map((trade: any, idx: number) => (
                  <div
                    key={trade.id || idx}
                    className="p-2 bg-slate-800/50 rounded text-xs border border-slate-600"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {trade.side === 'long' ? (
                          <TrendingUp size={14} className="text-green-400" />
                        ) : (
                          <TrendingDown size={14} className="text-red-400" />
                        )}
                        <span className="font-bold uppercase text-slate-300">{trade.side}</span>
                      </div>
                      <div className={`font-bold ${
                        trade.pnl > 0 ? 'text-green-400' :
                        trade.pnl < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {trade.pnl > 0 ? '+' : ''}${trade.pnl?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-400">
                      <div>Entry: <span className="text-slate-200">{trade.entry_price}¢</span></div>
                      <div>Exit: <span className="text-slate-200">{trade.exit_price}¢</span></div>
                      <div>Contracts: <span className="text-slate-200">{trade.contracts || 'N/A'}</span></div>
                      <div>Reason: <span className="text-slate-200">{trade.exit_reason || 'N/A'}</span></div>
                    </div>
                    {trade.entry_time && (
                      <div className="mt-1 text-slate-500 text-[10px]">
                        {new Date(trade.entry_time).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : !isRunning ? (
        <div className="text-center py-8 text-slate-400">
          <DollarSign size={48} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Start the Live Paper Bot to begin trading</p>
          <p className="text-xs mt-1">Trades based on momentum with real-time P&L tracking</p>
        </div>
      ) : null}
    </div>
  );
}
