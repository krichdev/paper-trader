import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { resetUserAccount, getUserDefaultBotConfig, updateUserDefaultBotConfig } from '../lib/api';
import { TrendingUp, TrendingDown, DollarSign, Activity, Calendar, Award, ArrowLeft, RotateCcw, Settings } from 'lucide-react';

interface UserStats {
  user: {
    id: number;
    username: string;
    current_balance: number;
    starting_balance: number;
    total_pnl: number;
    created_at: string;
  };
  trading_stats: {
    total_trades: number;
    completed_trades: number;
    open_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    total_pnl: number;
    avg_pnl_per_trade: number;
    biggest_win: number;
    biggest_loss: number;
  };
  active_bots: any[];
  recent_trades: any[];
  open_positions: any[];
  recent_transactions: any[];
}

interface BotConfig {
  momentum_threshold: number;
  initial_stop: number;
  profit_target: number;
  breakeven_trigger: number;
  position_size_pct: number;
}

export function UserProfile() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [botConfig, setBotConfig] = useState<BotConfig>({
    momentum_threshold: 8,
    initial_stop: 8,
    profit_target: 15,
    breakeven_trigger: 5,
    position_size_pct: 0.5
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadStats();
    loadBotConfig();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/user/stats', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadBotConfig = async () => {
    try {
      const config = await getUserDefaultBotConfig();
      setBotConfig(config);
    } catch (e) {
      console.error('Failed to load bot config:', e);
    }
  };

  const handleSaveBotConfig = async () => {
    setSavingConfig(true);
    try {
      await updateUserDefaultBotConfig(botConfig);
      alert('Default bot configuration saved successfully!');
    } catch (e: any) {
      console.error('Failed to save bot config:', e);
      alert(e.message || 'Failed to save bot configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetAccount = async () => {
    setResetting(true);
    try {
      await resetUserAccount();
      await refreshUser();
      await loadStats();
      setShowResetConfirm(false);
      navigate('/');
    } catch (e: any) {
      console.error('Failed to reset account:', e);
      alert(e.message || 'Failed to reset account');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading stats...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Failed to load stats</div>
      </div>
    );
  }

  const accountValue = stats.user.current_balance;
  const totalReturn = accountValue - stats.user.starting_balance;
  const totalReturnPct = (totalReturn / stats.user.starting_balance) * 100;

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back to Trading</span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                {stats.user.username}'s Profile
              </h1>
              <p className="text-slate-400 text-sm">
                Member since {new Date(stats.user.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="self-start sm:self-auto px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg text-red-400 font-medium transition-colors flex items-center gap-2"
            >
              <RotateCcw size={18} />
              Reset Account
            </button>
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border-2 border-red-600/50">
              <h2 className="text-xl font-bold mb-4 text-red-400">Confirm Account Reset</h2>
              <p className="text-slate-300 mb-2">
                This will permanently delete all your:
              </p>
              <ul className="list-disc list-inside text-slate-300 mb-4 space-y-1">
                <li>Trading history and statistics</li>
                <li>All bot trades and positions</li>
                <li>Transaction records</li>
              </ul>
              <p className="text-slate-300 mb-6">
                Your balance will be reset to <span className="font-bold text-green-400">${stats.user.starting_balance.toFixed(2)}</span>. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleResetAccount}
                  disabled={resetting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetting ? 'Resetting...' : 'Yes, Reset Account'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Account Value</span>
              <DollarSign size={18} className="text-green-400" />
            </div>
            <div className="text-2xl font-bold">${accountValue.toFixed(2)}</div>
            <div className={`text-sm mt-1 ${totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalReturn >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}% all-time
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total P&L</span>
              {stats.trading_stats.total_pnl >= 0 ? (
                <TrendingUp size={18} className="text-green-400" />
              ) : (
                <TrendingDown size={18} className="text-red-400" />
              )}
            </div>
            <div className={`text-2xl font-bold ${stats.trading_stats.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.trading_stats.total_pnl >= 0 ? '+' : ''}${stats.trading_stats.total_pnl.toFixed(2)}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              Avg: ${stats.trading_stats.avg_pnl_per_trade.toFixed(2)}/trade
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Win Rate</span>
              <Award size={18} className="text-purple-400" />
            </div>
            <div className="text-2xl font-bold">{stats.trading_stats.win_rate.toFixed(1)}%</div>
            <div className="text-sm text-slate-400 mt-1">
              {stats.trading_stats.wins}W / {stats.trading_stats.losses}L
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total Trades</span>
              <Activity size={18} className="text-blue-400" />
            </div>
            <div className="text-2xl font-bold">{stats.trading_stats.completed_trades}</div>
            <div className="text-sm text-slate-400 mt-1">
              {stats.trading_stats.open_trades} open positions
            </div>
          </div>
        </div>

        {/* Default Bot Configuration */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-slate-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Settings className="text-purple-400" size={20} />
              Default Bot Configuration
            </h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            These settings will be used as defaults when deploying new bots. You can still customize each bot individually.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Momentum Threshold (¢)</label>
              <input
                type="number"
                value={botConfig.momentum_threshold}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setBotConfig({ ...botConfig, momentum_threshold: val === '' ? 0 : (isNaN(val) ? 0 : val) });
                }}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                min="0"
              />
              <p className="text-xs text-slate-500 mt-1">Price movement required to trigger entry</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Initial Stop Loss (¢)</label>
              <input
                type="number"
                value={botConfig.initial_stop}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setBotConfig({ ...botConfig, initial_stop: val === '' ? 0 : (isNaN(val) ? 0 : val) });
                }}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                min="0"
              />
              <p className="text-xs text-slate-500 mt-1">Initial stop loss distance</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Profit Target (¢)</label>
              <input
                type="number"
                value={botConfig.profit_target}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setBotConfig({ ...botConfig, profit_target: val === '' ? 0 : (isNaN(val) ? 0 : val) });
                }}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                min="0"
              />
              <p className="text-xs text-slate-500 mt-1">Price target for taking profit</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Breakeven Trigger (¢)</label>
              <input
                type="number"
                value={botConfig.breakeven_trigger}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setBotConfig({ ...botConfig, breakeven_trigger: val === '' ? 0 : (isNaN(val) ? 0 : val) });
                }}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                min="0"
              />
              <p className="text-xs text-slate-500 mt-1">Profit level to move stop to breakeven</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Position Size (%)</label>
              <input
                type="number"
                value={botConfig.position_size_pct * 100}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                  setBotConfig({ ...botConfig, position_size_pct: val === '' ? 0 : (isNaN(val) ? 0 : val / 100) });
                }}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                step="5"
                min="0"
                max="100"
              />
              <p className="text-xs text-slate-500 mt-1">Percentage of bankroll per trade</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSaveBotConfig}
              disabled={savingConfig}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingConfig ? 'Saving...' : 'Save Default Configuration'}
            </button>
          </div>
        </div>

        {/* Best/Worst Trades */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border-2 border-green-500/30">
            <h3 className="font-bold text-green-400 mb-2 flex items-center gap-2">
              <TrendingUp size={18} />
              Biggest Win
            </h3>
            <div className="text-2xl font-bold text-green-400">
              +${stats.trading_stats.biggest_win.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-red-500/30">
            <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
              <TrendingDown size={18} />
              Biggest Loss
            </h3>
            <div className="text-2xl font-bold text-red-400">
              ${stats.trading_stats.biggest_loss.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Active Bots */}
        {stats.active_bots.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-slate-700 mb-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Activity className="text-purple-400" size={20} />
              Active Bots ({stats.active_bots.length})
            </h2>
            <div className="space-y-3">
              {stats.active_bots.map((bot: any) => (
                <div key={bot.event_ticker} className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{bot.home_team} vs {bot.away_team}</div>
                      <div className="text-xs text-slate-400 mt-1">{bot.event_ticker}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">${bot.live_bot_bankroll?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-slate-400">Allocated</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Trades */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-slate-700 mb-6">
          <h2 className="text-lg font-bold mb-4">Recent Trades</h2>
          {stats.recent_trades.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No trades yet. Start a live bot to begin trading!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="pb-2">Event</th>
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Entry</th>
                    <th className="pb-2">Exit</th>
                    <th className="pb-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {stats.recent_trades.map((trade: any) => (
                    <tr key={trade.id}>
                      <td className="py-2 text-xs">{trade.team}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          trade.side === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-2">{trade.entry_price}</td>
                      <td className="py-2">{trade.exit_price}</td>
                      <td className={`py-2 text-right font-medium ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-slate-700">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar className="text-blue-400" size={20} />
            Recent Transactions
          </h2>
          {stats.recent_transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recent_transactions.map((tx: any) => (
                <div key={tx.id} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
                  <div>
                    <div className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400">
                      Balance: ${tx.balance_after.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
