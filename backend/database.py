"""
Database module - Async Postgres with connection pooling
"""

import asyncpg
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import json


@dataclass
class GameTick:
    event_ticker: str
    tick: int
    timestamp: datetime
    home_team: str
    away_team: str
    home_price: int
    away_price: int
    home_bid: int
    home_ask: int
    away_bid: int
    away_ask: int
    home_volume: int
    away_volume: int
    quarter: int
    clock: str
    home_score: int
    away_score: int
    score_diff: int
    possession_team_id: str
    down: int
    yards_to_go: int
    yardline: int
    goal_to_go: bool
    status: str
    last_play: str


@dataclass
class GameSession:
    event_ticker: str
    milestone_id: str
    home_team: str
    away_team: str
    status: str
    started_at: datetime
    last_tick: int


@dataclass
class BotTrade:
    id: int
    event_ticker: str
    side: str
    team: str
    entry_price: int
    entry_tick: int
    entry_time: datetime
    exit_price: Optional[int]
    exit_tick: Optional[int]
    exit_time: Optional[datetime]
    exit_reason: Optional[str]
    pnl: Optional[float]
    config_snapshot: dict


class Database:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None
    
    async def connect(self):
        """Create connection pool"""
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=2,
            max_size=10
        )
    
    async def disconnect(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
    
    async def create_tables(self):
        """Create tables if they don't exist"""
        async with self.pool.acquire() as conn:
            # Users table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    starting_balance FLOAT DEFAULT 10000,
                    current_balance FLOAT DEFAULT 10000,
                    total_pnl FLOAT DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # Add default_bot_config column (migration)
            await conn.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='users' AND column_name='default_bot_config') THEN
                        ALTER TABLE users ADD COLUMN default_bot_config JSONB DEFAULT '{
                            "momentum_threshold": 8,
                            "initial_stop": 8,
                            "profit_target": 15,
                            "breakeven_trigger": 5,
                            "position_size_pct": 0.5
                        }'::jsonb;
                    END IF;
                END $$;
            """)

            # Wallet transactions table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS wallet_transactions (
                    id SERIAL PRIMARY KEY,
                    user_id INT REFERENCES users(id),
                    amount FLOAT NOT NULL,
                    type TEXT NOT NULL,
                    event_ticker TEXT,
                    trade_id INT,
                    balance_after FLOAT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS game_sessions (
                    event_ticker TEXT PRIMARY KEY,
                    milestone_id TEXT NOT NULL,
                    home_team TEXT,
                    away_team TEXT,
                    status TEXT DEFAULT 'active',
                    started_at TIMESTAMPTZ DEFAULT NOW(),
                    last_tick INT DEFAULT 0
                )
            """)

            # Add new columns for live bot persistence and user accounts (migration)
            await conn.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='game_sessions' AND column_name='live_bot_active') THEN
                        ALTER TABLE game_sessions ADD COLUMN live_bot_active BOOLEAN DEFAULT FALSE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='game_sessions' AND column_name='live_bot_bankroll') THEN
                        ALTER TABLE game_sessions ADD COLUMN live_bot_bankroll FLOAT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='game_sessions' AND column_name='live_bot_starting_bankroll') THEN
                        ALTER TABLE game_sessions ADD COLUMN live_bot_starting_bankroll FLOAT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='game_sessions' AND column_name='live_bot_config') THEN
                        ALTER TABLE game_sessions ADD COLUMN live_bot_config JSONB;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='game_sessions' AND column_name='user_id') THEN
                        ALTER TABLE game_sessions ADD COLUMN user_id INT REFERENCES users(id);
                    END IF;
                END $$;
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS game_ticks (
                    id SERIAL PRIMARY KEY,
                    event_ticker TEXT NOT NULL,
                    tick INT NOT NULL,
                    timestamp TIMESTAMPTZ NOT NULL,
                    home_team TEXT,
                    away_team TEXT,
                    home_price INT,
                    away_price INT,
                    home_bid INT,
                    home_ask INT,
                    away_bid INT,
                    away_ask INT,
                    home_volume BIGINT,
                    away_volume BIGINT,
                    quarter INT,
                    clock TEXT,
                    home_score INT,
                    away_score INT,
                    score_diff INT,
                    possession_team_id TEXT,
                    down INT,
                    yards_to_go INT,
                    yardline INT,
                    goal_to_go BOOLEAN,
                    status TEXT,
                    last_play TEXT,
                    UNIQUE(event_ticker, tick)
                )
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS bot_trades (
                    id SERIAL PRIMARY KEY,
                    event_ticker TEXT NOT NULL,
                    side TEXT NOT NULL,
                    team TEXT,
                    entry_price INT NOT NULL,
                    entry_tick INT NOT NULL,
                    entry_time TIMESTAMPTZ NOT NULL,
                    exit_price INT,
                    exit_tick INT,
                    exit_time TIMESTAMPTZ,
                    exit_reason TEXT,
                    pnl FLOAT,
                    config_snapshot JSONB
                )
            """)

            # Add contracts and user_id columns (migration)
            await conn.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='bot_trades' AND column_name='contracts') THEN
                        ALTER TABLE bot_trades ADD COLUMN contracts INT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_name='bot_trades' AND column_name='user_id') THEN
                        ALTER TABLE bot_trades ADD COLUMN user_id INT REFERENCES users(id);
                    END IF;
                END $$;
            """)

            # Create indexes
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_ticks_event ON game_ticks(event_ticker)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_ticks_event_tick ON game_ticks(event_ticker, tick)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_trades_event ON bot_trades(event_ticker)
            """)

    # ========================================================================
    # USER METHODS
    # ========================================================================

    async def create_user(self, username: str, password_hash: str, starting_balance: float = 10000.0) -> int:
        """Create a new user, return user ID"""
        async with self.pool.acquire() as conn:
            user_id = await conn.fetchval("""
                INSERT INTO users (username, password_hash, starting_balance, current_balance)
                VALUES ($1, $2, $3, $3)
                RETURNING id
            """, username, password_hash, starting_balance)
            return user_id

    async def get_user_by_username(self, username: str) -> Optional[Dict]:
        """Get user by username"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT * FROM users WHERE username = $1
            """, username)
            return dict(row) if row else None

    async def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        """Get user by ID"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT * FROM users WHERE id = $1
            """, user_id)
            return dict(row) if row else None

    async def update_user_balance(self, user_id: int, new_balance: float, pnl_change: float = 0) -> None:
        """Update user's balance and total P&L"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE users SET
                    current_balance = $2,
                    total_pnl = total_pnl + $3
                WHERE id = $1
            """, user_id, new_balance, pnl_change)

    async def get_user_default_bot_config(self, user_id: int) -> Dict:
        """Get user's default bot configuration"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT default_bot_config FROM users WHERE id = $1
            """, user_id)
            if row and row['default_bot_config']:
                config = row['default_bot_config']
                # Handle both string (old format) and dict (new format)
                if isinstance(config, str):
                    return json.loads(config)
                return dict(config)
            # Return system defaults if not set
            return {
                "momentum_threshold": 8,
                "initial_stop": 8,
                "profit_target": 15,
                "breakeven_trigger": 5,
                "position_size_pct": 0.5
            }

    async def update_user_default_bot_config(self, user_id: int, config: Dict) -> None:
        """Update user's default bot configuration"""
        async with self.pool.acquire() as conn:
            # Let asyncpg handle JSONB serialization automatically
            await conn.execute("""
                UPDATE users SET default_bot_config = $2::jsonb WHERE id = $1
            """, user_id, json.dumps(config))

    async def add_wallet_transaction(self, user_id: int, amount: float, tx_type: str, balance_after: float, event_ticker: str = None, trade_id: int = None) -> None:
        """Record a wallet transaction"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO wallet_transactions (user_id, amount, type, event_ticker, trade_id, balance_after)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, user_id, amount, tx_type, event_ticker, trade_id, balance_after)

    async def get_user_wallet_transactions(self, user_id: int, limit: int = 50) -> List[Dict]:
        """Get user's wallet transaction history"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM wallet_transactions
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            """, user_id, limit)
            return [dict(row) for row in rows]

    async def get_user_trades(self, user_id: int) -> List[Dict]:
        """Get all trades for a user"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM bot_trades
                WHERE user_id = $1
                ORDER BY entry_time DESC
            """, user_id)
            return [dict(row) for row in rows]

    async def get_user_active_bots(self, user_id: int) -> List[Dict]:
        """Get user's currently active bots"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT gs.event_ticker, gs.home_team, gs.away_team,
                       gs.live_bot_active, gs.live_bot_bankroll, gs.live_bot_starting_bankroll
                FROM game_sessions gs
                WHERE gs.live_bot_active = TRUE
                AND EXISTS (
                    SELECT 1 FROM bot_trades bt
                    WHERE bt.event_ticker = gs.event_ticker
                    AND bt.user_id = $1
                    AND bt.exit_price IS NULL
                )
                ORDER BY gs.last_tick DESC
            """, user_id)
            return [dict(row) for row in rows]

    async def reset_user_account(self, user_id: int) -> None:
        """Reset user account - delete all trades and transactions, reset balance to starting"""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Delete all trades
                await conn.execute("""
                    DELETE FROM bot_trades WHERE user_id = $1
                """, user_id)

                # Delete all wallet transactions
                await conn.execute("""
                    DELETE FROM wallet_transactions WHERE user_id = $1
                """, user_id)

                # Reset balance and P&L
                await conn.execute("""
                    UPDATE users SET
                        current_balance = starting_balance,
                        total_pnl = 0
                    WHERE id = $1
                """, user_id)

    async def get_leaderboard(self, limit: int = 50) -> List[Dict]:
        """Get leaderboard of top users by total P&L"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT
                    u.id,
                    u.username,
                    u.current_balance,
                    u.starting_balance,
                    u.total_pnl,
                    u.created_at,
                    COALESCE(COUNT(DISTINCT bt.id) FILTER (WHERE bt.exit_price IS NOT NULL), 0) as total_trades,
                    COALESCE(COUNT(DISTINCT bt.id) FILTER (WHERE bt.pnl > 0), 0) as wins,
                    COALESCE(COUNT(DISTINCT bt.id) FILTER (WHERE bt.pnl <= 0 AND bt.exit_price IS NOT NULL), 0) as losses,
                    COALESCE(
                        CASE
                            WHEN COUNT(DISTINCT bt.id) FILTER (WHERE bt.exit_price IS NOT NULL) > 0
                            THEN (COUNT(DISTINCT bt.id) FILTER (WHERE bt.pnl > 0)::float /
                                  COUNT(DISTINCT bt.id) FILTER (WHERE bt.exit_price IS NOT NULL)::float * 100)
                            ELSE 0
                        END,
                        0
                    ) as win_rate,
                    CASE
                        WHEN u.starting_balance > 0
                        THEN ((u.current_balance - u.starting_balance) / u.starting_balance * 100)
                        ELSE 0
                    END as return_pct
                FROM users u
                LEFT JOIN bot_trades bt ON bt.user_id = u.id
                GROUP BY u.id, u.username, u.current_balance, u.starting_balance, u.total_pnl, u.created_at
                ORDER BY u.total_pnl DESC
                LIMIT $1
            """, limit)

            return [dict(row) for row in rows]

    # ========================================================================
    # SESSION METHODS
    # ========================================================================
    
    async def create_session(self, event_ticker: str, milestone_id: str) -> None:
        """Create a new game session"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO game_sessions (event_ticker, milestone_id)
                VALUES ($1, $2)
                ON CONFLICT (event_ticker) DO UPDATE SET
                    status = 'active',
                    milestone_id = $2
            """, event_ticker, milestone_id)
    
    async def get_session(self, event_ticker: str) -> Optional[Dict]:
        """Get session by event ticker"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT * FROM game_sessions WHERE event_ticker = $1
            """, event_ticker)
            return dict(row) if row else None
    
    async def get_active_sessions(self) -> List[Dict]:
        """Get all active sessions"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM game_sessions WHERE status = 'active'
            """)
            return [dict(row) for row in rows]
    
    async def get_all_sessions(self) -> List[Dict]:
        """Get all sessions"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM game_sessions ORDER BY started_at DESC
            """)
            return [dict(row) for row in rows]
    
    async def update_session_status(self, event_ticker: str, status: str) -> None:
        """Update session status"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE game_sessions SET status = $2 WHERE event_ticker = $1
            """, event_ticker, status)
    
    async def update_session_teams(self, event_ticker: str, home_team: str, away_team: str) -> None:
        """Update session team names"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE game_sessions SET home_team = $2, away_team = $3 WHERE event_ticker = $1
            """, event_ticker, home_team, away_team)
    
    async def update_session_tick(self, event_ticker: str, tick: int) -> None:
        """Update last tick for session"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE game_sessions SET last_tick = $2 WHERE event_ticker = $1
            """, event_ticker, tick)

    async def save_live_bot_state(self, event_ticker: str, bankroll: float, starting_bankroll: float, config: Dict) -> None:
        """Save live bot state"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE game_sessions SET
                    live_bot_active = TRUE,
                    live_bot_bankroll = $2,
                    live_bot_starting_bankroll = $3,
                    live_bot_config = $4
                WHERE event_ticker = $1
            """, event_ticker, bankroll, starting_bankroll, json.dumps(config))

    async def update_live_bot_bankroll(self, event_ticker: str, bankroll: float) -> None:
        """Update just the bankroll for a live bot"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE game_sessions SET live_bot_bankroll = $2 WHERE event_ticker = $1
            """, event_ticker, bankroll)

    async def stop_live_bot(self, event_ticker: str) -> None:
        """Mark live bot as stopped"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE game_sessions SET live_bot_active = FALSE WHERE event_ticker = $1
            """, event_ticker)
    
    # ========================================================================
    # TICK METHODS
    # ========================================================================
    
    async def insert_tick(self, tick: Dict) -> None:
        """Insert a new tick"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO game_ticks (
                    event_ticker, tick, timestamp, home_team, away_team,
                    home_price, away_price, home_bid, home_ask, away_bid, away_ask,
                    home_volume, away_volume, quarter, clock, home_score, away_score,
                    score_diff, possession_team_id, down, yards_to_go, yardline,
                    goal_to_go, status, last_play
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
                )
                ON CONFLICT (event_ticker, tick) DO NOTHING
            """,
                tick['event_ticker'], tick['tick'], tick['timestamp'],
                tick.get('home_team'), tick.get('away_team'),
                tick.get('home_price'), tick.get('away_price'),
                tick.get('home_bid'), tick.get('home_ask'),
                tick.get('away_bid'), tick.get('away_ask'),
                tick.get('home_volume'), tick.get('away_volume'),
                tick.get('quarter'), tick.get('clock'),
                tick.get('home_score'), tick.get('away_score'),
                tick.get('score_diff'), tick.get('possession_team_id'),
                tick.get('down'), tick.get('yards_to_go'), tick.get('yardline'),
                tick.get('goal_to_go'), tick.get('status'), tick.get('last_play')
            )
    
    async def get_ticks(self, event_ticker: str, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get ticks for a game with pagination"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM game_ticks 
                WHERE event_ticker = $1 
                ORDER BY tick DESC
                LIMIT $2 OFFSET $3
            """, event_ticker, limit, offset)
            return [dict(row) for row in rows]
    
    async def get_recent_ticks(self, event_ticker: str, limit: int = 5) -> List[Dict]:
        """Get most recent ticks"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM game_ticks
                WHERE event_ticker = $1
                ORDER BY tick DESC
                LIMIT $2
            """, event_ticker, limit)
            result = []
            for row in rows:
                tick_dict = dict(row)
                # Convert datetime to ISO string for JSON serialization
                if 'timestamp' in tick_dict and tick_dict['timestamp']:
                    tick_dict['timestamp'] = tick_dict['timestamp'].isoformat()
                result.append(tick_dict)
            return result
    
    async def get_all_ticks(self, event_ticker: str) -> List[Dict]:
        """Get all ticks for export"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM game_ticks 
                WHERE event_ticker = $1 
                ORDER BY tick ASC
            """, event_ticker)
            return [dict(row) for row in rows]
    
    async def get_tick_count(self, event_ticker: str) -> int:
        """Get total tick count for a game"""
        async with self.pool.acquire() as conn:
            result = await conn.fetchval("""
                SELECT COUNT(*) FROM game_ticks WHERE event_ticker = $1
            """, event_ticker)
            return result or 0
    
    async def get_last_tick(self, event_ticker: str) -> Optional[Dict]:
        """Get most recent tick"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT * FROM game_ticks 
                WHERE event_ticker = $1 
                ORDER BY tick DESC
                LIMIT 1
            """, event_ticker)
            return dict(row) if row else None
    
    # ========================================================================
    # BOT TRADE METHODS
    # ========================================================================
    
    async def insert_trade(self, trade: Dict) -> int:
        """Insert a new trade, return trade ID"""
        async with self.pool.acquire() as conn:
            config_snapshot = trade.get('config_snapshot')
            if config_snapshot and isinstance(config_snapshot, dict):
                config_snapshot = json.dumps(config_snapshot)

            trade_id = await conn.fetchval("""
                INSERT INTO bot_trades (
                    event_ticker, side, team, entry_price, entry_tick, entry_time, contracts, user_id, config_snapshot
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            """,
                trade['event_ticker'], trade['side'], trade.get('team'),
                trade['entry_price'], trade['entry_tick'], trade['entry_time'],
                trade.get('contracts', 0),
                trade.get('user_id'),
                config_snapshot
            )
            return trade_id
    
    async def update_trade_exit(self, trade_id: int, exit_data: Dict) -> None:
        """Update trade with exit info"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE bot_trades SET
                    exit_price = $2,
                    exit_tick = $3,
                    exit_time = $4,
                    exit_reason = $5,
                    pnl = $6
                WHERE id = $1
            """,
                trade_id,
                exit_data['exit_price'],
                exit_data['exit_tick'],
                exit_data['exit_time'],
                exit_data['exit_reason'],
                exit_data['pnl']
            )
    
    async def get_bot_trades(self, event_ticker: str) -> List[Dict]:
        """Get all trades for a game"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM bot_trades 
                WHERE event_ticker = $1 
                ORDER BY entry_tick ASC
            """, event_ticker)
            return [dict(row) for row in rows]
    
    async def get_open_trade(self, event_ticker: str) -> Optional[Dict]:
        """Get open trade (no exit) for a game"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT * FROM bot_trades
                WHERE event_ticker = $1 AND exit_price IS NULL
                ORDER BY entry_tick DESC
                LIMIT 1
            """, event_ticker)
            return dict(row) if row else None

    async def get_bot_session_history(self, user_id: int) -> List[Dict]:
        """Get aggregated bot session history for a user, grouped by event_ticker"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT
                    bt.event_ticker,
                    gs.home_team,
                    gs.away_team,
                    MIN(bt.entry_time) as session_start,
                    MAX(bt.exit_time) as session_end,
                    COUNT(*) as total_trades,
                    COUNT(*) FILTER (WHERE bt.exit_price IS NOT NULL) as completed_trades,
                    SUM(bt.pnl) FILTER (WHERE bt.pnl IS NOT NULL) as total_pnl,
                    COUNT(*) FILTER (WHERE bt.pnl > 0) as wins,
                    COUNT(*) FILTER (WHERE bt.pnl < 0) as losses,
                    AVG(bt.pnl) FILTER (WHERE bt.pnl IS NOT NULL) as avg_pnl,
                    MAX(bt.pnl) as best_trade,
                    MIN(bt.pnl) as worst_trade,
                    (SELECT config_snapshot FROM bot_trades
                     WHERE event_ticker = bt.event_ticker AND user_id = $1
                     ORDER BY entry_time ASC LIMIT 1) as bot_config
                FROM bot_trades bt
                LEFT JOIN game_sessions gs ON bt.event_ticker = gs.event_ticker
                WHERE bt.user_id = $1
                GROUP BY bt.event_ticker, gs.home_team, gs.away_team
                ORDER BY session_start DESC
            """, user_id)

            result = []
            for row in rows:
                session = dict(row)
                # Calculate win rate
                if session['completed_trades'] > 0:
                    session['win_rate'] = (session['wins'] / session['completed_trades']) * 100
                else:
                    session['win_rate'] = 0

                # Convert timestamps to ISO strings
                if session['session_start']:
                    session['session_start'] = session['session_start'].isoformat()
                if session['session_end']:
                    session['session_end'] = session['session_end'].isoformat()

                result.append(session)

            return result
