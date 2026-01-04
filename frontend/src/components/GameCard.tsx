import { Rocket, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GameCardProps {
  game: {
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
  };
  hasBotRunning?: boolean;
  onClick?: () => void;
}

export function GameCard({ game, hasBotRunning, onClick }: GameCardProps) {
  const navigate = useNavigate();

  // Check if game hasn't started yet (within 15 minutes before start time)
  const gameStartTime = game.start_date ? new Date(game.start_date) : null;
  const now = new Date();
  const fifteenMinutesBeforeStart = gameStartTime ? new Date(gameStartTime.getTime() - 15 * 60 * 1000) : null;
  const hasNotStarted = !!(fifteenMinutesBeforeStart && now < fifteenMinutesBeforeStart);

  return (
    <div
      className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700 transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">
            {game.title || `${game.away_team} @ ${game.home_team}`}
          </h3>
          {game.league && (
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded mt-1 inline-block">
              {game.league}
            </span>
          )}
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${
          game.status === 'scheduled' ? 'bg-slate-600 text-slate-300' :
          game.status === 'in_progress' || game.status === 'live' ? 'bg-green-500/20 text-green-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {game.status?.toUpperCase()}
        </div>
      </div>

      {/* Start time for scheduled games */}
      {game.start_date && (
        <div className="text-slate-400 text-sm mb-3">
          {new Date(game.start_date).toLocaleString()}
        </div>
      )}

      {/* Action Buttons */}
      {!hasBotRunning && (
        <div className="space-y-2">
          {/* View Market Button */}
          <button
            onClick={() => navigate(`/market/${game.event_ticker}`)}
            className="w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors bg-slate-700 hover:bg-slate-600 text-white"
          >
            <TrendingUp size={18} />
            View Market
          </button>

          {/* Deploy Bot Button */}
          <button
            onClick={onClick}
            disabled={hasNotStarted}
            className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${
              hasNotStarted
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
            title={hasNotStarted ? 'Game starts in more than 15 minutes' : 'Deploy a bot to this game'}
          >
            {hasNotStarted ? <Clock size={18} /> : <Rocket size={18} />}
            {hasNotStarted ? 'Not Started' : 'Deploy Bot'}
          </button>
          {hasNotStarted && gameStartTime && (
            <div className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1">
              <Clock size={12} />
              Available {Math.ceil((fifteenMinutesBeforeStart!.getTime() - now.getTime()) / 60000)} min before start
            </div>
          )}
        </div>
      )}

      {/* Bot Running Indicator + View Market */}
      {hasBotRunning && (
        <div className="space-y-2">
          <div className="p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-purple-400">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </div>
              Bot Active - View in Active Bots above
            </div>
          </div>
          {/* View Market Button */}
          <button
            onClick={() => navigate(`/market/${game.event_ticker}`)}
            className="w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors bg-slate-700 hover:bg-slate-600 text-white"
          >
            <TrendingUp size={18} />
            View Market
          </button>
        </div>
      )}
    </div>
  );
}
