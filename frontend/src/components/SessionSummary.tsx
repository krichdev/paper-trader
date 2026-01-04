import { DollarSign, TrendingUp, Award, Activity } from 'lucide-react';

interface SessionSummaryProps {
  activeBotCount: number;
  totalPnl: number;
  totalValue: number;
  totalStartingValue: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
}

export function SessionSummary({
  activeBotCount,
  totalPnl,
  totalValue,
  totalStartingValue,
  totalTrades,
  totalWins,
  totalLosses
}: SessionSummaryProps) {
  const returnPct = totalStartingValue > 0
    ? ((totalValue / totalStartingValue - 1) * 100)
    : 0;

  const winRate = totalTrades > 0
    ? ((totalWins / totalTrades) * 100)
    : 0;

  if (activeBotCount === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-slate-800 rounded-xl p-6 border border-purple-500/30 mb-6">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Activity className="text-purple-400" size={20} />
        Session Summary
      </h2>

      {/* Desktop: Horizontal layout */}
      <div className="hidden md:grid md:grid-cols-5 gap-4">
        {/* Active Bots */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Active Bots</div>
          <div className="text-2xl font-bold text-purple-400">{activeBotCount}</div>
        </div>

        {/* Total Value */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
            <DollarSign size={12} />
            Total Value
          </div>
          <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
        </div>

        {/* Total P&L */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
            <TrendingUp size={12} />
            Total P&L
          </div>
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
        </div>

        {/* Return % */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Return</div>
          <div className={`text-2xl font-bold ${returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
            <Award size={12} />
            Win Rate
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            <span className="text-green-400">{totalWins}</span>
            <span className="text-slate-400">/</span>
            <span className="text-red-400">{totalLosses}</span>
          </div>
        </div>
      </div>

      {/* Mobile: 2x3 Grid */}
      <div className="grid grid-cols-2 md:hidden gap-3">
        {/* Active Bots */}
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Active Bots</div>
          <div className="text-xl font-bold text-purple-400">{activeBotCount}</div>
        </div>

        {/* Total Value */}
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Total Value</div>
          <div className="text-xl font-bold">${totalValue.toFixed(0)}</div>
        </div>

        {/* Total P&L */}
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Total P&L</div>
          <div className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}
          </div>
        </div>

        {/* Return % */}
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Return</div>
          <div className={`text-xl font-bold ${returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 col-span-2">
          <div className="text-slate-400 text-xs mb-1">Win Rate</div>
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-blue-400">{winRate.toFixed(1)}%</div>
            <div className="text-sm text-slate-500">
              <span className="text-green-400">{totalWins}</span>
              <span className="text-slate-400"> / </span>
              <span className="text-red-400">{totalLosses}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
