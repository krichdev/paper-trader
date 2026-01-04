import { useState } from 'react';
import { ChevronDown, ChevronUp, DollarSign, TrendingUp, TrendingDown, Activity, Settings, Plus, Square } from 'lucide-react';

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

interface Trade {
  id?: number;
  side: string;
  entry_price: number;
  exit_price?: number;
  contracts?: number;
  pnl?: number;
  exit_reason?: string;
  entry_time?: string;
}

interface BotConfig {
  momentum_threshold: number;
  initial_stop: number;
  profit_target: number;
  breakeven_trigger: number;
  position_size_pct: number;
}

interface ActiveBot {
  eventTicker: string;
  gameTitle: string;
  wallet: WalletStatus;
  trades: Trade[];
  isExpanded: boolean;
}

interface ActiveBotsListProps {
  activeBots: ActiveBot[];
  onToggleExpand: (eventTicker: string) => void;
  onStopBot: (eventTicker: string) => void;
  onTopUp: (eventTicker: string) => Promise<void>;
  onUpdateConfig: (eventTicker: string, config: BotConfig) => void;
}

export function ActiveBotsList({ activeBots, onToggleExpand, onStopBot, onTopUp, onUpdateConfig }: ActiveBotsListProps) {
  const [showConfigFor, setShowConfigFor] = useState<string | null>(null);
  const [showTopUpFor, setShowTopUpFor] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(100);
  const [config, setConfig] = useState<BotConfig>({
    momentum_threshold: 8,
    initial_stop: 8,
    profit_target: 15,
    breakeven_trigger: 5,
    position_size_pct: 0.5
  });

  if (activeBots.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
        <DollarSign size={48} className="mx-auto mb-3 text-slate-600" />
        <h3 className="text-lg font-bold mb-1 text-slate-400">No active bots running</h3>
        <p className="text-sm text-slate-500">Select a game below to deploy your first bot</p>
      </div>
    );
  }

  const handleUpdateConfig = (eventTicker: string) => {
    onUpdateConfig(eventTicker, config);
    setShowConfigFor(null);
  };

  const handleTopUp = async (eventTicker: string) => {
    if (topUpAmount > 0) {
      try {
        await onTopUp(eventTicker);
        setShowTopUpFor(null);
        setTopUpAmount(100);
      } catch (e: any) {
        alert(e.message || 'Failed to top up bot');
      }
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Activity className="text-purple-400" size={24} />
        Active Bots
        <span className="text-sm font-normal text-slate-400 ml-2">({activeBots.length})</span>
      </h2>

      {activeBots.map((bot) => (
        <div
          key={bot.eventTicker}
          className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden transition-all"
        >
          {/* Collapsed Header - Always Visible */}
          <div
            onClick={() => onToggleExpand(bot.eventTicker)}
            className="p-4 cursor-pointer hover:bg-slate-750 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Status Indicator */}
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>

                {/* Game Title */}
                <div>
                  <h3 className="font-bold">{bot.gameTitle}</h3>
                  <p className="text-xs text-slate-400">Event: {bot.eventTicker}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Total Value & P&L Badge */}
                <div className="text-right">
                  <div className="text-lg font-bold">
                    ${bot.wallet.total_value.toFixed(2)}
                  </div>
                  <div className={`text-sm font-medium ${bot.wallet.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bot.wallet.total_pnl >= 0 ? '+' : ''}${bot.wallet.total_pnl.toFixed(2)}
                  </div>
                </div>

                {/* Expand/Collapse Arrow */}
                {bot.isExpanded ? (
                  <ChevronUp className="text-slate-400" size={20} />
                ) : (
                  <ChevronDown className="text-slate-400" size={20} />
                )}
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {bot.isExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-700 pt-4 animate-expand">
              {/* Config Panel */}
              {showConfigFor === bot.eventTicker && (
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <h4 className="font-bold mb-3 text-sm">Update Configuration</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1">Momentum Threshold (¢)</label>
                      <input
                        type="number"
                        value={config.momentum_threshold}
                        onChange={(e) => setConfig({ ...config, momentum_threshold: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Initial Stop (¢)</label>
                      <input
                        type="number"
                        value={config.initial_stop}
                        onChange={(e) => setConfig({ ...config, initial_stop: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Profit Target (¢)</label>
                      <input
                        type="number"
                        value={config.profit_target}
                        onChange={(e) => setConfig({ ...config, profit_target: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Breakeven Trigger (¢)</label>
                      <input
                        type="number"
                        value={config.breakeven_trigger}
                        onChange={(e) => setConfig({ ...config, breakeven_trigger: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Position Size (%)</label>
                      <input
                        type="number"
                        value={config.position_size_pct * 100}
                        onChange={(e) => setConfig({ ...config, position_size_pct: parseFloat(e.target.value) / 100 || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded"
                        step="5"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleUpdateConfig(bot.eventTicker)}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-sm transition-colors"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => setShowConfigFor(null)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Top Up Panel */}
              {showTopUpFor === bot.eventTicker && (
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <h4 className="font-bold mb-3 text-sm">Top Up Bot Bankroll</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1">Amount to Add ($)</label>
                      <input
                        type="number"
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
                        onClick={() => handleTopUp(bot.eventTicker)}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-sm transition-colors"
                      >
                        Add ${topUpAmount.toFixed(0)}
                      </button>
                      <button
                        onClick={() => setShowTopUpFor(null)}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Wallet Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-slate-400 mb-1">Cash</div>
                  <div className="font-bold">${bot.wallet.bankroll.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-slate-400 mb-1">Position Value</div>
                  <div className="font-bold">${bot.wallet.position_value.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-slate-400 mb-1">Realized P&L</div>
                  <div className={`font-bold ${bot.wallet.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bot.wallet.realized_pnl >= 0 ? '+' : ''}${bot.wallet.realized_pnl.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-slate-400 mb-1">Unrealized P&L</div>
                  <div className={`font-bold ${bot.wallet.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bot.wallet.unrealized_pnl >= 0 ? '+' : ''}${bot.wallet.unrealized_pnl.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Current Position */}
              {bot.wallet.position ? (
                <div className="p-3 bg-purple-900/20 border border-purple-500/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {bot.wallet.position.side === 'long' ? (
                      <TrendingUp className="text-green-400" size={16} />
                    ) : (
                      <TrendingDown className="text-red-400" size={16} />
                    )}
                    <span className="font-bold text-sm uppercase">{bot.wallet.position.side} Position</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Entry:</span>
                      <span className="ml-2 font-medium">{bot.wallet.position.entry_price}¢</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Current:</span>
                      <span className="ml-2 font-medium">{bot.wallet.position.current_price}¢</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Contracts:</span>
                      <span className="ml-2 font-medium">{bot.wallet.position.contracts}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Cost:</span>
                      <span className="ml-2 font-medium">${bot.wallet.position.cost.toFixed(2)}</span>
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
                    <div className="font-bold">{bot.wallet.stats.total_trades}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Win Rate</div>
                    <div className="font-bold">{bot.wallet.stats.win_rate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400">W/L</div>
                    <div className="font-bold">
                      <span className="text-green-400">{bot.wallet.stats.wins}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-red-400">{bot.wallet.stats.losses}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Trades */}
              {bot.trades.length > 0 && (
                <div className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-slate-400 text-xs">Recent Trades</div>
                    <div className="text-xs text-slate-500">Last {Math.min(5, bot.trades.length)}</div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1" style={{scrollbarWidth: 'thin'}}>
                    {bot.trades.slice(-5).reverse().map((trade, idx) => (
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
                            (trade.pnl ?? 0) > 0 ? 'text-green-400' :
                            (trade.pnl ?? 0) < 0 ? 'text-red-400' : 'text-slate-400'
                          }`}>
                            {(trade.pnl ?? 0) > 0 ? '+' : ''}${(trade.pnl ?? 0).toFixed(2)}
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

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setShowConfigFor(showConfigFor === bot.eventTicker ? null : bot.eventTicker);
                    setShowTopUpFor(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Settings size={16} />
                  Configure
                </button>
                <button
                  onClick={() => {
                    setShowTopUpFor(showTopUpFor === bot.eventTicker ? null : bot.eventTicker);
                    setShowConfigFor(null);
                  }}
                  className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Top Up
                </button>
                <button
                  onClick={() => onStopBot(bot.eventTicker)}
                  className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Square size={16} />
                  Stop Bot
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
