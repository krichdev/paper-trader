import { Activity, TrendingUp, Clock, Users } from 'lucide-react';

interface MarketStatsProps {
  homeTeam?: string;
  awayTeam?: string;
  homePrice?: number;
  awayPrice?: number;
  homeVolume?: number;
  awayVolume?: number;
  tickCount?: number;
  quarter?: number;
  clock?: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
}

export function MarketStats({
  homeTeam,
  awayTeam,
  homePrice,
  awayPrice,
  homeVolume,
  awayVolume,
  tickCount,
  quarter,
  clock,
  homeScore,
  awayScore,
  status
}: MarketStatsProps) {
  const spread = homePrice && awayPrice ? Math.abs(homePrice - awayPrice) : null;
  const totalVolume = (homeVolume || 0) + (awayVolume || 0);

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="text-purple-400" size={20} />
        <h3 className="text-lg font-bold">Market Stats</h3>
      </div>

      {/* Game Status */}
      {status && (
        <div className="p-3 bg-slate-700/50 rounded-lg">
          <div className="text-xs text-slate-400 mb-1">Status</div>
          <div className={`text-sm font-bold uppercase ${
            status === 'live' || status === 'in_progress' ? 'text-green-400' :
            status === 'scheduled' ? 'text-yellow-400' :
            'text-slate-400'
          }`}>
            {status}
          </div>
        </div>
      )}

      {/* Current Scores */}
      {typeof homeScore === 'number' && typeof awayScore === 'number' && (
        <div className="p-3 bg-slate-700/50 rounded-lg">
          <div className="text-xs text-slate-400 mb-2">Score</div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm truncate">{awayTeam || 'Away'}</span>
            <span className="text-lg font-bold">{awayScore}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm truncate">{homeTeam || 'Home'}</span>
            <span className="text-lg font-bold">{homeScore}</span>
          </div>
        </div>
      )}

      {/* Game Time */}
      {(quarter || clock) && (
        <div className="p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-slate-400" />
            <div className="text-xs text-slate-400">Game Time</div>
          </div>
          <div className="text-sm font-medium">
            {quarter && <span>Q{quarter}</span>}
            {quarter && clock && <span className="text-slate-500 mx-2">•</span>}
            {clock && <span>{clock}</span>}
          </div>
        </div>
      )}

      {/* Current Prices */}
      {homePrice !== undefined && awayPrice !== undefined && (
        <div className="p-3 bg-slate-700/50 rounded-lg">
          <div className="text-xs text-slate-400 mb-2">Current Prices</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-400 truncate">{homeTeam || 'Home'}</span>
              <span className="text-lg font-bold text-green-400">{homePrice}¢</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-orange-400 truncate">{awayTeam || 'Away'}</span>
              <span className="text-lg font-bold text-orange-400">{awayPrice}¢</span>
            </div>
          </div>
          {spread !== null && (
            <div className="mt-2 pt-2 border-t border-slate-600">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Spread</span>
                <span className="font-medium">{spread}¢</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Volume */}
      {totalVolume > 0 && (
        <div className="p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-slate-400" />
            <div className="text-xs text-slate-400">Trading Volume</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 truncate">{homeTeam || 'Home'}</span>
              <span className="font-medium">{homeVolume?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 truncate">{awayTeam || 'Away'}</span>
              <span className="font-medium">{awayVolume?.toLocaleString() || 0}</span>
            </div>
            <div className="pt-2 border-t border-slate-600">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total</span>
                <span className="font-bold">{totalVolume.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tick Count */}
      {tickCount !== undefined && (
        <div className="p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-slate-400" />
            <div className="text-xs text-slate-400">Data Points</div>
          </div>
          <div className="text-lg font-bold">{tickCount.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
