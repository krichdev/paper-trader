import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Trophy } from 'lucide-react';
import { getUserDefaultBotConfig } from '../lib/api';

interface Game {
  event_ticker: string;
  title?: string;
  home_team?: string;
  away_team?: string;
  home_price?: number;
  away_price?: number;
  home_score?: number;
  away_score?: number;
  quarter?: number;
  clock?: string;
  status?: string;
  tick_count?: number;
  last_play?: string;
  milestone_id?: string;
  start_date?: string;
  league?: string;
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

interface GameDetailModalProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  onStartBot: (eventTicker: string, milestoneId: string, config: BotConfig) => void;
  userBalance: number;
}

export function GameDetailModal({ game, isOpen, onClose, onStartBot, userBalance }: GameDetailModalProps) {
  // Use string state for inputs to avoid formatting issues
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
    dca_max_total_risk_pct: '20'
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load user's default config when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUserDefaults();
    }
  }, [isOpen]);

  const loadUserDefaults = async () => {
    try {
      const config = await getUserDefaultBotConfig();
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
      console.error('Failed to load user default config:', e);
      // Keep existing defaults if fetch fails
    }
  };

  if (!isOpen || !game) return null;

  const handleStartBot = () => {
    // Parse input values to config
    const config: BotConfig = {
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

    onStartBot(game.event_ticker, game.milestone_id || '', config);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const gameDisplay = game.title || (game.home_team && game.away_team ? `${game.away_team} @ ${game.home_team}` : game.event_ticker);
  const isLive = game.tick_count !== undefined && game.tick_count > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Modal Container - Slide in from right on desktop, full screen on mobile */}
      <div className="w-full md:w-[500px] h-full bg-slate-900 shadow-2xl overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold">{gameDisplay}</h2>
            {game.league && (
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded mt-1 inline-block">
                {game.league}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Game Information */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-purple-400" />
              Game Information
            </h3>

            {/* Teams & Prices */}
            {isLive && game.home_team && game.away_team && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-slate-900 rounded-lg">
                  <div className="text-slate-400 text-sm mb-1">{game.home_team}</div>
                  <div className="text-2xl font-bold text-emerald-400">{game.home_price}¢</div>
                </div>
                <div className="text-center p-3 bg-slate-900 rounded-lg">
                  <div className="text-slate-400 text-sm mb-1">{game.away_team}</div>
                  <div className="text-2xl font-bold text-orange-400">{game.away_price}¢</div>
                </div>
              </div>
            )}

            {/* Score & Game State */}
            {isLive && game.quarter !== undefined && game.quarter > 0 && (
              <div className="bg-slate-900 rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-mono">
                    {game.home_score} - {game.away_score}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">Q{game.quarter}</div>
                    <div className="text-slate-400 text-sm">{game.clock}</div>
                  </div>
                </div>
                {game.last_play && (
                  <div className="mt-2 text-sm text-slate-400">
                    {game.last_play}
                  </div>
                )}
              </div>
            )}

            {/* Start Time */}
            {game.start_date && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar size={14} />
                <span>{new Date(game.start_date).toLocaleString()}</span>
              </div>
            )}

            {/* Status Badge */}
            <div className="mt-3">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                isLive ? 'bg-green-500/20 text-green-400' :
                game.status === 'scheduled' ? 'bg-slate-600 text-slate-300' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {isLive ? `LIVE (Tick #${game.tick_count})` : game.status?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Bot Configuration */}
          <div className="bg-slate-800 rounded-xl p-4 border border-purple-500/50">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <DollarSign size={18} className="text-purple-400" />
              Bot Configuration
            </h3>

            <div className="space-y-4">
              {/* Auto-allocation Info */}
              <div className="p-3 bg-purple-600/10 border border-purple-600/30 rounded-lg text-sm text-purple-300">
                <div className="font-medium mb-1">💡 Auto-Allocated Bankroll</div>
                <div className="text-xs">
                  10% of your ${userBalance.toFixed(2)} wallet = <span className="font-bold">${(userBalance * 0.10).toFixed(2)}</span> for this bot
                </div>
              </div>

              {/* Momentum Threshold */}
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Momentum Threshold (¢)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValues.momentum_threshold}
                  onChange={(e) => setInputValues({ ...inputValues, momentum_threshold: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Price movement needed to enter a trade
                </p>
              </div>

              {/* Initial Stop */}
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Initial Stop (¢)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValues.initial_stop}
                  onChange={(e) => setInputValues({ ...inputValues, initial_stop: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Maximum loss before auto-exit
                </p>
              </div>

              {/* Profit Target */}
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Profit Target (¢)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValues.profit_target}
                  onChange={(e) => setInputValues({ ...inputValues, profit_target: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Price gain to take profits
                </p>
              </div>

              {/* Breakeven Trigger */}
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Breakeven Trigger (¢)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValues.breakeven_trigger}
                  onChange={(e) => setInputValues({ ...inputValues, breakeven_trigger: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Move stop to breakeven after this gain
                </p>
              </div>

              {/* Position Size */}
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Position Size (%)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValues.position_size_pct}
                  onChange={(e) => setInputValues({ ...inputValues, position_size_pct: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Percentage of bankroll to risk per trade
                </p>
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
                <div className="space-y-3">
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
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Early Stop × </label>
                          <input
                            type="text" inputMode="decimal"
                            value={inputValues.early_game_stop_multiplier}
                            onChange={(e) => setInputValues({ ...inputValues, early_game_stop_multiplier: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Late Stop ×</label>
                          <input
                            type="text" inputMode="decimal"
                            value={inputValues.late_game_stop_multiplier}
                            onChange={(e) => setInputValues({ ...inputValues, late_game_stop_multiplier: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Early Target ×</label>
                          <input
                            type="text" inputMode="decimal"
                            value={inputValues.early_game_target_multiplier}
                            onChange={(e) => setInputValues({ ...inputValues, early_game_target_multiplier: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Late Target ×</label>
                          <input
                            type="text" inputMode="decimal"
                            value={inputValues.late_game_target_multiplier}
                            onChange={(e) => setInputValues({ ...inputValues, late_game_target_multiplier: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
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
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Possession Bias (¢)</label>
                          <input
                            type="text" inputMode="numeric"
                            value={inputValues.possession_bias_cents}
                            onChange={(e) => setInputValues({ ...inputValues, possession_bias_cents: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Score Volatility ×</label>
                          <input
                            type="text" inputMode="decimal"
                            value={inputValues.score_volatility_multiplier}
                            onChange={(e) => setInputValues({ ...inputValues, score_volatility_multiplier: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Fade Fav Threshold</label>
                          <input
                            type="text" inputMode="numeric"
                            value={inputValues.favorite_fade_threshold}
                            onChange={(e) => setInputValues({ ...inputValues, favorite_fade_threshold: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Support Dog Threshold</label>
                          <input
                            type="text" inputMode="numeric"
                            value={inputValues.underdog_support_threshold}
                            onChange={(e) => setInputValues({ ...inputValues, underdog_support_threshold: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
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
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Max Additions</label>
                          <input
                            type="text" inputMode="numeric"
                            value={inputValues.dca_max_additions}
                            onChange={(e) => setInputValues({ ...inputValues, dca_max_additions: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Trigger (¢)</label>
                          <input
                            type="text" inputMode="numeric"
                            value={inputValues.dca_trigger_cents}
                            onChange={(e) => setInputValues({ ...inputValues, dca_trigger_cents: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Size Multiplier</label>
                          <input
                            type="text" inputMode="decimal"
                            value={inputValues.dca_size_multiplier}
                            onChange={(e) => setInputValues({ ...inputValues, dca_size_multiplier: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">Min Time (s)</label>
                          <input
                            type="text" inputMode="numeric"
                            value={inputValues.dca_min_time_remaining}
                            onChange={(e) => setInputValues({ ...inputValues, dca_min_time_remaining: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-slate-400 mb-1 text-xs">Max Total Risk (%)</label>
                          <input
                            type="text" inputMode="decimal"
                            value={inputValues.dca_max_total_risk_pct}
                            onChange={(e) => setInputValues({ ...inputValues, dca_max_total_risk_pct: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleStartBot}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-lg transition-colors"
            >
              Start Bot
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Warning */}
          <div className="text-xs text-slate-500 text-center">
            This is paper trading. No real money is at risk.
          </div>
        </div>
      </div>
    </div>
  );
}
