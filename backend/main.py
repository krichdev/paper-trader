"""
Paper Trader - FastAPI Backend

Features:
- Multi-game logging with Postgres persistence
- WebSocket for real-time updates
- Resume logging after restart
- Dry-run bot with adjustable parameters
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import asyncio
import httpx
from datetime import datetime, timezone
from typing import Optional, List, Dict
import json
import os

from database import Database, GameTick, GameSession, BotTrade
from logger import GameLogger
from bot import DryRunBot, BotConfig
from live_bot import LivePaperBot
from auth import hash_password, verify_password, get_current_user_id

# ============================================================================
# CONFIG
# ============================================================================

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/paper_trader")
KALSHI_API_BASE = "https://api.elections.kalshi.com/trade-api/v2"

# ============================================================================
# APP SETUP
# ============================================================================

db = Database(DATABASE_URL)
active_loggers: Dict[str, GameLogger] = {}
active_bots: Dict[str, DryRunBot] = {}
active_live_bots: Dict[str, LivePaperBot] = {}
websocket_clients: List[WebSocket] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.connect()
    await db.create_tables()
    
    # Resume any active sessions
    active_sessions = await db.get_active_sessions()
    for session in active_sessions:
        logger = GameLogger(
            event_ticker=session['event_ticker'],
            milestone_id=session['milestone_id'],
            db=db,
            broadcast_fn=broadcast_update
        )
        active_loggers[session['event_ticker']] = logger
        asyncio.create_task(logger.start())

        # Resume live bot if it was active
        if session.get('live_bot_active'):
            config = session.get('live_bot_config', {})
            bot = LivePaperBot(
                event_ticker=session['event_ticker'],
                db=db,
                broadcast_fn=broadcast_update,
                bankroll=session.get('live_bot_bankroll', 500.0),
                momentum_threshold=config.get('momentum_threshold', 8),
                initial_stop=config.get('initial_stop', 8),
                profit_target=config.get('profit_target', 15),
                breakeven_trigger=config.get('breakeven_trigger', 5),
                position_size_pct=config.get('position_size_pct', 0.5),
                user_id=session.get('user_id')
            )
            await bot.initialize()
            active_live_bots[session['event_ticker']] = bot
            logger.attach_bot(bot)
    
    yield
    
    # Shutdown
    for logger in active_loggers.values():
        await logger.stop()
    await db.disconnect()


app = FastAPI(title="Paper Trader", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# WEBSOCKET
# ============================================================================

async def broadcast_update(data: dict):
    """Broadcast update to all connected WebSocket clients"""
    if not websocket_clients:
        return
    
    message = json.dumps(data)
    disconnected = []
    
    for client in websocket_clients:
        try:
            await client.send_text(message)
        except:
            disconnected.append(client)
    
    for client in disconnected:
        websocket_clients.remove(client)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.append(websocket)

    try:
        # Send current state on connect
        state = await get_current_state()
        await websocket.send_text(json.dumps({"type": "init", "data": state}))

        while True:
            # Keep connection alive, handle incoming messages
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                msg = json.loads(data)

                # Handle ping/pong
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                # Send ping to client to check if still alive
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except:
                    break

    except WebSocketDisconnect:
        if websocket in websocket_clients:
            websocket_clients.remove(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in websocket_clients:
            websocket_clients.remove(websocket)


async def get_current_state() -> dict:
    """Get current state of all active loggers"""
    state = {
        "active_games": [],
        "recent_ticks": {},
        "active_bots": list(active_bots.keys()),
        "active_live_bots": list(active_live_bots.keys()),
        "live_bot_wallets": {}
    }

    for ticker, logger in active_loggers.items():
        state["active_games"].append({
            "event_ticker": ticker,
            "home_team": logger.home_team,
            "away_team": logger.away_team,
            "status": logger.status,
            "tick_count": logger.tick_count
        })

        # Get last 5 ticks
        ticks = await db.get_recent_ticks(ticker, limit=5)
        state["recent_ticks"][ticker] = ticks

    # Add live bot wallet info
    for ticker, live_bot in active_live_bots.items():
        state["live_bot_wallets"][ticker] = live_bot.get_wallet_status()

    return state


# ============================================================================
# AUTH MODELS
# ============================================================================

class RegisterRequest(BaseModel):
    username: str
    password: str
    starting_balance: float = 10000.0  # Default to $10,000 if not specified

class LoginRequest(BaseModel):
    username: str
    password: str


# ============================================================================
# AUTH ROUTES
# ============================================================================

@app.post("/api/auth/register")
async def register(request: RegisterRequest, response: Response):
    """Register a new user"""
    try:
        # Check if username already exists
        existing_user = await db.get_user_by_username(request.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")

        # Validate starting balance
        if request.starting_balance < 100 or request.starting_balance > 1000000:
            raise HTTPException(status_code=400, detail="Starting balance must be between $100 and $1,000,000")

        # Hash password and create user
        password_hash = hash_password(request.password)
        user_id = await db.create_user(request.username, password_hash, request.starting_balance)

        # Set cookie
        response.set_cookie(
            key="user_id",
            value=str(user_id),
            httponly=True,
            max_age=30*24*60*60,  # 30 days
            samesite="lax"
        )

        # Get user data
        user = await db.get_user_by_id(user_id)

        return {
            "id": user['id'],
            "username": user['username'],
            "current_balance": user['current_balance'],
            "starting_balance": user['starting_balance'],
            "total_pnl": user['total_pnl']
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Registration error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.post("/api/migrate")
async def run_migrations():
    """Manually trigger database migrations"""
    try:
        if not db.pool:
            return {"status": "error", "message": "Database pool not initialized"}
        await db.create_tables()
        return {"status": "success", "message": "Tables created successfully"}
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


@app.post("/api/auth/login")
async def login(request: LoginRequest, response: Response):
    """Login user"""
    # Get user
    user = await db.get_user_by_username(request.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Verify password
    if not verify_password(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Set cookie
    response.set_cookie(
        key="user_id",
        value=str(user['id']),
        httponly=True,
        max_age=30*24*60*60,  # 30 days
        samesite="lax"
    )

    return {
        "id": user['id'],
        "username": user['username'],
        "current_balance": user['current_balance'],
        "starting_balance": user['starting_balance'],
        "total_pnl": user['total_pnl']
    }


@app.post("/api/auth/logout")
async def logout(response: Response):
    """Logout user"""
    response.delete_cookie(key="user_id")
    return {"status": "logged out"}


@app.get("/api/auth/me")
async def get_current_user(user_id: int = Depends(get_current_user_id)):
    """Get current user info"""
    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user['id'],
        "username": user['username'],
        "current_balance": user['current_balance'],
        "starting_balance": user['starting_balance'],
        "total_pnl": user['total_pnl']
    }


@app.get("/api/user/stats")
async def get_user_stats(user_id: int = Depends(get_current_user_id)):
    """Get detailed user statistics"""
    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all trades for this user
    all_trades = await db.get_user_trades(user_id)

    # Calculate statistics
    total_trades = len(all_trades)
    completed_trades = [t for t in all_trades if t.get('exit_price') is not None]
    open_trades = [t for t in all_trades if t.get('exit_price') is None]

    wins = len([t for t in completed_trades if t.get('pnl', 0) > 0])
    losses = len([t for t in completed_trades if t.get('pnl', 0) <= 0])
    win_rate = (wins / len(completed_trades) * 100) if completed_trades else 0

    total_pnl = sum(t.get('pnl', 0) for t in completed_trades)
    avg_pnl = (total_pnl / len(completed_trades)) if completed_trades else 0

    biggest_win = max((t.get('pnl', 0) for t in completed_trades), default=0)
    biggest_loss = min((t.get('pnl', 0) for t in completed_trades), default=0)

    # Get wallet transactions
    transactions = await db.get_user_wallet_transactions(user_id, limit=50)

    # Active bots
    active_bots = await db.get_user_active_bots(user_id)

    return {
        "user": {
            "id": user['id'],
            "username": user['username'],
            "current_balance": user['current_balance'],
            "starting_balance": user['starting_balance'],
            "total_pnl": user['total_pnl'],
            "created_at": user['created_at'].isoformat() if user.get('created_at') else None
        },
        "trading_stats": {
            "total_trades": total_trades,
            "completed_trades": len(completed_trades),
            "open_trades": len(open_trades),
            "wins": wins,
            "losses": losses,
            "win_rate": win_rate,
            "total_pnl": total_pnl,
            "avg_pnl_per_trade": avg_pnl,
            "biggest_win": biggest_win,
            "biggest_loss": biggest_loss
        },
        "active_bots": active_bots,
        "recent_trades": completed_trades[-10:][::-1],  # Last 10 trades, most recent first
        "open_positions": open_trades,
        "recent_transactions": transactions
    }


@app.get("/api/leaderboard")
async def get_leaderboard():
    """Get leaderboard of top users by P&L"""
    leaderboard = await db.get_leaderboard(limit=100)
    return {"leaderboard": leaderboard}


# ============================================================================
# GAME ROUTES
# ============================================================================

@app.get("/api/games")
async def list_available_games():
    """Fetch available games from Kalshi"""
    games = []
    today = datetime.now(timezone.utc).strftime('%Y-%m-%dT00:00:00Z')
    
    async with httpx.AsyncClient() as client:
        # Fetch games from multiple leagues
        leagues = ['NCAAFB', 'NFL', 'NCAABB', 'NBA']

        for league in leagues:
            try:
                resp = await client.get(
                    f"{KALSHI_API_BASE}/milestones",
                    params={
                        'limit': 100,
                        'minimum_start_date': today,
                        'category': 'Sports',
                        'competition': league
                    },
                    timeout=10
                )
                if resp.status_code == 200:
                    milestones = resp.json().get('milestones', [])
                    games.extend(parse_milestones(milestones, league))
            except Exception as e:
                print(f"Error fetching {league}: {e}")
    
    # Sort by start date
    games.sort(key=lambda x: x.get('start_date') or '')
    
    return {"games": games}


def parse_milestones(milestones: list, league: str) -> list:
    """Parse milestones into game objects"""
    games = []
    
    for m in milestones:
        title = m.get('title', '')
        tickers = m.get('primary_event_tickers', [])
        
        # Find main game ticker
        game_ticker = None
        for t in tickers:
            if 'GAME' in t and 'SPREAD' not in t and 'TOTAL' not in t:
                game_ticker = t
                break
        
        if not game_ticker:
            continue
        
        details = m.get('details', {})
        
        games.append({
            'title': title,
            'milestone_id': m.get('id'),
            'event_ticker': game_ticker,
            'status': details.get('status', 'scheduled'),
            'start_date': m.get('start_date'),
            'league': league
        })
    
    return games


@app.get("/api/games/active")
async def get_active_games():
    """Get currently logging games"""
    games = []
    
    for ticker, logger in active_loggers.items():
        games.append({
            "event_ticker": ticker,
            "home_team": logger.home_team,
            "away_team": logger.away_team,
            "home_price": logger.last_home_price,
            "away_price": logger.last_away_price,
            "home_score": logger.last_home_score,
            "away_score": logger.last_away_score,
            "quarter": logger.last_quarter,
            "clock": logger.last_clock,
            "status": logger.status,
            "tick_count": logger.tick_count,
            "last_play": logger.last_play
        })
    
    return {"games": games}


@app.post("/api/games/{event_ticker}/start")
async def start_logging(event_ticker: str, milestone_id: str):
    """Start logging a game"""
    
    if event_ticker in active_loggers:
        return {"status": "already_running", "tick_count": active_loggers[event_ticker].tick_count}
    
    # Check if we have existing session to resume
    existing = await db.get_session(event_ticker)
    start_tick = 0
    
    if existing:
        start_tick = existing.get('last_tick', 0)
    else:
        await db.create_session(event_ticker, milestone_id)
    
    # Create and start logger
    logger = GameLogger(
        event_ticker=event_ticker,
        milestone_id=milestone_id,
        db=db,
        broadcast_fn=broadcast_update,
        start_tick=start_tick
    )
    
    active_loggers[event_ticker] = logger
    asyncio.create_task(logger.start())
    
    return {"status": "started", "event_ticker": event_ticker, "resumed_from_tick": start_tick}


@app.post("/api/games/{event_ticker}/stop")
async def stop_logging(event_ticker: str):
    """Stop logging a game"""
    
    if event_ticker not in active_loggers:
        raise HTTPException(status_code=404, detail="Game not being logged")
    
    await active_loggers[event_ticker].stop()
    del active_loggers[event_ticker]
    
    await db.update_session_status(event_ticker, "stopped")
    
    return {"status": "stopped", "event_ticker": event_ticker}


@app.get("/api/games/{event_ticker}/ticks")
async def get_game_ticks(event_ticker: str, limit: int = 100, offset: int = 0):
    """Get logged ticks for a game"""
    ticks = await db.get_ticks(event_ticker, limit=limit, offset=offset)
    total = await db.get_tick_count(event_ticker)
    
    return {"ticks": ticks, "total": total}


@app.get("/api/games/{event_ticker}/export")
async def export_game_csv(event_ticker: str):
    """Export game data as CSV"""
    from fastapi.responses import StreamingResponse
    import io
    import csv
    
    ticks = await db.get_all_ticks(event_ticker)
    
    if not ticks:
        raise HTTPException(status_code=404, detail="No data for this game")
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=ticks[0].keys())
    writer.writeheader()
    writer.writerows(ticks)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={event_ticker}.csv"}
    )


# ============================================================================
# BOT ROUTES
# ============================================================================

@app.post("/api/bot/{event_ticker}/start")
async def start_bot(event_ticker: str, config: BotConfig):
    """Start dry-run bot for a game"""
    
    if event_ticker not in active_loggers:
        raise HTTPException(status_code=400, detail="Game must be logging first")
    
    if event_ticker in active_bots:
        return {"status": "already_running"}
    
    bot = DryRunBot(
        event_ticker=event_ticker,
        config=config,
        db=db,
        broadcast_fn=broadcast_update
    )
    
    active_bots[event_ticker] = bot
    active_loggers[event_ticker].attach_bot(bot)

    # Broadcast bot started to all clients
    await broadcast_update({
        "type": "bot_started",
        "event_ticker": event_ticker
    })

    return {"status": "started", "config": config.dict()}


@app.post("/api/bot/{event_ticker}/stop")
async def stop_bot(event_ticker: str):
    """Stop dry-run bot"""
    
    if event_ticker not in active_bots:
        raise HTTPException(status_code=404, detail="Bot not running")
    
    if event_ticker in active_loggers:
        active_loggers[event_ticker].detach_bot()

    del active_bots[event_ticker]

    # Broadcast bot stopped to all clients
    await broadcast_update({
        "type": "bot_stopped",
        "event_ticker": event_ticker
    })

    return {"status": "stopped"}


@app.get("/api/bot/{event_ticker}/trades")
async def get_bot_trades(event_ticker: str):
    """Get bot trades for a game"""
    trades = await db.get_bot_trades(event_ticker)
    
    # Calculate summary
    total_pnl = sum(t.get('pnl', 0) for t in trades if t.get('pnl'))
    wins = len([t for t in trades if t.get('pnl', 0) > 0])
    losses = len([t for t in trades if t.get('pnl', 0) <= 0 and t.get('exit_price')])
    
    return {
        "trades": trades,
        "summary": {
            "total_trades": len(trades),
            "wins": wins,
            "losses": losses,
            "win_rate": wins / (wins + losses) * 100 if (wins + losses) > 0 else 0,
            "total_pnl": total_pnl
        }
    }


@app.put("/api/bot/{event_ticker}/config")
async def update_bot_config(event_ticker: str, config: BotConfig):
    """Update bot configuration live"""
    
    if event_ticker not in active_bots:
        raise HTTPException(status_code=404, detail="Bot not running")
    
    active_bots[event_ticker].update_config(config)
    
    return {"status": "updated", "config": config.dict()}


# ============================================================================
# LIVE BOT ROUTES
# ============================================================================

@app.post("/api/livebot/{event_ticker}/start")
async def start_live_bot(
    event_ticker: str,
    user_id: int = Depends(get_current_user_id),
    bankroll: float = 500.0,
    momentum_threshold: int = 8,
    initial_stop: int = 8,
    profit_target: int = 15,
    breakeven_trigger: int = 5,
    position_size_pct: float = 0.5
):
    """Start live paper trading bot"""

    if event_ticker not in active_loggers:
        raise HTTPException(status_code=400, detail="Game must be logging first")

    if event_ticker in active_live_bots:
        return {"status": "already_running"}

    # Check user balance
    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user['current_balance'] < bankroll:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient funds. You have ${user['current_balance']:.2f}, but need ${bankroll:.2f}"
        )

    # Deduct allocation from user wallet
    new_balance = user['current_balance'] - bankroll
    await db.update_user_balance(user_id, new_balance)
    await db.add_wallet_transaction(
        user_id=user_id,
        amount=-bankroll,
        tx_type='bot_start',
        balance_after=new_balance,
        event_ticker=event_ticker
    )

    bot = LivePaperBot(
        event_ticker=event_ticker,
        db=db,
        broadcast_fn=broadcast_update,
        bankroll=bankroll,
        momentum_threshold=momentum_threshold,
        initial_stop=initial_stop,
        profit_target=profit_target,
        breakeven_trigger=breakeven_trigger,
        position_size_pct=position_size_pct,
        user_id=user_id
    )

    # Initialize bot state from database (existing trades, open positions)
    await bot.initialize()

    active_live_bots[event_ticker] = bot
    active_loggers[event_ticker].attach_bot(bot)

    # Broadcast bot started
    await broadcast_update({
        "type": "live_bot_started",
        "event_ticker": event_ticker
    })

    return {"status": "started", "wallet": bot.get_wallet_status(), "user_balance": new_balance}


@app.post("/api/livebot/{event_ticker}/stop")
async def stop_live_bot(event_ticker: str):
    """Stop live paper trading bot"""

    if event_ticker not in active_live_bots:
        raise HTTPException(status_code=404, detail="Live bot not running")

    bot = active_live_bots[event_ticker]
    await bot.stop()

    if event_ticker in active_loggers:
        active_loggers[event_ticker].detach_bot()

    del active_live_bots[event_ticker]

    # Broadcast bot stopped
    await broadcast_update({
        "type": "live_bot_stopped",
        "event_ticker": event_ticker
    })

    return {"status": "stopped"}


@app.get("/api/livebot/{event_ticker}/wallet")
async def get_live_bot_wallet(event_ticker: str):
    """Get live bot wallet status"""

    if event_ticker not in active_live_bots:
        raise HTTPException(status_code=404, detail="Live bot not running")

    return active_live_bots[event_ticker].get_wallet_status()


@app.put("/api/livebot/{event_ticker}/config")
async def update_live_bot_config(
    event_ticker: str,
    bankroll: Optional[float] = None,
    momentum_threshold: Optional[int] = None,
    initial_stop: Optional[int] = None,
    profit_target: Optional[int] = None,
    breakeven_trigger: Optional[int] = None,
    position_size_pct: Optional[float] = None
):
    """Update live bot configuration"""

    if event_ticker not in active_live_bots:
        raise HTTPException(status_code=404, detail="Live bot not running")

    config = {}
    if bankroll is not None:
        config['bankroll'] = bankroll
    if momentum_threshold is not None:
        config['momentum_threshold'] = momentum_threshold
    if initial_stop is not None:
        config['initial_stop'] = initial_stop
    if profit_target is not None:
        config['profit_target'] = profit_target
    if breakeven_trigger is not None:
        config['breakeven_trigger'] = breakeven_trigger
    if position_size_pct is not None:
        config['position_size_pct'] = position_size_pct

    active_live_bots[event_ticker].update_config(config)

    return {"status": "updated", "wallet": active_live_bots[event_ticker].get_wallet_status()}


@app.post("/api/livebot/{event_ticker}/topup")
async def topup_live_bot(
    event_ticker: str,
    amount: float,
    user_id: int = Depends(get_current_user_id)
):
    """Add more funds to a running live bot from user wallet"""
    if event_ticker not in active_live_bots:
        raise HTTPException(status_code=404, detail="Live bot not running")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Top-up amount must be positive")

    bot = active_live_bots[event_ticker]

    # Verify this bot belongs to the user
    if bot.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to top up this bot")

    try:
        result = await bot.top_up(amount)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/user/reset")
async def reset_user_account(user_id: int = Depends(get_current_user_id)):
    """Reset user account - delete all trades and transactions, reset to starting balance"""
    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Stop all active bots for this user
    bots_to_stop = []
    for event_ticker, bot in active_live_bots.items():
        if bot.user_id == user_id:
            bots_to_stop.append((event_ticker, bot))

    for event_ticker, bot in bots_to_stop:
        await bot.stop()
        if event_ticker in active_loggers:
            active_loggers[event_ticker].detach_bot()
        del active_live_bots[event_ticker]

    # Reset account in database
    await db.reset_user_account(user_id)

    # Get updated user data
    updated_user = await db.get_user_by_id(user_id)

    return {
        "status": "success",
        "message": "Account reset successfully",
        "user": {
            "id": updated_user['id'],
            "username": updated_user['username'],
            "current_balance": updated_user['current_balance'],
            "starting_balance": updated_user['starting_balance'],
            "total_pnl": updated_user['total_pnl']
        }
    }


# ============================================================================
# HISTORY ROUTES
# ============================================================================

@app.get("/api/history/sessions")
async def get_session_history():
    """Get all past logging sessions"""
    sessions = await db.get_all_sessions()
    return {"sessions": sessions}


@app.get("/api/history/{event_ticker}")
async def get_game_history(event_ticker: str):
    """Get full history for a game including ticks and trades"""
    session = await db.get_session(event_ticker)
    
    if not session:
        raise HTTPException(status_code=404, detail="Game not found")
    
    ticks = await db.get_all_ticks(event_ticker)
    trades = await db.get_bot_trades(event_ticker)
    
    return {
        "session": session,
        "ticks": ticks,
        "trades": trades
    }


# ============================================================================
# HEALTH
# ============================================================================

@app.get("/health")
async def health():
    return {"status": "ok", "active_games": len(active_loggers)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
