import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface GameTick {
  tick: number;
  timestamp: string;
  home_volume: number;
  away_volume: number;
  home_team?: string;
  away_team?: string;
}

interface VolumeChartProps {
  data: GameTick[];
  homeTeam?: string;
  awayTeam?: string;
  timeRange?: '5m' | '15m' | 'all';
}

export function VolumeChart({ data, homeTeam, awayTeam, timeRange = 'all' }: VolumeChartProps) {
  // Filter data based on time range
  const chartData = useMemo(() => {
    if (timeRange === 'all') return data;

    const minutes = timeRange === '5m' ? 5 : 15;
    const secondsToShow = minutes * 60;
    const ticksToShow = Math.min(secondsToShow, data.length);

    return data.slice(-ticksToShow);
  }, [data, timeRange]);

  // Format chart data for Recharts (group by minute)
  const formattedData = useMemo(() => {
    const grouped = new Map<string, { time: string; home_volume: number; away_volume: number }>();

    chartData.forEach((tick) => {
      const time = new Date(tick.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      if (grouped.has(time)) {
        const existing = grouped.get(time)!;
        existing.home_volume += tick.home_volume || 0;
        existing.away_volume += tick.away_volume || 0;
      } else {
        grouped.set(time, {
          time,
          home_volume: tick.home_volume || 0,
          away_volume: tick.away_volume || 0
        });
      }
    });

    return Array.from(grouped.values());
  }, [chartData]);

  if (formattedData.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 h-80 flex items-center justify-center">
        <p className="text-slate-400">No volume data available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-bold mb-4">Trading Volume</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={formattedData}>
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
            label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#f1f5f9'
            }}
            labelStyle={{ color: '#cbd5e1' }}
            cursor={{ fill: '#334155' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="square"
          />
          <Bar
            dataKey="home_volume"
            fill="#10b981"
            name={homeTeam || 'Home'}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="away_volume"
            fill="#f97316"
            name={awayTeam || 'Away'}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
