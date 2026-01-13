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
  // Time-based dynamic exits
  enable_time_scaling?: boolean;
  early_game_stop_multiplier?: number;
  late_game_stop_multiplier?: number;
  early_game_target_multiplier?: number;
  late_game_target_multiplier?: number;
  // Game context factors
  enable_game_context?: boolean;
  possession_bias_cents?: number;
  score_volatility_multiplier?: number;
  favorite_fade_threshold?: number;
  underdog_support_threshold?: number;
  // DCA parameters
  enable_dca?: boolean;
  dca_max_additions?: number;
  dca_trigger_cents?: number;
  dca_size_multiplier?: number;
  dca_min_time_remaining?: number;
  dca_max_total_risk_pct?: number;
}

export function UserProfile() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Use string values for inputs to allow intermediate states like empty or "01"
  const [inputValues, setInputValues] = useState({
    momentum_threshold: '8',
    initial_stop: '8',
    profit_target: '15',
    breakeven_trigger: '5',
    position_size_pct: '50',
    // Time-based
    enable_time_scaling: true,
    early_game_stop_multiplier: '1.5',
    late_game_stop_multiplier: '0.7',
    early_game_target_multiplier: '1.3',
    late_game_target_multiplier: '0.8',
    // Game context
    enable_game_context: true,
    possession_bias_cents: '2',
    score_volatility_multiplier: '1.2',
    favorite_fade_threshold: '65',
    underdog_support_threshold: '35',
    // DCA
    enable_dca: false,
    dca_max_additions: '2',
    dca_trigger_cents: '5',
    dca_size_multiplier: '0.75',
    dca_min_time_remaining: '600',
    dca_max_total_risk_pct: '20'  // 20% of auto-allocated bankroll
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      // Update input string values
      setInputValues({
        momentum_threshold: config.momentum_threshold.toString(),
        initial_stop: config.initial_stop.toString(),
        profit_target: config.profit_target.toString(),
        breakeven_trigger: config.breakeven_trigger.toString(),
        position_size_pct: (config.position_size_pct * 100).toString(),
        // Time-based
        enable_time_scaling: config.enable_time_scaling ?? true,
        early_game_stop_multiplier: (config.early_game_stop_multiplier ?? 1.5).toString(),
        late_game_stop_multiplier: (config.late_game_stop_multiplier ?? 0.7).toString(),
        early_game_target_multiplier: (config.early_game_target_multiplier ?? 1.3).toString(),
        late_game_target_multiplier: (config.late_game_target_multiplier ?? 0.8).toString(),
        // Game context
        enable_game_context: config.enable_game_context ?? true,
        possession_bias_cents: (config.possession_bias_cents ?? 2).toString(),
        score_volatility_multiplier: (config.score_volatility_multiplier ?? 1.2).toString(),
        favorite_fade_threshold: (config.favorite_fade_threshold ?? 65).toString(),
        underdog_support_threshold: (config.underdog_support_threshold ?? 35).toString(),
        // DCA
        enable_dca: config.enable_dca ?? false,
        dca_max_additions: (config.dca_max_additions ?? 2).toString(),
        dca_trigger_cents: (config.dca_trigger_cents ?? 5).toString(),
        dca_size_multiplier: (config.dca_size_multiplier ?? 0.75).toString(),
        dca_min_time_remaining: (config.dca_min_time_remaining ?? 600).toString(),
        dca_max_total_risk_pct: ((config.dca_max_total_risk_pct ?? 0.20) * 100).toString()
      });
    } catch (e) {
      console.error('Failed to load bot config:', e);
    }
  };

  const handleSaveBotConfig = async () => {
    setSavingConfig(true);
    try {
      // Parse input values to numbers, defaulting to 0 for empty/invalid
      const configToSave: BotConfig = {
        momentum_threshold: parseInt(inputValues.momentum_threshold, 10) || 0,
        initial_stop: parseInt(inputValues.initial_stop, 10) || 0,
        profit_target: parseInt(inputValues.profit_target, 10) || 0,
        breakeven_trigger: parseInt(inputValues.breakeven_trigger, 10) || 0,
        position_size_pct: (parseFloat(inputValues.position_size_pct) || 0) / 100,
        // Time-based
        enable_time_scaling: inputValues.enable_time_scaling,
        early_game_stop_multiplier: parseFloat(inputValues.early_game_stop_multiplier) || 1.5,
        late_game_stop_multiplier: parseFloat(inputValues.late_game_stop_multiplier) || 0.7,
        early_game_target_multiplier: parseFloat(inputValues.early_game_target_multiplier) || 1.3,
        late_game_target_multiplier: parseFloat(inputValues.late_game_target_multiplier) || 0.8,
        // Game context
        enable_game_context: inputValues.enable_game_context,
        possession_bias_cents: parseInt(inputValues.possession_bias_cents, 10) || 2,
        score_volatility_multiplier: parseFloat(inputValues.score_volatility_multiplier) || 1.2,
        favorite_fade_threshold: parseInt(inputValues.favorite_fade_threshold, 10) || 65,
        underdog_support_threshold: parseInt(inputValues.underdog_support_threshold, 10) || 35,
        // DCA
        enable_dca: inputValues.enable_dca,
        dca_max_additions: parseInt(inputValues.dca_max_additions, 10) || 2,
        dca_trigger_cents: parseInt(inputValues.dca_trigger_cents, 10) || 5,
        dca_size_multiplier: parseFloat(inputValues.dca_size_multiplier) || 0.75,
        dca_min_time_remaining: parseInt(inputValues.dca_min_time_remaining, 10) || 600,
        dca_max_total_risk_pct: (parseFloat(inputValues.dca_max_total_risk_pct) || 20) / 100
      };

      console.log('Saving bot config:', configToSave);
      const result = await updateUserDefaultBotConfig(configToSave);
      console.log('Save result:', result);

      // Update input values to clean up any invalid entries
      setInputValues({
        momentum_threshold: configToSave.momentum_threshold.toString(),
        initial_stop: configToSave.initial_stop.toString(),
        profit_target: configToSave.profit_target.toString(),
        breakeven_trigger: configToSave.breakeven_trigger.toString(),
        position_size_pct: (configToSave.position_size_pct * 100).toString(),
        // Time-based
        enable_time_scaling: configToSave.enable_time_scaling ?? true,
        early_game_stop_multiplier: (configToSave.early_game_stop_multiplier ?? 1.5).toString(),
        late_game_stop_multiplier: (configToSave.late_game_stop_multiplier ?? 0.7).toString(),
        early_game_target_multiplier: (configToSave.early_game_target_multiplier ?? 1.3).toString(),
        late_game_target_multiplier: (configToSave.late_game_target_multiplier ?? 0.8).toString(),
        // Game context
        enable_game_context: configToSave.enable_game_context ?? true,
        possession_bias_cents: (configToSave.possession_bias_cents ?? 2).toString(),
        score_volatility_multiplier: (configToSave.score_volatility_multiplier ?? 1.2).toString(),
        favorite_fade_threshold: (configToSave.favorite_fade_threshold ?? 65).toString(),
        underdog_support_threshold: (configToSave.underdog_support_threshold ?? 35).toString(),
        // DCA
        enable_dca: configToSave.enable_dca ?? false,
        dca_max_additions: (configToSave.dca_max_additions ?? 2).toString(),
        dca_trigger_cents: (configToSave.dca_trigger_cents ?? 5).toString(),
        dca_size_multiplier: (configToSave.dca_size_multiplier ?? 0.75).toString(),
        dca_min_time_remaining: (configToSave.dca_min_time_remaining ?? 600).toString(),
        dca_max_total_risk_pct: ((configToSave.dca_max_total_risk_pct ?? 0.20) * 100).toString()
      });
      alert('Default bot configuration saved successfully!');
    } catch (e: any) {
      console.error('Failed to save bot config:', e);
      alert(`Failed to save: ${e.message || 'Unknown error'}`);
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
                type="text"
                inputMode="numeric"
                value={inputValues.momentum_threshold}
                onChange={(e) => setInputValues({ ...inputValues, momentum_threshold: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Price movement required to trigger entry</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Initial Stop Loss (¢)</label>
              <input
                type="text"
                inputMode="numeric"
                value={inputValues.initial_stop}
                onChange={(e) => setInputValues({ ...inputValues, initial_stop: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Initial stop loss distance</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Profit Target (¢)</label>
              <input
                type="text"
                inputMode="numeric"
                value={inputValues.profit_target}
                onChange={(e) => setInputValues({ ...inputValues, profit_target: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Price target for taking profit</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Breakeven Trigger (¢)</label>
              <input
                type="text"
                inputMode="numeric"
                value={inputValues.breakeven_trigger}
                onChange={(e) => setInputValues({ ...inputValues, breakeven_trigger: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Profit level to move stop to breakeven</p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Position Size (%)</label>
              <input
                type="text"
                inputMode="numeric"
                value={inputValues.position_size_pct}
                onChange={(e) => setInputValues({ ...inputValues, position_size_pct: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Percentage of bankroll per trade</p>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-between mt-4"
          >
            <span>Advanced Settings</span>
            <span className="text-xs">{showAdvanced ? '▼' : '▶'}</span>
          </button>

          {/* Advanced Configuration */}
          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Time-Based Dynamic Exits */}
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-blue-400">TIME-BASED EXITS</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inputValues.enable_time_scaling}
                      onChange={(e) => setInputValues({ ...inputValues, enable_time_scaling: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-slate-400">Enabled</span>
                  </label>
                </div>
                {inputValues.enable_time_scaling && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Early Game Stop Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={inputValues.early_game_stop_multiplier}
                        onChange={(e) => setInputValues({ ...inputValues, early_game_stop_multiplier: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q1-Q2: 1.5 = wider stops</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Late Game Stop Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={inputValues.late_game_stop_multiplier}
                        onChange={(e) => setInputValues({ ...inputValues, late_game_stop_multiplier: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q4: 0.7 = tighter stops</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Early Game Target Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={inputValues.early_game_target_multiplier}
                        onChange={(e) => setInputValues({ ...inputValues, early_game_target_multiplier: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q1-Q2: 1.3 = higher targets</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Late Game Target Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={inputValues.late_game_target_multiplier}
                        onChange={(e) => setInputValues({ ...inputValues, late_game_target_multiplier: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Q4: 0.8 = lower targets</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Game Context Factors */}
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-green-400">GAME CONTEXT</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inputValues.enable_game_context}
                      onChange={(e) => setInputValues({ ...inputValues, enable_game_context: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-slate-400">Enabled</span>
                  </label>
                </div>
                {inputValues.enable_game_context && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Possession Bias (¢)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={inputValues.possession_bias_cents}
                        onChange={(e) => setInputValues({ ...inputValues, possession_bias_cents: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Favor team with possession</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Score Volatility Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={inputValues.score_volatility_multiplier}
                        onChange={(e) => setInputValues({ ...inputValues, score_volatility_multiplier: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        step="0.1"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Wider stops when score is close</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Favorite Fade Threshold</label>
                      <input
                        type="text" inputMode="numeric"
                        value={inputValues.favorite_fade_threshold}
                        onChange={(e) => setInputValues({ ...inputValues, favorite_fade_threshold: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Opening price &gt; this = fade favorites</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Underdog Support Threshold</label>
                      <input
                        type="text" inputMode="numeric"
                        value={inputValues.underdog_support_threshold}
                        onChange={(e) => setInputValues({ ...inputValues, underdog_support_threshold: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Opening price &lt; this = support underdogs</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dollar Cost Averaging */}
              <div className="p-3 bg-slate-700/50 rounded-lg border border-yellow-600/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-yellow-400">DOLLAR COST AVERAGING</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inputValues.enable_dca}
                      onChange={(e) => setInputValues({ ...inputValues, enable_dca: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-slate-400">Enabled</span>
                  </label>
                </div>
                <p className="text-xs text-yellow-200/70 mb-2">⚠️ Higher risk: Adds to losing positions</p>
                {inputValues.enable_dca && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Max Additions</label>
                      <input
                        type="text" inputMode="numeric"
                        value={inputValues.dca_max_additions}
                        onChange={(e) => setInputValues({ ...inputValues, dca_max_additions: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        min="1"
                        max="5"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Max times to add to position (1-5)</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">DCA Trigger (¢)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={inputValues.dca_trigger_cents}
                        onChange={(e) => setInputValues({ ...inputValues, dca_trigger_cents: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Add when price moves against you</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">DCA Size Multiplier</label>
                      <input
                        type="text" inputMode="decimal"
                        value={inputValues.dca_size_multiplier}
                        onChange={(e) => setInputValues({ ...inputValues, dca_size_multiplier: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        step="0.05"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Each add = previous × this</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Min Time Remaining (sec)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={inputValues.dca_min_time_remaining}
                        onChange={(e) => setInputValues({ ...inputValues, dca_min_time_remaining: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Don't DCA with less time left</p>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-xs">Max Total Risk (%)</label>
                      <input
                        type="text" inputMode="decimal"
                        value={inputValues.dca_max_total_risk_pct}
                        onChange={(e) => setInputValues({ ...inputValues, dca_max_total_risk_pct: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                        step="5"
                      />
                      <p className="text-xs text-slate-500 mt-0.5">Max % of bankroll at risk</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
