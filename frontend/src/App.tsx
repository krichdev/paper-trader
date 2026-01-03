import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './contexts/AuthContext';
import { GameCard } from './components/GameCard';
import { BotPanel } from './components/BotPanel';
import { LiveBotPanel } from './components/LiveBotPanel';
import {
  fetchGames,
  fetchActiveGames,
  startLogging,
  stopLogging,
  startBot,
  stopBot,
  updateBotConfig,
  getBotTrades,
  startLiveBot,
  stopLiveBot,
  updateLiveBotConfig
} from './lib/api';
import { RefreshCw, Wifi, WifiOff, LogOut, Wallet } from 'lucide-react';

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
  const { user, logout } = useAuth();
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [botRunning, setBotRunning] = useState<Record<string, boolean>>({});
  const [botTrades, setBotTrades] = useState<Record<string, any[]>>({});
  const [botSummary, setBotSummary] = useState<Record<string, any>>({});
  const [liveBotRunning, setLiveBotRunning] = useState<Record<string, boolean>>({});
  const [liveBotWallets, setLiveBotWallets] = useState<Record<string, any>>({});
  const [liveBotTrades, setLiveBotTrades] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

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
    } else if (lastMessage.type === 'bot_entry' || lastMessage.type === 'bot_exit') {
      if (lastMessage.event_ticker) {
        loadBotTrades(lastMessage.event_ticker);
      }
    } else if (lastMessage.type === 'bot_started') {
      const ticker = lastMessage.event_ticker;
      if (ticker) {
        setBotRunning(prev => ({ ...prev, [ticker]: true }));
        loadBotTrades(ticker);
      }
    } else if (lastMessage.type === 'bot_stopped') {
      const ticker = lastMessage.event_ticker;
      if (ticker) {
        setBotRunning(prev => ({ ...prev, [ticker]: false }));
      }
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
    } else if (lastMessage.type === 'init') {
      if (lastMessage.data?.active_games) {
        setActiveGames(lastMessage.data.active_games);
      }
      if (lastMessage.data?.active_bots) {
        const runningBots: Record<string, boolean> = {};
        lastMessage.data.active_bots.forEach((ticker: string) => {
          runningBots[ticker] = true;
        });
        setBotRunning(runningBots);
        // Load trades for active bots
        lastMessage.data.active_bots.forEach((ticker: string) => {
          loadBotTrades(ticker);
        });
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

  const loadBotTrades = async (eventTicker: string) => {
    try {
      const data = await getBotTrades(eventTicker);
      setBotTrades(prev => ({ ...prev, [eventTicker]: data.trades || [] }));
      setBotSummary(prev => ({ ...prev, [eventTicker]: data.summary }));
    } catch (e) {
      console.error('Failed to load bot trades:', e);
    }
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

  const handleStartBot = async (eventTicker: string, config: any) => {
    try {
      await startBot(eventTicker, config);
      setBotRunning(prev => ({ ...prev, [eventTicker]: true }));
      loadBotTrades(eventTicker);
    } catch (e) {
      console.error('Failed to start bot:', e);
    }
  };

  const handleStopBot = async (eventTicker: string) => {
    try {
      await stopBot(eventTicker);
      setBotRunning(prev => ({ ...prev, [eventTicker]: false }));
    } catch (e) {
      console.error('Failed to stop bot:', e);
    }
  };

  const handleUpdateBotConfig = async (eventTicker: string, config: any) => {
    try {
      await updateBotConfig(eventTicker, config);
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  };

  const handleStartLiveBot = async (eventTicker: string, config: any) => {
    try {
      await startLiveBot(eventTicker, config);
      setLiveBotRunning(prev => ({ ...prev, [eventTicker]: true }));
      loadLiveBotTrades(eventTicker);
    } catch (e) {
      console.error('Failed to start live bot:', e);
    }
  };

  const handleStopLiveBot = async (eventTicker: string) => {
    try {
      await stopLiveBot(eventTicker);
      setLiveBotRunning(prev => ({ ...prev, [eventTicker]: false }));
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

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              🏈 Paper Trader
            </h1>
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600">
                <Wallet size={16} className="text-green-400" />
                <div className="text-sm">
                  <div className="font-bold">${user.current_balance.toFixed(2)}</div>
                  <div className={`text-xs ${user.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {user.total_pnl >= 0 ? '+' : ''}{user.total_pnl.toFixed(2)} P&L
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm text-slate-400">
                {user.username}
              </div>
            )}
            <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
              {isConnected ? 'Live' : 'Disconnected'}
            </div>
            <button
              onClick={loadGames}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              disabled={loading}
              title="Refresh games"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={logout}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Games List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Active Games Section */}
            {activeGames.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3 text-green-400">🟢 Active Logging</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <h2 className="text-lg font-bold mb-3">📅 Available Games</h2>
              {loading ? (
                <div className="text-center py-8 text-slate-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                  Loading games...
                </div>
              ) : availableGames.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No upcoming games found. Check back closer to game time.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableGames
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

          {/* Bot Panel Sidebar */}
          <div className="space-y-6">
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
              <div className="bg-slate-800 rounded-xl p-6 border-2 border-purple-500/50 text-center">
                <div className="text-slate-400 mb-2 text-4xl">💰</div>
                <h3 className="font-bold mb-2">Live Paper Bot</h3>
                <p className="text-sm text-slate-400">
                  {selectedGame
                    ? 'Start logging this game to enable live trading'
                    : 'Select an active game to start trading'}
                </p>
              </div>
            )}

            {/* Dry Run Bot Panel */}
            {selectedGame && isSelectedActive ? (
              <BotPanel
                eventTicker={selectedGame}
                isRunning={botRunning[selectedGame] || false}
                trades={botTrades[selectedGame] || []}
                summary={botSummary[selectedGame]}
                onStart={(config) => handleStartBot(selectedGame, config)}
                onStop={() => handleStopBot(selectedGame)}
                onUpdateConfig={(config) => handleUpdateBotConfig(selectedGame, config)}
              />
            ) : (
              <div className="bg-slate-800 rounded-xl p-6 border-2 border-slate-700 text-center">
                <div className="text-slate-400 mb-2 text-4xl">🤖</div>
                <h3 className="font-bold mb-2">Dry Run Bot</h3>
                <p className="text-sm text-slate-400">
                  {selectedGame
                    ? 'Start logging this game to enable the bot'
                    : 'Select an active game to use the bot'}
                </p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-700">
              <h3 className="font-bold mb-3">📊 Session Stats</h3>
              <div className="space-y-2 text-sm">
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
                <div className="flex justify-between">
                  <span className="text-slate-400">Dry Run Bots</span>
                  <span className="font-bold text-blue-400">
                    {Object.values(botRunning).filter(Boolean).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
