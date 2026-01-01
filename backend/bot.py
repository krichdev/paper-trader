"""
Dry-Run Bot - Paper trading with adjustable parameters
"""

from datetime import datetime, timezone
from typing import Optional, Callable, Any, List
from pydantic import BaseModel


class BotConfig(BaseModel):
    """Bot configuration - adjustable via API"""
    
    # Entry parameters
    momentum_threshold: int = 8  # Cents move to trigger entry
    momentum_lookback: int = 2   # Ticks to look back
    
    # Exit parameters
    profit_target: int = 12      # Cents profit to take
    trailing_stop: int = 8       # Base trailing stop
    hard_stop: int = 15          # Maximum loss
    
    # Game-aware adjustments
    red_zone_stop_multiplier: float = 1.5
    final_minutes_stop_multiplier: float = 2.0
    
    # Filters
    avoid_final_minutes: bool = True
    final_minutes_threshold: int = 180  # Seconds
    avoid_q4_underdogs: bool = True
    underdog_price_threshold: int = 35
    blowout_threshold: int = 14
    
    # Position sizing
    position_size: float = 50.0  # Dollars per trade
    fee_per_side: float = 0.03


class Position:
    """Represents an open position"""
    
    def __init__(self, trade_id: int, side: str, team: str, entry_price: int, 
                 entry_tick: int, entry_time: datetime):
        self.trade_id = trade_id
        self.side = side  # 'home' or 'away'
        self.team = team
        self.entry_price = entry_price
        self.entry_tick = entry_tick
        self.entry_time = entry_time
        self.high_water_mark = entry_price
        self.low_water_mark = entry_price


class DryRunBot:
    """
    Paper trading bot that processes ticks and makes simulated trades.
    
    Features:
    - Configurable entry/exit parameters
    - Game-state awareness
    - Real-time parameter updates
    - Trade logging to database
    """
    
    def __init__(
        self,
        event_ticker: str,
        config: BotConfig,
        db: Any,
        broadcast_fn: Optional[Callable] = None
    ):
        self.event_ticker = event_ticker
        self.config = config
        self.db = db
        self.broadcast_fn = broadcast_fn
        
        self.position: Optional[Position] = None
        self.price_history: List[int] = []
        self.is_active = True
        
        # Home team ID (set on first tick)
        self.home_team_id = ""
    
    def update_config(self, config: BotConfig):
        """Update configuration live"""
        self.config = config
    
    async def on_tick(self, tick: dict):
        """Process a new tick"""
        if not self.is_active:
            return
        
        # Store home team ID
        if not self.home_team_id and tick.get('home_team'):
            # We'll get this from possession comparison later
            pass
        
        home_price = tick.get('home_price', 50)
        away_price = tick.get('away_price', 50)
        
        # Update price history
        self.price_history.append(home_price)
        if len(self.price_history) > 20:
            self.price_history = self.price_history[-20:]
        
        # Parse game state
        game_state = self._parse_game_state(tick)
        
        # Check exit first if we have a position
        if self.position:
            exit_signal = self._check_exit(tick, game_state)
            if exit_signal:
                await self._execute_exit(tick, exit_signal)
        
        # Check entry if no position
        if not self.position:
            entry_signal = self._check_entry(tick, game_state)
            if entry_signal:
                await self._execute_entry(tick, entry_signal)
    
    def _parse_game_state(self, tick: dict) -> dict:
        """Extract game state from tick"""
        quarter = tick.get('quarter', 0)
        clock = tick.get('clock', '')
        
        # Parse clock to seconds
        clock_seconds = 900
        try:
            if ':' in str(clock):
                parts = str(clock).replace(' ', '').split(':')
                mins = int(parts[0])
                secs = int(parts[1]) if len(parts) > 1 else 0
                clock_seconds = mins * 60 + secs
        except:
            pass
        
        score_diff = tick.get('score_diff', 0)
        yardline = tick.get('yardline', 50)
        
        return {
            'quarter': quarter,
            'clock': clock,
            'clock_seconds': clock_seconds,
            'score_diff': score_diff,
            'is_close_game': abs(score_diff) <= 8,
            'in_red_zone': yardline <= 20,
            'goal_to_go': tick.get('goal_to_go', False),
            'is_final_minutes': quarter == 4 and clock_seconds <= self.config.final_minutes_threshold,
            'home_score': tick.get('home_score', 0),
            'away_score': tick.get('away_score', 0)
        }
    
    def _get_momentum(self) -> int:
        """Calculate price momentum"""
        lookback = self.config.momentum_lookback
        if len(self.price_history) < lookback + 1:
            return 0
        return self.price_history[-1] - self.price_history[-(lookback + 1)]
    
    def _check_entry(self, tick: dict, game_state: dict) -> Optional[dict]:
        """Check if we should enter a position"""
        home_price = tick.get('home_price', 50)
        away_price = tick.get('away_price', 50)
        momentum = self._get_momentum()
        
        # === FILTERS ===
        
        # Don't trade in final minutes of close games
        if self.config.avoid_final_minutes:
            if game_state['is_final_minutes'] and game_state['is_close_game']:
                return None
        
        # Don't buy Q4 underdogs
        if self.config.avoid_q4_underdogs and game_state['quarter'] == 4:
            # Home is big underdog
            if home_price < self.config.underdog_price_threshold:
                if game_state['score_diff'] < -self.config.blowout_threshold:
                    if momentum > 0:  # Would be buying home
                        return None
            # Away is big underdog
            if away_price < self.config.underdog_price_threshold:
                if game_state['score_diff'] > self.config.blowout_threshold:
                    if momentum < 0:  # Would be buying away
                        return None
        
        # Don't chase extreme prices
        if home_price > 90 or home_price < 10:
            return None
        
        # === ENTRY SIGNALS ===
        
        if abs(momentum) >= self.config.momentum_threshold:
            if momentum > 0:
                return {
                    'side': 'home',
                    'team': tick.get('home_team', 'Home'),
                    'price': home_price,
                    'reason': f'momentum +{momentum}¢'
                }
            else:
                return {
                    'side': 'away',
                    'team': tick.get('away_team', 'Away'),
                    'price': away_price,
                    'reason': f'momentum {momentum}¢'
                }
        
        return None
    
    def _check_exit(self, tick: dict, game_state: dict) -> Optional[dict]:
        """Check if we should exit"""
        if not self.position:
            return None
        
        if self.position.side == 'home':
            current_price = tick.get('home_price', 50)
        else:
            current_price = tick.get('away_price', 50)
        
        # Update water marks
        self.position.high_water_mark = max(self.position.high_water_mark, current_price)
        self.position.low_water_mark = min(self.position.low_water_mark, current_price)
        
        # Calculate dynamic trailing stop
        trailing_stop = self._calculate_trailing_stop(game_state)
        
        # Check profit target
        if current_price >= self.position.entry_price + self.config.profit_target:
            return {
                'price': current_price,
                'reason': 'profit_target'
            }
        
        # Check trailing stop
        if current_price <= self.position.high_water_mark - trailing_stop:
            return {
                'price': current_price,
                'reason': f'trailing_stop ({trailing_stop}¢)'
            }
        
        # Check hard stop
        if current_price <= self.position.entry_price - self.config.hard_stop:
            return {
                'price': current_price,
                'reason': 'hard_stop'
            }
        
        return None
    
    def _calculate_trailing_stop(self, game_state: dict) -> int:
        """Calculate dynamic trailing stop based on game state"""
        stop = self.config.trailing_stop
        
        # Widen in red zone
        if game_state['in_red_zone'] or game_state['goal_to_go']:
            stop = int(stop * self.config.red_zone_stop_multiplier)
        
        # Widen in final minutes of close game
        if game_state['is_final_minutes'] and game_state['is_close_game']:
            stop = int(stop * self.config.final_minutes_stop_multiplier)
        
        return stop
    
    async def _execute_entry(self, tick: dict, signal: dict):
        """Execute an entry"""
        now = datetime.now(timezone.utc)
        
        # Record trade in database
        trade_id = await self.db.insert_trade({
            'event_ticker': self.event_ticker,
            'side': signal['side'],
            'team': signal['team'],
            'entry_price': signal['price'],
            'entry_tick': tick['tick'],
            'entry_time': now,
            'config_snapshot': self.config.dict()
        })
        
        # Create position
        self.position = Position(
            trade_id=trade_id,
            side=signal['side'],
            team=signal['team'],
            entry_price=signal['price'],
            entry_tick=tick['tick'],
            entry_time=now
        )
        
        # Broadcast
        if self.broadcast_fn:
            await self.broadcast_fn({
                'type': 'bot_entry',
                'event_ticker': self.event_ticker,
                'data': {
                    'side': signal['side'],
                    'team': signal['team'],
                    'price': signal['price'],
                    'reason': signal['reason'],
                    'tick': tick['tick']
                }
            })
    
    async def _execute_exit(self, tick: dict, signal: dict):
        """Execute an exit"""
        if not self.position:
            return
        
        now = datetime.now(timezone.utc)
        
        # Calculate P&L
        price_diff = signal['price'] - self.position.entry_price
        contracts = int(self.config.position_size / self.position.entry_price * 100)
        gross_pnl = price_diff * contracts / 100
        fees = self.config.fee_per_side * 2 * contracts
        pnl = gross_pnl - fees
        
        # Update trade in database
        await self.db.update_trade_exit(self.position.trade_id, {
            'exit_price': signal['price'],
            'exit_tick': tick['tick'],
            'exit_time': now,
            'exit_reason': signal['reason'],
            'pnl': pnl
        })
        
        # Broadcast
        if self.broadcast_fn:
            await self.broadcast_fn({
                'type': 'bot_exit',
                'event_ticker': self.event_ticker,
                'data': {
                    'side': self.position.side,
                    'team': self.position.team,
                    'entry_price': self.position.entry_price,
                    'exit_price': signal['price'],
                    'reason': signal['reason'],
                    'pnl': pnl,
                    'tick': tick['tick']
                }
            })
        
        # Clear position
        self.position = None
