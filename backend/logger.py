"""
Game Logger - Fetches data from Kalshi API and stores in database
"""

import asyncio
import httpx
from datetime import datetime, timezone
from typing import Optional, Callable, Any

KALSHI_API_BASE = "https://api.elections.kalshi.com/trade-api/v2"


class GameLogger:
    def __init__(
        self,
        event_ticker: str,
        milestone_id: str,
        db: Any,
        broadcast_fn: Optional[Callable] = None,
        start_tick: int = 0,
        interval: int = 15
    ):
        self.event_ticker = event_ticker
        self.milestone_id = milestone_id
        self.db = db
        self.broadcast_fn = broadcast_fn
        self.interval = interval
        
        self.tick_count = start_tick
        self.is_running = False
        self.status = "initialized"
        
        # Team info
        self.home_team = ""
        self.away_team = ""
        self.home_team_id = ""
        self.away_team_id = ""
        
        # Last known state
        self.last_home_price = 0
        self.last_away_price = 0
        self.last_home_score = 0
        self.last_away_score = 0
        self.last_quarter = 0
        self.last_clock = ""
        self.last_play = ""
        
        # Attached bot
        self.bot = None
    
    def attach_bot(self, bot):
        """Attach a dry-run bot to receive tick updates"""
        self.bot = bot
    
    def detach_bot(self):
        """Detach the bot"""
        self.bot = None
    
    async def start(self):
        """Start the logging loop"""
        self.is_running = True
        self.status = "running"
        
        # Fetch initial team info
        await self._fetch_team_info()
        
        while self.is_running:
            try:
                await self._tick()
                await asyncio.sleep(self.interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Logger error for {self.event_ticker}: {e}")
                await asyncio.sleep(self.interval)
        
        self.status = "stopped"
    
    async def stop(self):
        """Stop the logging loop"""
        self.is_running = False
    
    async def _fetch_team_info(self):
        """Fetch team names and IDs from event endpoint"""
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{KALSHI_API_BASE}/events/{self.event_ticker}",
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    markets = data.get('markets', [])
                    
                    if len(markets) >= 2:
                        self.home_team = markets[0].get('yes_sub_title', 'Home')
                        self.home_team_id = markets[0].get('custom_strike', {}).get('football_team', '')
                        self.away_team = markets[1].get('yes_sub_title', 'Away')
                        self.away_team_id = markets[1].get('custom_strike', {}).get('football_team', '')
                        
                        # Update session with team names
                        await self.db.update_session_teams(
                            self.event_ticker,
                            self.home_team,
                            self.away_team
                        )

                        # Broadcast team info to frontend immediately
                        if self.broadcast_fn:
                            await self.broadcast_fn({
                                "type": "team_info",
                                "event_ticker": self.event_ticker,
                                "data": {
                                    "home_team": self.home_team,
                                    "away_team": self.away_team
                                }
                            })
            except Exception as e:
                print(f"Error fetching team info: {e}")
    
    async def _tick(self):
        """Perform one tick - fetch data and store"""
        self.tick_count += 1
        now = datetime.now(timezone.utc)
        
        # Fetch market data
        market_data = await self._fetch_market_data()
        
        # Fetch live game state
        live_data = await self._fetch_live_data()
        
        # Build tick record
        tick = self._build_tick(now, market_data, live_data)
        
        # Store in database
        await self.db.insert_tick(tick)
        await self.db.update_session_tick(self.event_ticker, self.tick_count)
        
        # Update last known state
        self._update_state(tick)
        
        # Notify bot if attached
        if self.bot:
            await self.bot.on_tick(tick)
        
        # Broadcast to WebSocket clients
        if self.broadcast_fn:
            # Convert datetime to string for JSON serialization
            tick_data = tick.copy()
            if 'timestamp' in tick_data and tick_data['timestamp']:
                tick_data['timestamp'] = tick_data['timestamp'].isoformat()
            # Add tick_count for frontend compatibility
            tick_data['tick_count'] = self.tick_count

            await self.broadcast_fn({
                "type": "tick",
                "event_ticker": self.event_ticker,
                "data": tick_data
            })
        
        # Check if game ended
        if tick.get('status') in ['complete', 'final', 'closed']:
            self.is_running = False
            self.status = "complete"
            await self.db.update_session_status(self.event_ticker, "complete")
    
    async def _fetch_market_data(self) -> dict:
        """Fetch current market prices"""
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{KALSHI_API_BASE}/events/{self.event_ticker}",
                    timeout=10
                )
                
                if resp.status_code == 200:
                    return resp.json()
            except Exception as e:
                print(f"Error fetching market data: {e}")
        
        return {}
    
    async def _fetch_live_data(self) -> dict:
        """Fetch live game state"""
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{KALSHI_API_BASE}/live_data/football_game/milestone/{self.milestone_id}",
                    timeout=10
                )
                
                if resp.status_code == 200:
                    return resp.json().get('live_data', {}).get('details', {})
            except Exception as e:
                print(f"Error fetching live data: {e}")
        
        return {}
    
    def _build_tick(self, timestamp: datetime, market_data: dict, live_data: dict) -> dict:
        """Build a tick record from API data"""
        markets = market_data.get('markets', [])
        home = markets[0] if len(markets) > 0 else {}
        away = markets[1] if len(markets) > 1 else {}
        
        situation = live_data.get('situation', {})
        last_play_obj = live_data.get('last_play', {})
        
        home_score = live_data.get('home_points', 0)
        away_score = live_data.get('away_points', 0)
        
        return {
            'event_ticker': self.event_ticker,
            'tick': self.tick_count,
            'timestamp': timestamp,
            'home_team': self.home_team,
            'away_team': self.away_team,
            'home_price': home.get('last_price', 0),
            'away_price': away.get('last_price', 0),
            'home_bid': home.get('yes_bid', 0),
            'home_ask': home.get('yes_ask', 0),
            'away_bid': away.get('yes_bid', 0),
            'away_ask': away.get('yes_ask', 0),
            'home_volume': home.get('volume', 0),
            'away_volume': away.get('volume', 0),
            'quarter': live_data.get('quarter', 0),
            'clock': live_data.get('clock', ''),
            'home_score': home_score,
            'away_score': away_score,
            'score_diff': home_score - away_score,
            'possession_team_id': situation.get('possession_team_id', ''),
            'down': situation.get('down', 0),
            'yards_to_go': situation.get('yfd', 0),
            'yardline': situation.get('yardline', 0),
            'goal_to_go': situation.get('goal_to_go', False),
            'status': live_data.get('status', 'unknown'),
            'last_play': (last_play_obj.get('description', '') if last_play_obj else '')[:200]
        }
    
    def _update_state(self, tick: dict):
        """Update last known state"""
        self.last_home_price = tick.get('home_price', 0)
        self.last_away_price = tick.get('away_price', 0)
        self.last_home_score = tick.get('home_score', 0)
        self.last_away_score = tick.get('away_score', 0)
        self.last_quarter = tick.get('quarter', 0)
        self.last_clock = tick.get('clock', '')
        self.last_play = tick.get('last_play', '')
