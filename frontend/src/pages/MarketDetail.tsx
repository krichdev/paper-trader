import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Rocket } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PriceChart } from '../components/charts/PriceChart';
import { VolumeChart } from '../components/charts/VolumeChart';
import { BotPerformanceChart } from '../components/charts/BotPerformanceChart';
import { TwitterFeed } from '../components/TwitterFeed';
import { MarketStats } from '../components/MarketStats';
import { getGameTicks, getBotTrades } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface GameTick {
  tick: number;
  timestamp: string;
  home_price: number;
  away_price: number;
  home_volume: number;
  away_volume: number;
  home_team?: string;
  away_team?: string;
  home_score?: number;
  away_score?: number;
  quarter?: number;
  clock?: string;
  status?: string;
}

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

interface Game {
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
  league?: string;
  tick_count?: number;
}

export function MarketDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();

  const [tickData, setTickData] = useState<GameTick[]>([]);
  const [botTrades, setBotTrades] = useState<Trade[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'5m' | '15m' | 'all'>('all');

  // WebSocket connection
  const wsUrl = import.meta.env.PROD
    ? `wss://${window.location.host}/ws`
    : `ws://${window.location.hostname}:8000/ws`;
  const { lastMessage, isConnected } = useWebSocket(wsUrl);

  // Initial data load
  useEffect(() => {
    if (!ticker) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch tick data
        const ticksResponse = await getGameTicks(ticker, 1000);
        if (ticksResponse.ticks && ticksResponse.ticks.length > 0) {
          setTickData(ticksResponse.ticks);

          // Extract game info from latest tick
          const latestTick = ticksResponse.ticks[ticksResponse.ticks.length - 1];
          setGame({
            event_ticker: ticker,
            home_team: latestTick.home_team,
            away_team: latestTick.away_team,
            home_price: latestTick.home_price,
            away_price: latestTick.away_price,
            home_score: latestTick.home_score,
            away_score: latestTick.away_score,
            quarter: latestTick.quarter,
            clock: latestTick.clock,
            status: latestTick.status,
            tick_count: ticksResponse.ticks.length
          });
        }

        // Fetch bot trades (if any)
        try {
          const tradesResponse = await getBotTrades(ticker);
          if (tradesResponse.trades) {
            setBotTrades(tradesResponse.trades);
          }
        } catch (e) {
          // Bot trades might not exist - that's okay
          console.log('No bot trades found');
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load market data:', err);
        setError('Failed to load market data');
        setLoading(false);
      }
    };

    loadData();
  }, [ticker]);

  // Real-time WebSocket updates
  useEffect(() => {
    if (!lastMessage || !ticker) return;

    if (lastMessage.type === 'tick' && lastMessage.event_ticker === ticker) {
      setTickData(prev => [...prev, lastMessage.data]);

      // Update game state with latest tick
      setGame(prev => ({
        ...prev,
        event_ticker: ticker,
        home_team: lastMessage.data.home_team || prev?.home_team,
        away_team: lastMessage.data.away_team || prev?.away_team,
        home_price: lastMessage.data.home_price,
        away_price: lastMessage.data.away_price,
        home_score: lastMessage.data.home_score,
        away_score: lastMessage.data.away_score,
        quarter: lastMessage.data.quarter,
        clock: lastMessage.data.clock,
        status: lastMessage.data.status,
        tick_count: (prev?.tick_count || 0) + 1
      }));
    }

    // Update bot trades on trade events
    if (
      (lastMessage.type === 'live_bot_exit' || lastMessage.type === 'live_bot_entry') &&
      lastMessage.event_ticker === ticker
    ) {
      // Refetch trades when new trade occurs
      getBotTrades(ticker)
        .then(response => {
          if (response.trades) {
            setBotTrades(response.trades);
          }
        })
        .catch(err => console.error('Failed to update trades:', err));
    }
  }, [lastMessage, ticker]);

  // Share button handler
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  if (!ticker) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Invalid market</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        {/* Header skeleton */}
        <header className="bg-slate-800 border-b border-slate-700 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="h-8 bg-slate-700 rounded w-64 animate-pulse"></div>
          </div>
        </header>

        {/* Content skeleton */}
        <main className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-96 bg-slate-800 rounded-xl animate-pulse"></div>
              <div className="h-96 bg-slate-800 rounded-xl animate-pulse"></div>
            </div>
            <div className="space-y-4">
              <div className="h-64 bg-slate-800 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const latestTick = tickData[tickData.length - 1];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Left: Back button and title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold">
                  {game?.title || `${game?.away_team || 'Away'} @ ${game?.home_team || 'Home'}`}
                </h1>
                {game?.league && (
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded mt-1 inline-block">
                    {game.league}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Status badge and actions */}
            <div className="flex items-center gap-3">
              {/* WebSocket Status */}
              <div className={`flex items-center gap-2 text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="hidden sm:inline">{isConnected ? 'Live' : 'Disconnected'}</span>
              </div>

              {/* Status Badge */}
              {game?.status && (
                <div className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                  game.status === 'live' || game.status === 'in_progress' ? 'bg-green-500/20 text-green-400' :
                  game.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-slate-600 text-slate-300'
                }`}>
                  {game.status}
                </div>
              )}

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Share this market"
              >
                <Share2 size={18} />
              </button>

              {/* Deploy Bot Link */}
              <Link
                to="/"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-sm"
              >
                <Rocket size={16} />
                Deploy Bot
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        {/* Time Range Selector */}
        <div className="mb-4 flex gap-2">
          {(['5m', '15m', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                timeRange === range
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {range === 'all' ? 'All' : range.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Charts Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Price Chart */}
            <PriceChart
              data={tickData}
              homeTeam={game?.home_team}
              awayTeam={game?.away_team}
              timeRange={timeRange}
            />

            {/* Volume Chart */}
            <VolumeChart
              data={tickData}
              homeTeam={game?.home_team}
              awayTeam={game?.away_team}
              timeRange={timeRange}
            />

            {/* Bot Performance Chart (conditional) */}
            {botTrades.length > 0 && (
              <BotPerformanceChart trades={botTrades} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Market Stats */}
            <MarketStats
              homeTeam={game?.home_team}
              awayTeam={game?.away_team}
              homePrice={latestTick?.home_price}
              awayPrice={latestTick?.away_price}
              homeVolume={latestTick?.home_volume}
              awayVolume={latestTick?.away_volume}
              tickCount={game?.tick_count}
              quarter={latestTick?.quarter}
              clock={latestTick?.clock}
              homeScore={latestTick?.home_score}
              awayScore={latestTick?.away_score}
              status={game?.status}
            />

            {/* Twitter Feed */}
            <TwitterFeed
              homeTeam={game?.home_team}
              awayTeam={game?.away_team}
              league={game?.league}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
