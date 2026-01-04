import { useMemo } from 'react';
import {
  LineChart,
  Line,
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
  home_price: number;
  away_price: number;
  home_team?: string;
  away_team?: string;
  quarter?: number;
  clock?: string;
}

interface PriceChartProps {
  data: GameTick[];
  homeTeam?: string;
  awayTeam?: string;
  timeRange?: '5m' | '15m' | 'all';
}

export function PriceChart({ data, homeTeam, awayTeam, timeRange = 'all' }: PriceChartProps) {
  // Filter and downsample data based on time range
  const chartData = useMemo(() => {
    let filteredData = data;

    if (timeRange !== 'all') {
      const minutes = timeRange === '5m' ? 5 : 15;
      const secondsToShow = minutes * 60;
      const ticksToShow = Math.min(secondsToShow, data.length);
      filteredData = data.slice(-ticksToShow);
    }

    // Downsample: Show every Nth point to reduce visual clutter
    // For large datasets, only show ~200 points max
    const maxPoints = 200;
    if (filteredData.length > maxPoints) {
      const step = Math.ceil(filteredData.length / maxPoints);
      return filteredData.filter((_, index) => index % step === 0);
    }

    return filteredData;
  }, [data, timeRange]);

  // Format chart data for Recharts
  const formattedData = useMemo(() => {
    return chartData.map((tick) => ({
      ...tick,
      time: new Date(tick.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }));
  }, [chartData]);

  if (formattedData.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 h-80 flex items-center justify-center">
        <p className="text-slate-400">No price data available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-bold mb-4">Market Prices</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="time"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
            minTickGap={50}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
            label={{ value: 'Price (¢)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#f1f5f9'
            }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(value: number | undefined) => value !== undefined ? [`${value}¢`, ''] : ['', '']}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="home_price"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            name={homeTeam || 'Home'}
            activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
            animationDuration={300}
          />
          <Line
            type="monotone"
            dataKey="away_price"
            stroke="#f97316"
            strokeWidth={2.5}
            dot={false}
            name={awayTeam || 'Away'}
            activeDot={{ r: 5, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
