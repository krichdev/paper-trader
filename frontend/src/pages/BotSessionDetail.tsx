import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBotSessionDetail } from '../lib/api';
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Award, Calendar, DollarSign } from 'lucide-react';

interface Trade {
  id: number;
  side: string;
  team: string;
  entry_price: number;
  entry_tick: number;
  entry_time: string;
  exit_price: number | null;
  exit_tick: number | null;
  exit_time: string | null;
  exit_reason: string | null;
  pnl: number | null;
  contracts: number;
  config_snapshot: any;
}

interface SessionDetail {
  session: {
    event_ticker: string;
    home_team: string;
    away_team: string;
    status: string;
    started_at: string;
  };
  trades: Trade[];
  ticks: any[];
}

export function BotSessionDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticker) {
      loadSessionDetail();
    }
  }, [ticker]);

  const loadSessionDetail = async () => {
    if (!ticker) return;

    try {
      setLoading(true);
      const sessionData = await getBotSessionDetail(ticker);
      setData(sessionData);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load session detail:', e);
      setError(e.message || 'Failed to load session detail');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading session details...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error || 'Session not found'}</div>
          <Link
            to="/bot-history"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors inline-block"
          >
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  const gameTitle = data.session.home_team && data.session.away_team
    ? `${data.session.away_team} @ ${data.session.home_team}`
    : data.session.event_ticker;

  const completedTrades = data.trades.filter(t => t.exit_price !== null);
  const totalPnl = completedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = completedTrades.filter(t => t.pnl && t.pnl > 0).length;
  const losses = completedTrades.filter(t => t.pnl && t.pnl < 0).length;
  const winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
  const avgPnl = completedTrades.length > 0 ? totalPnl / completedTrades.length : 0;
  const bestTrade = completedTrades.length > 0 ? Math.max(...completedTrades.map(t => t.pnl || 0)) : 0;
  const worstTrade = completedTrades.length > 0 ? Math.min(...completedTrades.map(t => t.pnl || 0)) : 0;

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/bot-history"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back to History</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{gameTitle}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar size={14} />
            <span>{new Date(data.session.started_at).toLocaleString()}</span>
            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs ml-2">
              {data.session.status}
            </span>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              {totalPnl >= 0 ? (
                <TrendingUp size={18} className="text-green-400" />
              ) : (
                <TrendingDown size={18} className="text-red-400" />
              )}
              <span>Total P&L</span>
            </div>
            <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <Activity size={18} className="text-blue-400" />
              <span>Trades</span>
            </div>
            <div className="text-2xl font-bold">{completedTrades.length}</div>
            <div className="text-xs text-slate-400">{data.trades.length} total</div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <Award size={18} className="text-purple-400" />
              <span>Win Rate</span>
            </div>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <div className="text-xs text-slate-400">{wins}W / {losses}L</div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <DollarSign size={18} className="text-green-400" />
              <span>Avg P&L</span>
            </div>
            <div className={`text-2xl font-bold ${avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Best/Worst Trades */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border-2 border-green-500/30">
            <h3 className="font-bold text-green-400 mb-2 flex items-center gap-2">
              <TrendingUp size={18} />
              Best Trade
            </h3>
            <div className="text-2xl font-bold text-green-400">+${bestTrade.toFixed(2)}</div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border-2 border-red-500/30">
            <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
              <TrendingDown size={18} />
              Worst Trade
            </h3>
            <div className="text-2xl font-bold text-red-400">${worstTrade.toFixed(2)}</div>
          </div>
        </div>

        {/* Bot Configuration */}
        {data.trades.length > 0 && data.trades[0].config_snapshot && (
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-purple-500/30 mb-6">
            <h3 className="font-bold mb-3 text-purple-400">Bot Configuration</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Momentum Threshold</div>
                <div className="font-mono font-bold">
                  {data.trades[0].config_snapshot.momentum_threshold}¢
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Initial Stop</div>
                <div className="font-mono font-bold">
                  {data.trades[0].config_snapshot.initial_stop}¢
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Profit Target</div>
                <div className="font-mono font-bold">
                  {data.trades[0].config_snapshot.profit_target}¢
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Breakeven Trigger</div>
                <div className="font-mono font-bold">
                  {data.trades[0].config_snapshot.breakeven_trigger}¢
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Position Size</div>
                <div className="font-mono font-bold">
                  {(data.trades[0].config_snapshot.position_size_pct * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trade History Table */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-slate-700">
          <h3 className="font-bold mb-4">All Trades</h3>
          {data.trades.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No trades recorded for this session
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Team</th>
                    <th className="pb-2">Entry</th>
                    <th className="pb-2">Exit</th>
                    <th className="pb-2">Contracts</th>
                    <th className="pb-2">Exit Reason</th>
                    <th className="pb-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {data.trades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          trade.side === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-2 text-xs">{trade.team}</td>
                      <td className="py-2">{trade.entry_price}¢</td>
                      <td className="py-2">{trade.exit_price ? `${trade.exit_price}¢` : '-'}</td>
                      <td className="py-2">{trade.contracts || 0}</td>
                      <td className="py-2 text-xs text-slate-400">{trade.exit_reason || '-'}</td>
                      <td className={`py-2 text-right font-medium ${
                        trade.pnl && trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {trade.pnl !== null ? (
                          <>{trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}</>
                        ) : (
                          <span className="text-slate-500">Open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
