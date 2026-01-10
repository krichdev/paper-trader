import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getBotSessionHistory } from '../lib/api';
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Award, ChevronRight, Clock } from 'lucide-react';

interface BotSession {
  event_ticker: string;
  home_team: string;
  away_team: string;
  session_start: string;
  session_end: string | null;
  total_trades: number;
  completed_trades: number;
  total_pnl: number;
  wins: number;
  losses: number;
  avg_pnl: number;
  win_rate: number;
  best_trade: number;
  worst_trade: number;
  bot_config: {
    momentum_threshold: number;
    initial_stop: number;
    profit_target: number;
    breakeven_trigger: number;
    position_size_pct: number;
  };
}

export function BotHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await getBotSessionHistory();
      setSessions(data.sessions || []);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load bot session history:', e);
      setError(e.message || 'Failed to load bot session history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading bot history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={loadSessions}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Bot Trading History</h1>
          <p className="text-slate-400 text-sm">
            Review past bot sessions and analyze performance by configuration
          </p>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-8 border-2 border-slate-700 text-center">
            <Activity className="mx-auto mb-4 text-slate-600" size={48} />
            <h3 className="text-lg font-bold mb-2">No Trading History Yet</h3>
            <p className="text-slate-400 mb-4">
              Start a live bot to begin building your trading history
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              View Games
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const gameTitle = session.home_team && session.away_team
                ? `${session.away_team} @ ${session.home_team}`
                : session.event_ticker;

              return (
                <div
                  key={session.event_ticker}
                  onClick={() => navigate(`/bot-history/${session.event_ticker}`)}
                  className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-slate-700 hover:border-purple-500/50 transition-colors cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{gameTitle}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <Clock size={12} />
                        <span>{new Date(session.session_start).toLocaleDateString()}</span>
                        {session.session_end && (
                          <>
                            <span>-</span>
                            <span>{new Date(session.session_end).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="text-slate-600" size={24} />
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        {session.total_pnl >= 0 ? (
                          <TrendingUp size={14} className="text-green-400" />
                        ) : (
                          <TrendingDown size={14} className="text-red-400" />
                        )}
                        <span>Total P&L</span>
                      </div>
                      <div className={`text-xl font-bold ${session.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {session.total_pnl >= 0 ? '+' : ''}${session.total_pnl?.toFixed(2) || '0.00'}
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Activity size={14} className="text-blue-400" />
                        <span>Trades</span>
                      </div>
                      <div className="text-xl font-bold">{session.completed_trades}</div>
                      <div className="text-xs text-slate-500">{session.total_trades} total</div>
                    </div>

                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Award size={14} className="text-purple-400" />
                        <span>Win Rate</span>
                      </div>
                      <div className="text-xl font-bold">{session.win_rate.toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">
                        {session.wins}W / {session.losses}L
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">Avg Trade</div>
                      <div className={`text-xl font-bold ${session.avg_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {session.avg_pnl >= 0 ? '+' : ''}${session.avg_pnl?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>

                  {/* Config */}
                  {session.bot_config && (
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-2">Bot Configuration</div>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs">
                          MT: {session.bot_config.momentum_threshold}¢
                        </span>
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs">
                          Stop: {session.bot_config.initial_stop}¢
                        </span>
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs">
                          Target: {session.bot_config.profit_target}¢
                        </span>
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs">
                          BE: {session.bot_config.breakeven_trigger}¢
                        </span>
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs">
                          Size: {(session.bot_config.position_size_pct * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
