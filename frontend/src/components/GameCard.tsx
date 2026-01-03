import { Play, Square, Download } from 'lucide-react';
import { getExportUrl } from '../lib/api';

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
  isActive?: boolean;
  isSelected?: boolean;
  onStart?: (eventTicker: string, milestoneId: string) => void;
  onStop?: (eventTicker: string) => void;
  onSelect?: (eventTicker: string) => void;
}

export function GameCard({ game, isActive, isSelected, onStart, onStop, onSelect }: GameCardProps) {
  const isLogging = isActive && game.tick_count !== undefined;

  return (
    <div
      className={`bg-slate-800 rounded-xl p-4 border-2 transition-all cursor-pointer hover:bg-slate-750 ${
        isSelected ? 'border-purple-500 shadow-lg shadow-purple-500/20' :
        isLogging ? 'border-green-500' : 'border-slate-700'
      }`}
      onClick={() => onSelect?.(game.event_ticker)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">
            {game.title || `${game.away_team} @ ${game.home_team}`}
          </h3>
          {game.league && (
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">
              {game.league}
            </span>
          )}
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${
          isLogging ? 'bg-green-500/20 text-green-400' : 
          game.status === 'scheduled' ? 'bg-slate-600 text-slate-300' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {isLogging ? `LOGGING (${game.tick_count})` : game.status?.toUpperCase()}
        </div>
      </div>

      {/* Prices */}
      {isLogging && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-slate-400 text-sm">{game.home_team}</div>
            <div className="text-3xl font-bold text-emerald-400">{game.home_price}¢</div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-sm">{game.away_team}</div>
            <div className="text-3xl font-bold text-orange-400">{game.away_price}¢</div>
          </div>
        </div>
      )}

      {/* Score & Game State */}
      {isLogging && game.quarter !== undefined && game.quarter > 0 && (
        <div className="bg-slate-900 rounded-lg p-3 mb-3">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-mono">
              {game.home_score} - {game.away_score}
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">Q{game.quarter}</div>
              <div className="text-slate-400">{game.clock}</div>
            </div>
          </div>
          {game.last_play && (
            <div className="mt-2 text-sm text-slate-400 truncate">
              📢 {game.last_play}
            </div>
          )}
        </div>
      )}

      {/* Start time for scheduled games */}
      {!isLogging && game.start_date && (
        <div className="text-slate-400 text-sm mb-3">
          {new Date(game.start_date).toLocaleString()}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        {!isLogging ? (
          <button
            onClick={() => onStart?.(game.event_ticker, game.milestone_id || '')}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Play size={18} />
            Start Logging
          </button>
        ) : (
          <>
            <button
              onClick={() => onStop?.(game.event_ticker)}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Square size={18} />
              Stop
            </button>
            <a
              href={getExportUrl(game.event_ticker)}
              className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Download size={18} />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
