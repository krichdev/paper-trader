# Paper Trader 🏈

Real-time sports prediction market tracker with paper trading bot.

## Features

- **Multi-game logging** - Track multiple games simultaneously
- **Persistent storage** - Data survives restarts (PostgreSQL)
- **Real-time updates** - WebSocket-powered live dashboard
- **Dry-run bot** - Paper trade with adjustable parameters
- **Game-aware logic** - Bot adapts to game state (red zone, final minutes, etc.)

## Quick Start (Docker Compose)

```bash
docker-compose up -d
```

Then visit `http://localhost`

## Deploy to Dokploy

### Option 1: Compose Deployment

1. In Dokploy, create a new **Compose** service
2. Point to this repo (or paste docker-compose.yml)
3. Deploy!

### Option 2: Separate Services

1. **Database**: Create PostgreSQL from Dokploy database templates
2. **Backend**: 
   - Create Application from `./backend`
   - Set env: `DATABASE_URL=postgresql://user:pass@db-host:5432/paper_trader`
3. **Frontend**:
   - Create Application from `./frontend`
   - Set up domain/SSL

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string

## API Endpoints

### Games
- `GET /api/games` - List available games from Kalshi
- `GET /api/games/active` - Get currently logging games
- `POST /api/games/{ticker}/start?milestone_id=X` - Start logging
- `POST /api/games/{ticker}/stop` - Stop logging
- `GET /api/games/{ticker}/ticks` - Get logged ticks
- `GET /api/games/{ticker}/export` - Download CSV

### Bot
- `POST /api/bot/{ticker}/start` - Start dry-run bot
- `POST /api/bot/{ticker}/stop` - Stop bot
- `PUT /api/bot/{ticker}/config` - Update bot config live
- `GET /api/bot/{ticker}/trades` - Get bot trades

### WebSocket
- `WS /ws` - Real-time updates (ticks, bot entries/exits)

## Bot Configuration

```json
{
  "momentum_threshold": 8,
  "momentum_lookback": 2,
  "profit_target": 12,
  "trailing_stop": 8,
  "hard_stop": 15,
  "avoid_final_minutes": true,
  "avoid_q4_underdogs": true
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React + Vite)                │
│  - Real-time dashboard with WebSocket                   │
│  - Bot controls with live parameter adjustment          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (FastAPI)                      │
│  - Kalshi API integration                               │
│  - Game state polling (15s intervals)                   │
│  - Bot logic engine                                     │
│  - WebSocket broadcast                                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL)                  │
│  - game_sessions                                        │
│  - game_ticks                                           │
│  - bot_trades                                           │
└─────────────────────────────────────────────────────────┘
```

## Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## License

MIT
