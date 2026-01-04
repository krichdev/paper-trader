import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Trade {
  id?: number;
  side: string;
  entry_price: number;
  exit_price?: number;
  entry_time?: string;
  exit_time?: string;
  pnl?: number;
  contracts?: number;
}

interface BotPerformanceChartProps {
  trades: Trade[];
}

export function BotPerformanceChart({ trades }: BotPerformanceChartProps) {
  // Calculate cumulative P&L over time
  const chartData = useMemo(() => {
    if (trades.length === 0) return [];

    let cumulativePnL = 0;
    const data: Array<{
      time: string;
      pnl: number;
      timestamp: number;
      isEntry?: boolean;
      isExit?: boolean;
      side?: string;
    }> = [];

    // Sort trades by exit time
    const sortedTrades = [...trades]
      .filter(t => t.exit_time)
      .sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime());

    sortedTrades.forEach((trade) => {
      cumulativePnL += trade.pnl || 0;

      data.push({
        time: new Date(trade.exit_time!).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        pnl: cumulativePnL,
        timestamp: new Date(trade.exit_time!).getTime(),
        isExit: true,
        side: trade.side
      });
    });

    return data;
  }, [trades]);

  if (chartData.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 h-80 flex flex-col items-center justify-center">
        <div className="text-slate-400 text-center">
          <p className="mb-2">No bot trades yet</p>
          <p className="text-sm">Deploy a bot to start tracking performance</p>
        </div>
      </div>
    );
  }

  const finalPnL = chartData[chartData.length - 1].pnl;
  const isProfit = finalPnL >= 0;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Bot Performance</h3>
        <div className="flex items-center gap-2">
          {isProfit ? (
            <TrendingUp className="text-green-400" size={20} />
          ) : (
            <TrendingDown className="text-red-400" size={20} />
          )}
          <span className={`text-lg font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}${finalPnL.toFixed(2)}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="time"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
            label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#f1f5f9'
            }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(value: number | undefined) => value !== undefined ? [`$${value.toFixed(2)}`, 'P&L'] : ['', 'P&L']}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={isProfit ? '#10b981' : '#ef4444'}
            strokeWidth={2}
            fill="url(#colorPnL)"
          />
          {/* Trade markers */}
          {chartData.map((point, index) =>
            point.isExit ? (
              <ReferenceDot
                key={index}
                x={point.time}
                y={point.pnl}
                r={4}
                fill={point.side === 'long' ? '#10b981' : '#f97316'}
                stroke="#1e293b"
                strokeWidth={2}
              />
            ) : null
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-slate-400">Total Trades</div>
            <div className="font-bold">{trades.length}</div>
          </div>
          <div>
            <div className="text-slate-400">Wins</div>
            <div className="font-bold text-green-400">
              {trades.filter(t => (t.pnl || 0) > 0).length}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Losses</div>
            <div className="font-bold text-red-400">
              {trades.filter(t => (t.pnl || 0) < 0).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
