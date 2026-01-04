import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Trophy } from 'lucide-react';

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
  bankroll: number;
  momentum_threshold: number;
  initial_stop: number;
  profit_target: number;
  breakeven_trigger: number;
  position_size_pct: number;
}

interface GameDetailModalProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  onStartBot: (eventTicker: string, milestoneId: string, config: BotConfig) => void;
  userBalance: number;
}

export function GameDetailModal({ game, isOpen, onClose, onStartBot, userBalance }: GameDetailModalProps) {
  const [config, setConfig] = useState<BotConfig>({
    bankroll: 500,
    momentum_threshold: 8,
    initial_stop: 8,
    profit_target: 15,
    breakeven_trigger: 5,
    position_size_pct: 0.5
  });

  // Reset config when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfig({
        bankroll: 500,
        momentum_threshold: 8,
        initial_stop: 8,
        profit_target: 15,
        breakeven_trigger: 5,
        position_size_pct: 0.5
      });
    }
  }, [isOpen]);

  if (!isOpen || !game) return null;

  const handleStartBot = () => {
    if (config.bankroll > userBalance) {
      alert(`Insufficient funds. Available balance: $${userBalance.toFixed(2)}`);
      return;
    }
    if (config.bankroll <= 0) {
      alert('Bankroll must be greater than 0');
      return;
    }
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
              {/* Bankroll */}
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Bankroll ($)
                  <span className="text-xs text-slate-500 ml-2">
                    Available: ${userBalance.toFixed(2)}
                  </span>
                </label>
                <input
                  type="number"
                  value={config.bankroll}
                  onChange={(e) => setConfig({ ...config, bankroll: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  step="50"
                  min="1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Starting funds for this bot (cannot be changed after start)
                </p>
              </div>

              {/* Momentum Threshold */}
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Momentum Threshold (¢)
                </label>
                <input
                  type="number"
                  value={config.momentum_threshold}
                  onChange={(e) => setConfig({ ...config, momentum_threshold: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  step="1"
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
                  type="number"
                  value={config.initial_stop}
                  onChange={(e) => setConfig({ ...config, initial_stop: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  step="1"
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
                  type="number"
                  value={config.profit_target}
                  onChange={(e) => setConfig({ ...config, profit_target: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  step="1"
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
                  type="number"
                  value={config.breakeven_trigger}
                  onChange={(e) => setConfig({ ...config, breakeven_trigger: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  step="1"
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
                  type="number"
                  value={config.position_size_pct * 100}
                  onChange={(e) => setConfig({ ...config, position_size_pct: e.target.value === '' ? 0 : parseFloat(e.target.value) / 100 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
                  step="5"
                  min="1"
                  max="100"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Percentage of bankroll to risk per trade
                </p>
              </div>
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
