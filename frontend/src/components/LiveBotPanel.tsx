import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Activity, Settings } from 'lucide-react';

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
  onStart: (config: any) => void;
  onStop: () => void;
  onUpdateConfig: (config: any) => void;
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
  onStart,
  onStop,
  onUpdateConfig
}: LiveBotPanelProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('--');
  const [config, setConfig] = useState({
    bankroll: 500,
    momentum_threshold: 8,
    initial_stop: 8,
    profit_target: 15,
    breakeven_trigger: 5,
    position_size_pct: 0.5
  });

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

      {/* Config Panel */}
      {showConfig && (
        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <h4 className="font-bold mb-3 text-sm">Bot Configuration</h4>
          <div className="space-y-2 text-sm">
            {!isRunning && (
              <div>
                <label className="block text-slate-400 mb-1">Bankroll ($)</label>
                <input
                  type="number"
                  value={config.bankroll}
                  onChange={(e) => setConfig({ ...config, bankroll: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                  step="50"
                />
                <p className="text-xs text-slate-500 mt-1">Cannot be changed after bot starts</p>
              </div>
            )}
            <div>
              <label className="block text-slate-400 mb-1">Momentum Threshold (¢)</label>
              <input
                type="number"
                value={config.momentum_threshold}
                onChange={(e) => setConfig({ ...config, momentum_threshold: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Initial Stop (¢)</label>
              <input
                type="number"
                value={config.initial_stop}
                onChange={(e) => setConfig({ ...config, initial_stop: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Profit Target (¢)</label>
              <input
                type="number"
                value={config.profit_target}
                onChange={(e) => setConfig({ ...config, profit_target: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Breakeven Trigger (¢)</label>
              <input
                type="number"
                value={config.breakeven_trigger}
                onChange={(e) => setConfig({ ...config, breakeven_trigger: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Position Size (%)</label>
              <input
                type="number"
                value={config.position_size_pct * 100}
                onChange={(e) => setConfig({ ...config, position_size_pct: parseFloat(e.target.value) / 100 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                step="5"
              />
            </div>
          </div>
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
                <div className="text-xs text-slate-500">{trades.length} trades</div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
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
