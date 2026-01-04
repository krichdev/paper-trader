import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './contexts/AuthContext';
import { GameCard } from './components/GameCard';
import { GameDetailModal } from './components/GameDetailModal';
import { ActiveBotsList } from './components/ActiveBotsList';
import { SessionSummary } from './components/SessionSummary';
import {
  fetchGames,
  fetchActiveGames,
  startLogging,
  getBotTrades,
  startLiveBot,
  stopLiveBot,
  updateLiveBotConfig,
  topUpLiveBot
} from './lib/api';
import { RefreshCw, Wifi, WifiOff, LogOut, Wallet, User, Trophy } from 'lucide-react';

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
  const [liveBotRunning, setLiveBotRunning] = useState<Record<string, boolean>>({});
  const [liveBotWallets, setLiveBotWallets] = useState<Record<string, any>>({});
  const [liveBotTrades, setLiveBotTrades] = useState<Record<string, any[]>>({});
  const [activeBotsExpanded, setActiveBotsExpanded] = useState<Record<string, boolean>>({});
  const [gameDetailModalOpen, setGameDetailModalOpen] = useState(false);
  const [selectedGameForModal, setSelectedGameForModal] = useState<Game | null>(null);
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

      // Get game title for toast
      const game = activeGames.find(g => g.event_ticker === ticker) || availableGames.find(g => g.event_ticker === ticker);
      const gameTitle = game?.title || (game?.home_team && game?.away_team ? `${game.away_team} @ ${game.home_team}` : ticker);

      if (lastMessage.type === 'live_bot_entry' && lastMessage.data) {
        // Trade entry toast
        const { side, price, contracts } = lastMessage.data;
        toast.success(
          `${gameTitle}\n${side.toUpperCase()} entry at ${price}¢ (${contracts} contracts)`,
          {
            duration: 4000,
            icon: side === 'long' ? '📈' : '📉',
          }
        );
      } else if (lastMessage.type === 'live_bot_exit' && lastMessage.data) {
        // Trade exit toast
        const { side, exit_price, pnl, reason } = lastMessage.data;
        const pnlFormatted = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
        toast(
          `${gameTitle}\n${side.toUpperCase()} exit at ${exit_price}¢ • ${pnlFormatted} (${reason})`,
          {
            duration: 5000,
            icon: pnl >= 0 ? '✅' : '❌',
            style: {
              background: pnl >= 0 ? '#065f46' : '#991b1b',
              color: '#fff',
            },
          }
        );
      }

      if (ticker) {
        loadLiveBotTrades(ticker);
      }
      // Refresh wallet balance when trade exits (funds + P&L returned)
      if (lastMessage.type === 'live_bot_exit') {
        refreshUser();
      }
    } else if (lastMessage.type === 'live_bot_topup') {
      refreshUser();
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

  const handleTopUpLiveBot = async (eventTicker: string, amount: number) => {
    try {
      await topUpLiveBot(eventTicker, amount);
      await refreshUser(); // Refresh wallet balance after top-up
    } catch (e: any) {
      console.error('Failed to top up live bot:', e);
      throw e; // Re-throw so component can handle error display
    }
  };

  const handleOpenGameDetail = (game: Game) => {
    setSelectedGameForModal(game);
    setGameDetailModalOpen(true);
  };

  const handleCloseGameDetail = () => {
    setGameDetailModalOpen(false);
    setSelectedGameForModal(null);
  };

  const handleDeployBot = async (eventTicker: string, milestoneId: string, config: any) => {
    try {
      // Step 1: Auto-start logging (hidden from user)
      await startLogging(eventTicker, milestoneId);

      // Step 2: Wait briefly for logging to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Start the bot
      await startLiveBot(eventTicker, config);

      // Step 4: Update local state
      setLiveBotRunning(prev => ({ ...prev, [eventTicker]: true }));
      loadLiveBotTrades(eventTicker);
      await refreshUser(); // Refresh wallet balance after starting bot

      // Step 5: Reload games to get updated state
      await loadGames();

      // Step 6: Close modal
      handleCloseGameDetail();
    } catch (e: any) {
      console.error('Failed to deploy bot:', e);
      alert(e.message || 'Failed to deploy bot');
    }
  };

  const handleToggleBotExpand = (eventTicker: string) => {
    setActiveBotsExpanded(prev => ({ ...prev, [eventTicker]: !prev[eventTicker] }));
  };

  // Filter games by league and search text, excluding completed/past games
  const filteredAvailableGames = availableGames.filter(game => {
    // Filter out completed games
    if (game.status?.toLowerCase().includes('complete') || game.status === 'COMPLETE') {
      return false;
    }

    // Filter out games with start times more than 6 hours in the past
    // (likely finished or stale, but keep in-progress games within 6 hours)
    if (game.start_date) {
      const startTime = new Date(game.start_date);
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      if (startTime < sixHoursAgo) {
        return false;
      }
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
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
        }}
      />

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
                  to="/leaderboard"
                  className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  title="Leaderboard"
                >
                  <Trophy size={16} className="sm:w-[18px] sm:h-[18px]" />
                </Link>
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
        <div className="space-y-6">
          {/* Active Bots List */}
          <ActiveBotsList
            activeBots={Object.keys(liveBotRunning)
              .filter(ticker => liveBotRunning[ticker])
              .map(ticker => {
                const game = activeGames.find(g => g.event_ticker === ticker) || availableGames.find(g => g.event_ticker === ticker);
                return {
                  eventTicker: ticker,
                  gameTitle: game?.title || (game?.home_team && game?.away_team ? `${game.away_team} @ ${game.home_team}` : ticker),
                  wallet: liveBotWallets[ticker] || null,
                  trades: liveBotTrades[ticker] || [],
                  isExpanded: activeBotsExpanded[ticker] || false
                };
              })}
            onToggleExpand={handleToggleBotExpand}
            onStopBot={handleStopLiveBot}
            onTopUp={(ticker) => handleTopUpLiveBot(ticker, 100)}
            onUpdateConfig={handleUpdateLiveBotConfig}
          />

          {/* Session Summary */}
          <SessionSummary
            activeBotCount={Object.values(liveBotRunning).filter(Boolean).length}
            totalPnl={Object.values(liveBotWallets).reduce((sum, wallet) => sum + (wallet?.total_pnl || 0), 0)}
            totalValue={Object.values(liveBotWallets).reduce((sum, wallet) => sum + (wallet?.total_value || 0), 0)}
            totalStartingValue={Object.values(liveBotWallets).reduce((sum, wallet) => sum + (wallet?.starting_bankroll || 0), 0)}
            totalTrades={Object.values(liveBotWallets).reduce((sum, wallet) => sum + (wallet?.stats?.total_trades || 0), 0)}
            totalWins={Object.values(liveBotWallets).reduce((sum, wallet) => sum + (wallet?.stats?.wins || 0), 0)}
            totalLosses={Object.values(liveBotWallets).reduce((sum, wallet) => sum + (wallet?.stats?.losses || 0), 0)}
          />

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredAvailableGames.map(game => (
                    <GameCard
                      key={game.event_ticker}
                      game={game}
                      hasBotRunning={liveBotRunning[game.event_ticker] || false}
                      onClick={() => handleOpenGameDetail(game)}
                    />
                  ))}
                </div>
              )}
            </div>

          {/* Game Detail Modal */}
          <GameDetailModal
            game={selectedGameForModal}
            isOpen={gameDetailModalOpen}
            onClose={handleCloseGameDetail}
            onStartBot={handleDeployBot}
            userBalance={user?.current_balance || 0}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
