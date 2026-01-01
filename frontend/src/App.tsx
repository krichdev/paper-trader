import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { GameCard } from './components/GameCard';
import { BotPanel } from './components/BotPanel';
import { 
  fetchGames, 
  fetchActiveGames, 
  startLogging, 
  stopLogging,
  startBot,
  stopBot,
  updateBotConfig,
  getBotTrades
} from './lib/api';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

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
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [botRunning, setBotRunning] = useState<Record<string, boolean>>({});
  const [botTrades, setBotTrades] = useState<Record<string, any[]>>({});
  const [botSummary, setBotSummary] = useState<Record<string, any>>({});
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
    } else if (lastMessage.type === 'bot_entry' || lastMessage.type === 'bot_exit') {
      if (lastMessage.event_ticker) {
        loadBotTrades(lastMessage.event_ticker);
      }
    } else if (lastMessage.type === 'init') {
      if (lastMessage.data?.active_games) {
        setActiveGames(lastMessage.data.active_games);
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

  const isSelectedActive = activeGames.some(g => g.event_ticker === selectedGame);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2">
            🏈 Paper Trader
          </h1>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
              {isConnected ? 'Live' : 'Disconnected'}
            </div>
            <button
              onClick={loadGames}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
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
          <div className="space-y-4">
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
                <h3 className="font-bold mb-2">Bot Panel</h3>
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
                  <span className="text-slate-400">Bots Running</span>
                  <span className="font-bold text-purple-400">
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
