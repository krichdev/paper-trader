import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Trophy, Award, Activity, ArrowLeft, Medal } from 'lucide-react';

interface LeaderboardEntry {
  id: number;
  username: string;
  current_balance: number;
  starting_balance: number;
  total_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  return_pct: number;
  created_at: string;
}

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="text-yellow-400" size={20} />;
    if (rank === 2) return <Medal className="text-slate-400" size={20} />;
    if (rank === 3) return <Medal className="text-orange-600" size={20} />;
    return <span className="text-slate-500 font-bold">#{rank}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading leaderboard...</div>
      </div>
    );
  }

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
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="text-yellow-400" size={32} />
            <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Top traders ranked by total P&L
          </p>
        </div>

        {/* Leaderboard Table */}
        {leaderboard.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-8 border-2 border-slate-700 text-center">
            <Trophy className="mx-auto mb-4 text-slate-600" size={48} />
            <p className="text-slate-400">No traders yet. Be the first to start trading!</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border-2 border-slate-700 overflow-hidden">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50 border-b border-slate-600">
                  <tr className="text-left text-sm text-slate-300">
                    <th className="p-4 font-semibold">Rank</th>
                    <th className="p-4 font-semibold">Trader</th>
                    <th className="p-4 font-semibold">Total P&L</th>
                    <th className="p-4 font-semibold">Return %</th>
                    <th className="p-4 font-semibold">Balance</th>
                    <th className="p-4 font-semibold">Trades</th>
                    <th className="p-4 font-semibold">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {leaderboard.map((entry, index) => {
                    const rank = index + 1;
                    const isTopThree = rank <= 3;

                    return (
                      <tr
                        key={entry.id}
                        className={`transition-colors ${
                          isTopThree ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getRankIcon(rank)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{entry.username}</div>
                          {entry.total_trades > 0 && (
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Activity size={12} />
                              {entry.wins}W / {entry.losses}L
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className={`font-bold text-lg ${
                            entry.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {entry.total_pnl >= 0 ? '+' : ''}${entry.total_pnl.toFixed(2)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className={`font-semibold flex items-center gap-1 ${
                            entry.return_pct >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {entry.return_pct >= 0 ? (
                              <TrendingUp size={16} />
                            ) : (
                              <TrendingDown size={16} />
                            )}
                            {entry.return_pct >= 0 ? '+' : ''}{entry.return_pct.toFixed(1)}%
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">${entry.current_balance.toFixed(2)}</div>
                          <div className="text-xs text-slate-400">
                            Start: ${entry.starting_balance.toFixed(0)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{entry.total_trades}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {entry.total_trades > 0 ? (
                              <>
                                <Award
                                  size={16}
                                  className={entry.win_rate >= 50 ? 'text-green-400' : 'text-slate-500'}
                                />
                                <span className={`font-semibold ${
                                  entry.win_rate >= 50 ? 'text-green-400' : 'text-slate-400'
                                }`}>
                                  {entry.win_rate.toFixed(1)}%
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-500 text-sm">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-slate-700">
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                const isTopThree = rank <= 3;

                return (
                  <div
                    key={entry.id}
                    className={`p-4 ${isTopThree ? 'bg-slate-700/30' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getRankIcon(rank)}
                        <div>
                          <div className="font-bold text-lg">{entry.username}</div>
                          {entry.total_trades > 0 && (
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Activity size={12} />
                              {entry.wins}W / {entry.losses}L
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`font-bold text-lg ${
                        entry.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {entry.total_pnl >= 0 ? '+' : ''}${entry.total_pnl.toFixed(2)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-slate-400 text-xs mb-0.5">Return</div>
                        <div className={`font-semibold flex items-center gap-1 ${
                          entry.return_pct >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {entry.return_pct >= 0 ? (
                            <TrendingUp size={14} />
                          ) : (
                            <TrendingDown size={14} />
                          )}
                          {entry.return_pct >= 0 ? '+' : ''}{entry.return_pct.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs mb-0.5">Balance</div>
                        <div className="font-medium">${entry.current_balance.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs mb-0.5">Trades</div>
                        <div className="font-medium">{entry.total_trades}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs mb-0.5">Win Rate</div>
                        {entry.total_trades > 0 ? (
                          <div className={`font-semibold ${
                            entry.win_rate >= 50 ? 'text-green-400' : 'text-slate-400'
                          }`}>
                            {entry.win_rate.toFixed(1)}%
                          </div>
                        ) : (
                          <div className="text-slate-500">-</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
