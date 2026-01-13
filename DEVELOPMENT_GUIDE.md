# Paper Trader Development Guide

## Session Summary (2026-01-12)

This document captures architectural learnings, implementation patterns, and best practices discovered during the development of advanced bot features for the Paper Trader application.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Recent Changes Summary](#recent-changes-summary)
3. [Critical Files & Their Relationships](#critical-files--their-relationships)
4. [Feature Addition Patterns](#feature-addition-patterns)
5. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
6. [Testing & Verification](#testing--verification)
7. [Frontend Component Architecture](#frontend-component-architecture)
8. [Backend Bot Architecture](#backend-bot-architecture)
9. [Database Patterns](#database-patterns)

---

## System Architecture Overview

### High-Level Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL with asyncpg
- **Real-time**: WebSocket for live game updates and bot events
- **Deployment**: Separate frontend/backend services

### Data Flow for Bot Operations
```
User Action (Frontend)
  ↓
GameDetailModal / LiveBotPanel / UserProfile
  ↓
API call (api.ts) → URL params
  ↓
Backend endpoint (main.py)
  ↓
LivePaperBot instance (live_bot.py)
  ↓
Database persistence (database.py)
  ↓
WebSocket broadcast back to frontend
```

---

## Recent Changes Summary

### Major Feature: Game Context-Aware Bot Trading

**Goal**: Transform the bot from a simple momentum trader into a sophisticated, context-aware system.

**Three Implementation Phases**:

#### Phase 1: Time-Based Dynamic Exits
- **Purpose**: Adjust stops/targets based on game time remaining
- **Parameters Added**:
  - `enable_time_scaling` (bool)
  - `early_game_stop_multiplier` (float, default 1.5)
  - `late_game_stop_multiplier` (float, default 0.7)
  - `early_game_target_multiplier` (float, default 1.3)
  - `late_game_target_multiplier` (float, default 0.8)
- **Logic**: Q1-Q2 get wider stops/higher targets, Q4 gets tighter stops/lower targets

#### Phase 2: Game Context Awareness
- **Purpose**: Consider score, possession, and market sentiment
- **Parameters Added**:
  - `enable_game_context` (bool)
  - `possession_bias_cents` (int, default 2)
  - `score_volatility_multiplier` (float, default 1.2)
  - `favorite_fade_threshold` (int, default 65)
  - `underdog_support_threshold` (int, default 35)
- **Features**:
  - Opening price tracking (first tick = market baseline)
  - Possession-aware entry bias
  - No entries with <5 mins remaining

#### Phase 3: Dollar Cost Averaging (DCA)
- **Purpose**: Allow adding to losing positions with strict risk controls
- **Parameters Added**:
  - `enable_dca` (bool, default False)
  - `dca_max_additions` (int, default 2)
  - `dca_trigger_cents` (int, default 5)
  - `dca_size_multiplier` (float, default 0.75)
  - `dca_min_time_remaining` (int, default 600)
  - `dca_max_total_risk_pct` (float, default 0.20)
- **Safety Guardrails**:
  - Max 2 additions by default
  - Must have 10+ mins remaining
  - Max 20% of bot bankroll at risk (2% of total wallet)
  - Geometric decay sizing

### Bankroll Auto-Allocation

**Problem**: Manual bankroll input was confusing and error-prone.

**Solution**:
- Backend auto-calculates: `bankroll = user_wallet × 0.10`
- Each game gets 10% of wallet automatically
- DCA max risk is 20% of that (so 2% total wallet max)
- Minimum $100 wallet required ($10 minimum bankroll)

**Files Modified**:
- Removed `bankroll` parameter from all frontend components
- Backend calculates in `main.py` start endpoint
- Added info messages in UI: "💡 Auto-allocated: 10% of wallet"

---

## Critical Files & Their Relationships

### Backend Files

#### `/backend/live_bot.py` (919 lines)
**Purpose**: Core bot trading logic

**Key Sections**:
- `__init__()` (lines 11-98): All 24 parameters (6 original + 18 new)
- `on_tick()` (lines 162-190): Entry point for each price update
  - Opening price capture
  - Entry check
  - Exit check
  - DCA check
- `_check_entry()` (lines 211-276): Momentum detection + game context filters
- `_check_exit()` (lines 286-335): Stop loss/profit target logic with dynamic adjustments
- `_execute_exit()` (lines 345-416): P&L calculation, database update, wallet return
- Helper methods (lines 577-796):
  - `_calculate_time_remaining()`: Quarter + clock → seconds
  - `_calculate_dynamic_stop()`: Base stop × time multiplier
  - `_calculate_dynamic_target()`: Base target × time multiplier
  - `_calculate_game_context_score()`: Possession/score/sentiment analysis
  - `_check_dca()`: Determines if should add to position
  - `_execute_dca_addition()`: Adds contracts, updates avg entry price

**Critical Pattern**: Position structure with DCA support
```python
self.position = {
    'side': 'long',
    'entry_price': 52,
    'contracts': 100,
    'cost': 52.0,
    'tick': 123,
    # DCA fields
    'dca_count': 0,
    'avg_entry_price': 52,
    'total_cost': 52.0,
    'dca_history': []
}
```

#### `/backend/main.py`
**Purpose**: FastAPI endpoints

**Key Endpoints**:
- `POST /api/livebot/{event_ticker}/start` (lines 721-845)
  - **CRITICAL**: Removed `bankroll` parameter from signature
  - Auto-calculates: `bankroll = user['current_balance'] * 0.10`
  - Validates minimum $10 bankroll
  - All 18 new parameters passed to bot constructor
  - Deducts bankroll from user wallet
  - Creates wallet transaction record

- `GET /api/user/bot-config` (lines 657-663): Get user default config
- `PUT /api/user/bot-config` (lines 665-685): Update user default config

**Parameter Defaults** (lines 731-748):
```python
enable_time_scaling: bool = True,
enable_game_context: bool = True,
enable_dca: bool = False,  # Opt-in for safety
dca_max_total_risk_pct: float = 0.20  # 20% of bankroll
```

#### `/backend/database.py`
**Purpose**: PostgreSQL operations

**New Methods Added**:
- `save_opening_prices()` (lines 538-550): Store first tick prices in game_sessions
- `get_opening_prices()` (lines 552-560): Retrieve opening prices for sentiment
- `update_trade_dca()` (lines 562-580): Update trade with DCA data

**Schema Changes**:
- Added `opening_prices` JSONB column to `game_sessions` table
- Migration runs automatically on startup (lines 170-173)

### Frontend Files

#### `/frontend/src/components/GameDetailModal.tsx` (557 lines)
**Purpose**: Modal shown when clicking "Deploy Bot" from game card

**CRITICAL DISCOVERY**: This was the missing piece! Initially only updated LiveBotPanel and UserProfile, but game card deployments use this separate modal.

**Structure**:
- Lines 24-49: `BotConfig` interface with all 18 new optional parameters
- Lines 61-86: State with all parameters (strings for inputs)
- Lines 96-129: `loadUserDefaults()` - loads user config and populates form
- Lines 133-163: `handleStartBot()` - parses inputs and calls API
- Lines 271-277: Auto-allocation info banner (no bankroll input!)
- Lines 364-554: Advanced Settings section (collapsible)
  - TIME-BASED EXITS (blue, lines 377-430)
  - GAME CONTEXT (green, lines 433-486)
  - DOLLAR COST AVERAGING (yellow, lines 489-552)

**Key Pattern**: Modal loads user defaults on open
```typescript
useEffect(() => {
  if (isOpen) {
    loadUserDefaults();
  }
}, [isOpen]);
```

#### `/frontend/src/pages/UserProfile.tsx` (803 lines)
**Purpose**: User profile page with "Default Bot Configuration" section

**Structure** (similar to GameDetailModal):
- Lines 34-59: `BotConfig` interface
- Lines 69-94: State with string values for inputs
- Lines 119-152: `loadBotConfig()` - fetch from API
- Lines 154-223: `handleSaveBotConfig()` - save to API
- Lines 450-662: Advanced Settings UI (same three sections)

**Important**: This sets the defaults that other components load from.

#### `/frontend/src/components/LiveBotPanel.tsx`
**Purpose**: Bot control panel shown on individual game pages and in Active Bots list

**Structure**:
- Lines 63-89: Config state (removed `bankroll`)
- Lines 264-266: Info message about auto-allocation
- Lines 329-536: Advanced Settings section (same three categories)

#### `/frontend/src/lib/api.ts`
**Purpose**: API client functions

**Key Function**: `startLiveBot()` (lines 102-163)
- **CRITICAL**: Removed `bankroll` from interface
- Added all 18 new parameters
- Builds URLSearchParams for query string
- Example: `POST /api/livebot/EVENT123/start?momentum_threshold=8&enable_dca=false&...`

---

## Feature Addition Patterns

### Adding New Bot Parameters

Follow this checklist to ensure consistency across all components:

#### 1. Backend Changes

**A. Update `live_bot.py`:**
```python
def __init__(
    self,
    # ... existing params ...
    new_parameter: float = 1.0,  # Add with default
):
    self.new_parameter = new_parameter  # Store as instance variable
```

**B. Update `main.py` endpoint:**
```python
@app.post("/api/livebot/{event_ticker}/start")
async def start_live_bot(
    # ... existing params ...
    new_parameter: float = 1.0,  # Add with default
):
    bot = LivePaperBot(
        # ... existing args ...
        new_parameter=new_parameter,
    )
```

**C. Update database if needed:**
- Parameters are auto-saved in `bot_trades.config_snapshot` as JSONB
- No schema change needed unless adding new columns

#### 2. Frontend Changes (Do ALL THREE!)

**A. Update `GameDetailModal.tsx`:**
```typescript
// 1. Interface
interface BotConfig {
  // ... existing ...
  new_parameter?: number;
}

// 2. State
const [inputValues, setInputValues] = useState({
  // ... existing ...
  new_parameter: '1.0',
});

// 3. Load from API
const loadUserDefaults = async () => {
  setInputValues({
    // ... existing ...
    new_parameter: (config.new_parameter ?? 1.0).toString(),
  });
};

// 4. Parse for API call
const handleStartBot = () => {
  const config: BotConfig = {
    // ... existing ...
    new_parameter: parseFloat(inputValues.new_parameter) || 1.0,
  };
};

// 5. UI Input
<input
  type="text" inputMode="decimal"
  value={inputValues.new_parameter}
  onChange={(e) => setInputValues({ ...inputValues, new_parameter: e.target.value })}
/>
```

**B. Update `UserProfile.tsx`:** (same pattern as GameDetailModal)

**C. Update `LiveBotPanel.tsx`:** (same pattern)

**D. Update `api.ts`:**
```typescript
export async function startLiveBot(eventTicker: string, config: {
  // ... existing ...
  new_parameter?: number;
}) {
  if (config.new_parameter !== undefined)
    params.set('new_parameter', config.new_parameter.toString());
}
```

### Adding Database Columns

Example: Adding `opening_prices` to `game_sessions`

**Pattern**:
```python
# In database.py __init__() or migration method
async def ensure_schema(self):
    async with self.pool.acquire() as conn:
        await conn.execute("""
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS opening_prices JSONB;
        """)
```

**Best Practices**:
- Always use `IF NOT EXISTS` for idempotency
- Use JSONB for flexible/optional data
- Create methods for common queries:
  ```python
  async def save_opening_prices(self, event_ticker: str, home: int, away: int):
      await self.pool.execute("""
          UPDATE game_sessions
          SET opening_prices = $1
          WHERE event_ticker = $2
      """, json.dumps({'home': home, 'away': away}), event_ticker)
  ```

---

## Common Pitfalls & Solutions

### 1. **Missing Component Updates**

**Pitfall**: Updated UserProfile and LiveBotPanel, but forgot GameDetailModal.

**Symptom**: User reports "I don't see the new options when deploying from game card."

**Solution**:
- Always update ALL THREE components: GameDetailModal, UserProfile, LiveBotPanel
- Search for existing parameter names to find all usages: `grep -r "momentum_threshold" frontend/src`

### 2. **Frontend/Backend Type Mismatches**

**Pitfall**: Frontend sends `"true"` string, backend expects boolean.

**Symptom**: Parameters not working, bot uses defaults instead.

**Solution**:
- Frontend: Use `.toString()` when setting params
- Frontend: Parse correctly: `config.enable_time_scaling.toString()` for booleans
- Backend: Use proper type hints: `enable_time_scaling: bool = True`
- API layer: URLSearchParams converts everything to strings, backend FastAPI handles conversion

### 3. **Database Transaction Safety**

**Pitfall**: Wallet deducted but bot creation fails, money lost.

**Current Pattern** (in `main.py`):
```python
# Deduct from wallet BEFORE creating bot
new_balance = user['current_balance'] - bankroll
await db.update_user_balance(user_id, new_balance)
await db.add_wallet_transaction(...)

# Create bot
bot = LivePaperBot(...)
active_live_bots[event_ticker] = bot
```

**Risk**: If bot creation fails after wallet deduction, user loses money.

**Recommended Pattern** (for future improvement):
```python
async with db.pool.acquire() as conn:
    async with conn.transaction():
        # Deduct wallet
        # Create bot
        # If anything fails, transaction rolls back
```

### 4. **Forgetting WebSocket Broadcasts**

**Pitfall**: Bot changes state but frontend doesn't update.

**Solution**: Always broadcast after state changes:
```python
if self.broadcast_fn:
    await self.broadcast_fn(self.event_ticker, 'live_bot_entry', {
        'wallet': self.get_wallet_status(),
        'trade': trade_data,
    })
```

### 5. **Percentage vs Decimal Confusion**

**Pitfall**: User enters "50" for 50%, backend treats as 5000%.

**Pattern Used**:
```typescript
// Frontend: Display as percentage (0-100)
<input value={config.position_size_pct * 100} />

// Frontend: Convert to decimal for API
config.position_size_pct = parseFloat(inputValue) / 100;

// Backend: Store and use as decimal (0.0-1.0)
self.position_size_pct = 0.5  # 50%
```

**Apply to**: `position_size_pct`, `dca_max_total_risk_pct`

---

## Testing & Verification

### After Adding New Bot Parameters

1. **Backend Sanity Check**:
```bash
# Start backend, check for errors
cd backend
python main.py
# Look for: "Application startup complete"
```

2. **Frontend Build Check**:
```bash
cd frontend
npm run build
# Look for: "✓ built in XXXms"
```

3. **Database Migration**:
```sql
-- Connect to DB and verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'game_sessions' AND column_name = 'opening_prices';
```

4. **User Config API Test**:
```bash
# Get default config
curl http://localhost:8000/api/user/bot-config \
  -H "Cookie: session=..." \
  | jq .

# Should include all new parameters with defaults
```

5. **Bot Start Test**:
```bash
# Start a bot with custom config
curl -X POST "http://localhost:8000/api/livebot/EVENT123/start?enable_dca=true&dca_max_additions=3" \
  -H "Cookie: session=..."
```

6. **Frontend Manual Test Checklist**:
- [ ] Open User Profile → Default Bot Configuration
- [ ] Click "Advanced Settings" → Verify all sections expand
- [ ] Change values and click "Save" → Refresh and verify persistence
- [ ] Open a game card → Click "Deploy Bot"
- [ ] Verify auto-allocation message shows correct amount
- [ ] Click "Advanced Settings" → Verify same sections appear
- [ ] Deploy bot → Check Active Bots section
- [ ] Open bot panel → Click config → Verify Advanced Settings there too

7. **Live Bot Verification**:
```sql
-- Check bot was created with config
SELECT event_ticker, config_snapshot
FROM bot_trades
WHERE user_id = 1
ORDER BY entry_time DESC
LIMIT 1;

-- Should see all parameters in config_snapshot JSONB
```

### Verifying DCA Functionality

1. **Trigger DCA Manually**:
- Start bot during live game
- Wait for entry
- Manually move price against position (or wait for natural movement)
- Check logs for "DCA triggered" or "DCA conditions not met"

2. **Database DCA Check**:
```sql
SELECT
  event_ticker,
  config_snapshot->>'dca_count' as dca_count,
  config_snapshot->>'avg_entry_price' as avg_entry,
  contracts
FROM bot_trades
WHERE config_snapshot->>'dca_count' IS NOT NULL;
```

3. **WebSocket Events**:
- Open browser console on active game page
- Filter for WebSocket messages
- Look for `live_bot_dca` events with DCA data

---

## Frontend Component Architecture

### Component Hierarchy

```
App.tsx
├── GameCard.tsx (one per available game)
│   └── onClick → opens GameDetailModal
├── GameDetailModal.tsx (modal for bot deployment)
│   └── onStartBot → handleDeployBot in App.tsx
├── ActiveBotsList.tsx
│   └── LiveBotPanel.tsx (one per active bot)
└── UserProfile.tsx (route: /profile)
```

### State Management Patterns

**Parent-to-Child Props**:
```typescript
// App.tsx manages active bots state
const [liveBotRunning, setLiveBotRunning] = useState<Record<string, boolean>>({});

// Passes down to children
<GameCard hasBotRunning={liveBotRunning[game.event_ticker]} />
```

**WebSocket Updates**:
```typescript
// In App.tsx useEffect
useEffect(() => {
  if (lastMessage?.type === 'live_bot_wallet') {
    setLiveBotWallets(prev => ({
      ...prev,
      [lastMessage.event_ticker]: lastMessage.data
    }));
  }
}, [lastMessage]);
```

### Form Input Pattern

**Always use string state for numeric inputs**:
```typescript
// WHY: Prevents issues with empty inputs, leading zeros, decimals
const [inputValues, setInputValues] = useState({
  momentum_threshold: '8',  // String, not number!
  position_size_pct: '50',
});

// Parse when submitting
const config = {
  momentum_threshold: parseInt(inputValues.momentum_threshold, 10) || 0,
  position_size_pct: parseFloat(inputValues.position_size_pct) / 100,
};
```

### Collapsible Advanced Settings Pattern

```typescript
const [showAdvanced, setShowAdvanced] = useState(false);

<button onClick={() => setShowAdvanced(!showAdvanced)}>
  Advanced Settings
  <span>{showAdvanced ? '▼' : '▶'}</span>
</button>

{showAdvanced && (
  <div className="space-y-3">
    {/* All advanced inputs */}
  </div>
)}
```

---

## Backend Bot Architecture

### Bot Lifecycle

1. **Creation** (`main.py`)
   - User wallet validation
   - Bankroll auto-calculation (10% of wallet)
   - Bankroll deduction from user wallet
   - Bot instance creation
   - Database session initialization
   - WebSocket attachment

2. **Initialization** (`live_bot.py:initialize()`)
   - Load existing trades from database
   - Restore open positions (if bot crashed/restarted)
   - Load opening prices if available

3. **Runtime** (`live_bot.py:on_tick()`)
   - Called for each price update from Kalshi API
   - Opening price capture (first tick only)
   - Entry check (if no position)
   - Exit check (if position exists)
   - DCA check (if position exists and DCA enabled)
   - Broadcast updates via WebSocket

4. **Shutdown** (`live_bot.py:stop()`)
   - Close any open positions at current price
   - Return remaining bankroll to user wallet
   - Create wallet transaction
   - Broadcast stop event

### Position Management

**Entry**:
```python
async def _execute_entry(self, price: int, side: str, tick: Dict):
    # Calculate position size
    cost = self.bankroll * self.position_size_pct
    contracts = int(cost / (price / 100))

    # Create position
    self.position = {
        'side': side,
        'entry_price': price,
        'avg_entry_price': price,  # Same initially
        'contracts': contracts,
        'cost': cost,
        'total_cost': cost,  # Same initially
        'dca_count': 0,
        'dca_history': [],
        'tick': tick_number
    }

    # Deduct from bankroll
    self.bankroll -= cost
```

**DCA Addition**:
```python
async def _execute_dca_addition(self, price: int, tick: Dict, dca_size: float):
    # Calculate new contracts
    contracts = int(dca_size / (price / 100))
    cost = contracts * (price / 100)

    # Update position
    total_contracts = self.position['contracts'] + contracts
    total_cost = self.position['total_cost'] + cost
    avg_price = int((total_cost / total_contracts) * 100)

    self.position['contracts'] = total_contracts
    self.position['total_cost'] = total_cost
    self.position['avg_entry_price'] = avg_price
    self.position['dca_count'] += 1

    # Record history
    self.position['dca_history'].append({
        'price': price,
        'contracts': contracts,
        'cost': cost,
        'tick': tick_number
    })
```

**Exit**:
```python
async def _execute_exit(self, price: int, reason: str, tick: Dict):
    # Calculate P&L using average entry price
    proceeds = self.position['contracts'] * (price / 100)
    pnl = proceeds - self.position['total_cost']

    # Return to bankroll
    self.bankroll += proceeds

    # Save to database
    await self.db.insert_bot_trade({
        'entry_price': self.position['avg_entry_price'],  # Averaged!
        'exit_price': price,
        'pnl': pnl,
        'contracts': self.position['contracts'],
        'config_snapshot': {
            'dca_count': self.position['dca_count'],
            'dca_history': self.position['dca_history'],
            # ... all bot parameters
        }
    })

    # Clear position
    self.position = None
```

### Time-Based Logic

**Quarter → Seconds Conversion**:
```python
def _calculate_time_remaining(self, quarter: int, clock: str) -> int:
    """Convert quarter + clock to seconds remaining in game"""
    try:
        # Parse "12:34" or "12:34.5"
        parts = clock.split(':')
        mins = int(parts[0])
        secs = int(float(parts[1]))

        time_in_quarter = mins * 60 + secs

        # NFL: 4 quarters × 15 mins = 3600 seconds
        quarters_remaining = 4 - quarter
        return (quarters_remaining * 900) + time_in_quarter
    except:
        return 0  # Unknown/pregame
```

**Dynamic Stop Calculation**:
```python
def _calculate_dynamic_stop(self, base_stop: int, tick: Dict) -> int:
    if not self.enable_time_scaling:
        return base_stop

    time_remaining = self._calculate_time_remaining(
        tick.get('quarter', 1),
        tick.get('clock', '15:00')
    )

    # More time = wider stops
    if time_remaining > 1800:  # >30 mins (Q1-Q2)
        return int(base_stop * self.early_game_stop_multiplier)
    elif time_remaining < 900:  # <15 mins (Q4)
        return int(base_stop * self.late_game_stop_multiplier)
    else:  # Q3
        return base_stop
```

---

## Database Patterns

### JSONB Usage

**Why**: Flexible storage for evolving bot configurations without schema migrations.

**Example**:
```python
# Save entire config as JSONB
config_snapshot = {
    'momentum_threshold': self.momentum_threshold,
    'enable_time_scaling': self.enable_time_scaling,
    'dca_count': self.position.get('dca_count', 0),
    'avg_entry_price': self.position.get('avg_entry_price'),
    # ... all parameters
}

await self.db.insert_bot_trade(
    # ... columns ...
    config_snapshot=json.dumps(config_snapshot)
)
```

**Query JSONB**:
```sql
-- Get all trades with DCA
SELECT * FROM bot_trades
WHERE config_snapshot->>'enable_dca' = 'true';

-- Get trades with 2+ DCA additions
SELECT * FROM bot_trades
WHERE (config_snapshot->>'dca_count')::int >= 2;
```

### Wallet Transaction Types

```python
# In database.py:add_wallet_transaction()
tx_type options:
- 'bot_start'           # Bankroll deducted when bot starts
- 'bot_stop'            # Remaining bankroll returned when bot stops
- 'trade_exit'          # (OLD, caused double-counting bug)
- 'balance_correction'  # Manual fix for incorrect balances
```

**Important**: Never use `trade_exit` type! It causes double-counting. Bot proceeds are included in `bot_stop` amount.

### User Default Config

**Storage**:
```sql
-- user_bot_configs table
CREATE TABLE user_bot_configs (
    user_id INTEGER PRIMARY KEY,
    config JSONB NOT NULL,  -- All bot parameters
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Default Values** (if no user config exists):
```python
DEFAULT_BOT_CONFIG = {
    'momentum_threshold': 8,
    'initial_stop': 8,
    'profit_target': 15,
    'breakeven_trigger': 5,
    'position_size_pct': 0.5,
    'enable_time_scaling': True,
    'early_game_stop_multiplier': 1.5,
    'late_game_stop_multiplier': 0.7,
    'early_game_target_multiplier': 1.3,
    'late_game_target_multiplier': 0.8,
    'enable_game_context': True,
    'possession_bias_cents': 2,
    'score_volatility_multiplier': 1.2,
    'favorite_fade_threshold': 65,
    'underdog_support_threshold': 35,
    'enable_dca': False,  # Safety: opt-in
    'dca_max_additions': 2,
    'dca_trigger_cents': 5,
    'dca_size_multiplier': 0.75,
    'dca_min_time_remaining': 600,
    'dca_max_total_risk_pct': 0.20  # 20% of bankroll
}
```

---

## Key Learnings & Insights

### 1. **Three Deployment Paths Exist**

Don't assume there's only one bot config UI. Users can deploy bots from:
- Game cards (GameDetailModal)
- User profile defaults (UserProfile)
- Active bot panels (LiveBotPanel)

**Always update all three when adding parameters.**

### 2. **Frontend Type Safety Matters**

TypeScript interfaces must match backend parameter names exactly:
```typescript
// Frontend
interface BotConfig {
  enable_time_scaling?: boolean;  // Must use snake_case!
}

// Backend
enable_time_scaling: bool = True
```

**Never use camelCase in config interfaces** - backend expects snake_case.

### 3. **Risk Management is Paramount**

The DCA feature could lose users' entire bankroll if not careful:
- Default to disabled (`enable_dca: false`)
- Multiple guardrails (max additions, time limits, total risk %)
- Clear warnings in UI ("⚠️ Higher risk: Adds to losing positions")
- Conservative defaults (2 additions max, 20% risk cap)

### 4. **WebSocket Events Drive UI Updates**

Frontend doesn't poll for updates. Backend pushes via WebSocket:
```python
# Backend broadcasts
await broadcast_update(event_ticker, 'live_bot_entry', {...})

# Frontend receives
if (lastMessage.type === 'live_bot_entry') {
  updateTradesState(lastMessage.data);
}
```

**Pattern**: Any state change should broadcast to keep UI in sync.

### 5. **Defaults Matter More Than You Think**

New parameters need good defaults because:
- Existing user configs won't have them (DB returns null)
- Frontend must handle `?? defaultValue` pattern
- Backend must have default in function signature
- All three must use same defaults for consistency

### 6. **Mobile-First Matters**

Users trade on phones during games:
- Use `inputMode="numeric"` for number inputs
- Use `inputMode="decimal"` for float inputs
- Collapsible sections save screen space
- 2-column grids for compact layout
- Clear, short labels ("Early Stop ×" not "Early Game Stop Loss Multiplier")

---

## Future Improvements

### High Priority

1. **Transaction Safety**
   - Wrap wallet deduction + bot creation in database transaction
   - Prevents money loss if bot creation fails

2. **Better Error Messages**
   - "Insufficient funds" should show: "Need $50, have $40"
   - "Invalid config" should specify which parameter

3. **Config Validation**
   - Frontend: Validate before API call (prevent negative numbers, etc.)
   - Backend: FastAPI request validation with Pydantic models

4. **DCA Real-Time Feedback**
   - Show "DCA available" indicator when conditions met
   - Display potential avg entry price before adding

### Medium Priority

5. **Backtesting**
   - Use historical game data to test bot configs
   - Show projected P&L for different parameters

6. **Bot Templates**
   - "Conservative", "Aggressive", "Balanced" presets
   - One-click apply to all parameters

7. **Performance Analytics**
   - Win rate by parameter combo
   - Which settings work best for which scenarios

8. **Mobile App**
   - Native iOS/Android for faster access during games

### Low Priority

9. **Multi-Game Allocation**
   - Allow running bots on multiple games simultaneously
   - Smart bankroll allocation across games

10. **Social Features**
    - Share bot configs with other users
    - Leaderboard for best performers

---

## Debugging Tips

### Bot Not Entering Trades

**Check**:
1. Momentum threshold: Is price moving enough?
2. Game context filters: Is there <5 mins left? (bot won't enter)
3. Position already exists: Bot only holds one position at a time
4. Bankroll depleted: Check bot wallet status

**Debug**:
```python
# Add logging to _check_entry()
print(f"Momentum: {momentum}, Threshold: {self.momentum_threshold}")
print(f"Time remaining: {time_remaining}s")
```

### DCA Not Triggering

**Check**:
1. `enable_dca` is True
2. Position exists and is losing
3. Time remaining > `dca_min_time_remaining` (default 600s)
4. Not at max additions yet
5. Total risk < `dca_max_total_risk_pct`

**Debug**:
```python
# In _check_dca()
print(f"DCA enabled: {self.enable_dca}")
print(f"Current count: {self.position['dca_count']}/{self.dca_max_additions}")
print(f"Adverse movement: {current_price - entry_price} vs {self.dca_trigger_cents}")
```

### Frontend Not Showing Advanced Settings

**Check**:
1. `showAdvanced` state exists
2. Button onClick toggles state
3. Conditional render: `{showAdvanced && <div>...</div>}`
4. Browser console for React errors

### Parameter Not Persisting

**Check**:
1. All three components updated (GameDetailModal, UserProfile, LiveBotPanel)
2. API layer includes parameter in URLSearchParams
3. Backend endpoint has parameter in signature
4. Database saves config_snapshot as JSONB
5. No typos in parameter names (must match exactly)

---

## Conclusion

This guide captures the architectural patterns, common pitfalls, and best practices learned during the implementation of advanced bot trading features. The key insights:

1. **Consistency is Critical**: Update all three deployment paths
2. **Safety First**: Conservative defaults, opt-in for risky features
3. **Type Safety**: Match snake_case parameter names exactly
4. **JSONB is Flexible**: Use for evolving configurations
5. **Test All Paths**: Don't assume - verify each user journey

When adding new features:
- Follow the checklist under "Feature Addition Patterns"
- Test all three deployment paths
- Verify WebSocket broadcasts
- Check database persistence
- Update this guide with new learnings!

**Last Updated**: 2026-01-12
**Session**: Game Context-Aware Bot Trading + Bankroll Auto-Allocation
