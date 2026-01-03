import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './contexts/AuthContext';
import { GameCard } from './components/GameCard';
import { LiveBotPanel } from './components/LiveBotPanel';
import {
  fetchGames,
  fetchActiveGames,
  startLogging,
  stopLogging,
  getBotTrades,
  startLiveBot,
  stopLiveBot,
  updateLiveBotConfig
} from './lib/api';
import { RefreshCw, Wifi, WifiOff, LogOut, Wallet, User } from 'lucide-react';

interface Game {
  event_ticker: string;
  title?: string;
  milestone_id?: string;
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
  start_date?: string;
  league?: string;
}

function App() {
  const { user, logout, refreshUser } = useAuth();
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [liveBotRunning, setLiveBotRunning] = useState<Record<string, boolean>>({});
  const [liveBotWallets, setLiveBotWallets] = useState<Record<string, any>>({});
  const [liveBotTrades, setLiveBotTrades] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [leagueFilter, setLeagueFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  // Determine WebSocket URL based on environment
  const wsUrl = import.meta.env.PROD 
    ? `wss://${window.location.host}/ws`
    : `ws://${window.location.hostname}:8000/ws`;
  
  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  // Load games on mount
  useEffect(() => {
    loadGames();
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'tick') {
      setActiveGames(prev => prev.map(game =>
        game.event_ticker === lastMessage.event_ticker
          ? { ...game, ...lastMessage.data }
          : game
      ));
    } else if (lastMessage.type === 'team_info') {
      setActiveGames(prev => prev.map(game =>
        game.event_ticker === lastMessage.event_ticker
          ? { ...game, ...lastMessage.data }
          : game
      ));
    } else if (lastMessage.type === 'live_bot_started') {
      const ticker = lastMessage.event_ticker;
      if (ticker) {
        setLiveBotRunning(prev => ({ ...prev, [ticker]: true }));
        loadLiveBotTrades(ticker);
      }
    } else if (lastMessage.type === 'live_bot_stopped') {
      const ticker = lastMessage.event_ticker;
      if (ticker) {
        setLiveBotRunning(prev => ({ ...prev, [ticker]: false }));
      }
      // Refresh wallet balance when bot stops (remaining bankroll returned)
      refreshUser();
    } else if (lastMessage.type === 'live_bot_wallet') {
      const ticker = lastMessage.event_ticker;
      if (ticker && lastMessage.data) {
        setLiveBotWallets(prev => ({ ...prev, [ticker]: lastMessage.data }));
      }
    } else if (lastMessage.type === 'live_bot_entry' || lastMessage.type === 'live_bot_exit') {
      const ticker = lastMessage.event_ticker;
      console.log('[WebSocket] Live bot trade event:', lastMessage.type, ticker);
      if (ticker) {
        loadLiveBotTrades(ticker);
      }
      // Refresh wallet balance when trade exits (funds + P&L returned)
      if (lastMessage.type === 'live_bot_exit') {
        refreshUser();
      }
    } else if (lastMessage.type === 'init') {
      if (lastMessage.data?.active_games) {
        setActiveGames(lastMessage.data.active_games);
      }
      if (lastMessage.data?.active_live_bots) {
        const runningLiveBots: Record<string, boolean> = {};
        lastMessage.data.active_live_bots.forEach((ticker: string) => {
          runningLiveBots[ticker] = true;
        });
        setLiveBotRunning(runningLiveBots);
        // Load trades for active live bots
        lastMessage.data.active_live_bots.forEach((ticker: string) => {
          loadLiveBotTrades(ticker);
        });
      }
      if (lastMessage.data?.live_bot_wallets) {
        setLiveBotWallets(lastMessage.data.live_bot_wallets);
      }
    }
  }, [lastMessage]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const [available, active] = await Promise.all([
        fetchGames(),
        fetchActiveGames()
      ]);
      setAvailableGames(available.games || []);
      setActiveGames(active.games || []);
    } catch (e) {
      console.error('Failed to load games:', e);
    }
    setLoading(false);
  };

  const loadLiveBotTrades = async (eventTicker: string) => {
    try {
      console.log('[API] Loading live bot trades for:', eventTicker);
      const data = await getBotTrades(eventTicker);
      console.log('[API] Loaded trades:', data.trades?.length, 'trades');
      setLiveBotTrades(prev => ({ ...prev, [eventTicker]: data.trades || [] }));
    } catch (e) {
      console.error('Failed to load live bot trades:', e);
    }
  };

  const handleStartLogging = async (eventTicker: string, milestoneId: string) => {
    try {
      await startLogging(eventTicker, milestoneId);
      loadGames();
    } catch (e) {
      console.error('Failed to start logging:', e);
    }
  };

  const handleStopLogging = async (eventTicker: string) => {
    try {
      await stopLogging(eventTicker);
      loadGames();
    } catch (e) {
      console.error('Failed to stop logging:', e);
    }
  };

  const handleStartLiveBot = async (eventTicker: string, config: any) => {
    try {
      await startLiveBot(eventTicker, config);
      setLiveBotRunning(prev => ({ ...prev, [eventTicker]: true }));
      loadLiveBotTrades(eventTicker);
      await refreshUser(); // Refresh wallet balance after starting bot
    } catch (e: any) {
      console.error('Failed to start live bot:', e);
      alert(e.message || 'Failed to start live bot');
    }
  };

  const handleStopLiveBot = async (eventTicker: string) => {
    try {
      await stopLiveBot(eventTicker);
      setLiveBotRunning(prev => ({ ...prev, [eventTicker]: false }));
      await refreshUser(); // Refresh wallet balance after stopping bot
    } catch (e) {
      console.error('Failed to stop live bot:', e);
    }
  };

  const handleUpdateLiveBotConfig = async (eventTicker: string, config: any) => {
    try {
      await updateLiveBotConfig(eventTicker, config);
    } catch (e) {
      console.error('Failed to update live bot config:', e);
    }
  };

  const isSelectedActive = activeGames.some(g => g.event_ticker === selectedGame);

  // Filter games by league and search text, excluding completed games
  const filteredAvailableGames = availableGames.filter(game => {
    // Filter out completed games
    if (game.status?.toLowerCase().includes('complete') || game.status === 'COMPLETE') {
      return false;
    }

    // Filter by league
    if (leagueFilter !== 'all') {
      const gameLeague = game.league?.toLowerCase() || '';
      if (leagueFilter === 'nfl' && gameLeague !== 'nfl') return false;
      if (leagueFilter === 'nba' && gameLeague !== 'nba') return false;
      if (leagueFilter === 'ncaaf' && gameLeague !== 'ncaaf') return false;
      if (leagueFilter === 'ncaab' && gameLeague !== 'ncaab') return false;
    }

    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase();
      const title = game.title?.toLowerCase() || '';
      const homeTeam = game.home_team?.toLowerCase() || '';
      const awayTeam = game.away_team?.toLowerCase() || '';
      return title.includes(search) || homeTeam.includes(search) || awayTeam.includes(search);
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-2 sm:px-4 py-2 sm:py-3">
        <div className="max-w-7xl mx-auto">
          {/* Mobile: Stack vertically, Desktop: Single row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            {/* Top row on mobile / Left side on desktop */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <h1 className="text-base sm:text-xl font-bold flex items-center gap-1 sm:gap-2">
                🏈 <span className="hidden xs:inline">Paper Trader</span><span className="xs:hidden">PT</span>
              </h1>
              {user && (
                <div className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-700/50 rounded-lg border border-slate-600">
                  <Wallet size={14} className="text-green-400 sm:w-4 sm:h-4" />
                  <div className="text-xs sm:text-sm">
                    <div className="font-bold whitespace-nowrap">${user.current_balance.toFixed(2)}</div>
                    <div className={`text-[10px] sm:text-xs whitespace-nowrap ${user.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {user.total_pnl >= 0 ? '+' : ''}{user.total_pnl.toFixed(2)} P&L
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom row on mobile / Right side on desktop */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                {user && (
                  <div className="text-xs sm:text-sm text-slate-400 hidden sm:block">
                    {user.username}
                  </div>
                )}
                <div className={`flex items-center gap-1 text-xs sm:text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? <Wifi size={14} className="sm:w-4 sm:h-4" /> : <WifiOff size={14} className="sm:w-4 sm:h-4" />}
                  <span className="hidden sm:inline">{isConnected ? 'Live' : 'Disconnected'}</span>
                  <span className="sm:hidden">{isConnected ? 'Live' : 'Off'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={loadGames}
                  className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  disabled={loading}
                  title="Refresh games"
                >
                  <RefreshCw size={16} className={`sm:w-[18px] sm:h-[18px] ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  to="/profile"
                  className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  title="Profile & Stats"
                >
                  <User size={16} className="sm:w-[18px] sm:h-[18px]" />
                </Link>
                <button
                  onClick={logout}
                  className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-2 sm:p-4">
        {/* Mobile: vertical stack, Desktop: 2-column grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">

          {/* Live Bot Panel & Stats - First on mobile, right sidebar on desktop */}
          <div className="space-y-4 lg:order-2 lg:col-span-1">
            {/* Live Paper Bot Panel */}
            {selectedGame && isSelectedActive ? (() => {
              const selectedGameData = activeGames.find(g => g.event_ticker === selectedGame);
              return (
                <LiveBotPanel
                  eventTicker={selectedGame}
                  homeTeam={selectedGameData?.home_team}
                  awayTeam={selectedGameData?.away_team}
                  tickCount={selectedGameData?.tick_count}
                  isRunning={liveBotRunning[selectedGame] || false}
                  wallet={liveBotWallets[selectedGame] || null}
                  trades={liveBotTrades[selectedGame] || []}
                  onStart={(config) => handleStartLiveBot(selectedGame, config)}
                  onStop={() => handleStopLiveBot(selectedGame)}
                  onUpdateConfig={(config) => handleUpdateLiveBotConfig(selectedGame, config)}
                />
              );
            })() : (
              <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border-2 border-purple-500/50 text-center">
                <div className="text-slate-400 mb-2 text-3xl sm:text-4xl">💰</div>
                <h3 className="font-bold mb-2 text-sm sm:text-base">Live Paper Bot</h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  {selectedGame
                    ? 'Start logging this game to enable live trading'
                    : 'Select an active game to start trading'}
                </p>
              </div>
            )}

            {/* Session Stats */}
            <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border-2 border-slate-700">
              <h3 className="font-bold mb-2 sm:mb-3 text-sm sm:text-base">📊 Session Stats</h3>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Games</span>
                  <span className="font-bold text-green-400">{activeGames.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Ticks</span>
                  <span className="font-bold">
                    {activeGames.reduce((sum, g) => sum + (g.tick_count || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Live Bots</span>
                  <span className="font-bold text-purple-400">
                    {Object.values(liveBotRunning).filter(Boolean).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Games List - Second on mobile, left side on desktop */}
          <div className="space-y-4 lg:order-1 lg:col-span-2">
            {/* Active Games Section */}
            {activeGames.length > 0 && (
              <div>
                <h2 className="text-base sm:text-lg font-bold mb-3 text-green-400">🟢 Active Logging</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {activeGames.map(game => (
                    <GameCard
                      key={game.event_ticker}
                      game={game}
                      isActive={true}
                      isSelected={selectedGame === game.event_ticker}
                      onStop={handleStopLogging}
                      onSelect={setSelectedGame}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Available Games Section */}
            <div>
              <h2 className="text-base sm:text-lg font-bold mb-3">📅 Available Games</h2>

              {/* Filters & Search */}
              <div className="mb-4 space-y-2 sm:space-y-3">
                {/* League Filter Pills */}
                <div className="flex flex-wrap gap-2">
                  {['all', 'nfl', 'nba', 'ncaaf', 'ncaab'].map(league => (
                    <button
                      key={league}
                      onClick={() => setLeagueFilter(league)}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
                        leagueFilter === league
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {league === 'all' ? 'All' : league.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {loading ? (
                <div className="text-center py-8 text-slate-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading games...</p>
                </div>
              ) : filteredAvailableGames.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">
                    {searchText || leagueFilter !== 'all'
                      ? 'No games match your filters.'
                      : 'No upcoming games found. Check back closer to game time.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {filteredAvailableGames
                    .filter(g => !activeGames.find(ag => ag.event_ticker === g.event_ticker))
                    .map(game => (
                      <GameCard
                        key={game.event_ticker}
                        game={game}
                        isActive={false}
                        onStart={handleStartLogging}
                        onSelect={setSelectedGame}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
