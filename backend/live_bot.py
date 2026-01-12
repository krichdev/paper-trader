"""
Live Paper Trading Bot - Integrated version
Trades based on real-time tick data with wallet and P&L tracking
"""

from datetime import datetime, timezone
from typing import Optional, Dict, List, Any, Callable
import json


class LivePaperBot:
    def __init__(
        self,
        event_ticker: str,
        db: Any,
        broadcast_fn: Optional[Callable] = None,
        bankroll: float = 500.0,
        momentum_threshold: int = 8,
        initial_stop: int = 8,
        profit_target: int = 15,
        breakeven_trigger: int = 5,
        position_size_pct: float = 0.5,
        user_id: Optional[int] = None,
        # Time-based dynamic exits
        enable_time_scaling: bool = True,
        early_game_stop_multiplier: float = 1.5,
        late_game_stop_multiplier: float = 0.7,
        early_game_target_multiplier: float = 1.3,
        late_game_target_multiplier: float = 0.8,
        # Game context factors
        enable_game_context: bool = True,
        possession_bias_cents: int = 2,
        score_volatility_multiplier: float = 1.2,
        favorite_fade_threshold: int = 65,
        underdog_support_threshold: int = 35,
        # DCA parameters
        enable_dca: bool = False,
        dca_max_additions: int = 2,
        dca_trigger_cents: int = 5,
        dca_size_multiplier: float = 0.75,
        dca_min_time_remaining: int = 600,
        dca_max_total_risk_pct: float = 0.75
    ):
        self.event_ticker = event_ticker
        self.db = db
        self.broadcast_fn = broadcast_fn
        self.user_id = user_id

        # Wallet
        self.bankroll = bankroll
        self.starting_bankroll = bankroll

        # Position
        self.position: Optional[Dict] = None

        # Price tracking
        self.price_history: List[int] = []

        # Strategy params
        self.momentum_threshold = momentum_threshold
        self.initial_stop = initial_stop
        self.profit_target = profit_target
        self.breakeven_trigger = breakeven_trigger
        self.position_size_pct = position_size_pct

        # Time-based dynamic exits
        self.enable_time_scaling = enable_time_scaling
        self.early_game_stop_multiplier = early_game_stop_multiplier
        self.late_game_stop_multiplier = late_game_stop_multiplier
        self.early_game_target_multiplier = early_game_target_multiplier
        self.late_game_target_multiplier = late_game_target_multiplier

        # Game context factors
        self.enable_game_context = enable_game_context
        self.possession_bias_cents = possession_bias_cents
        self.score_volatility_multiplier = score_volatility_multiplier
        self.favorite_fade_threshold = favorite_fade_threshold
        self.underdog_support_threshold = underdog_support_threshold

        # Opening price tracking
        self.opening_home_price: Optional[int] = None
        self.opening_away_price: Optional[int] = None
        self.first_tick_received: bool = False

        # DCA parameters
        self.enable_dca = enable_dca
        self.dca_max_additions = dca_max_additions
        self.dca_trigger_cents = dca_trigger_cents
        self.dca_size_multiplier = dca_size_multiplier
        self.dca_min_time_remaining = dca_min_time_remaining
        self.dca_max_total_risk_pct = dca_max_total_risk_pct

        # State
        self.is_active = True
        self.total_trades = 0
        self.wins = 0
        self.losses = 0
        self.total_pnl = 0.0

    async def initialize(self):
        """Initialize bot state from existing trades in database"""
        # Check if we have saved bot state
        session = await self.db.get_session(self.event_ticker)

        if session and session.get('live_bot_active'):
            # Resume from saved state
            saved_bankroll = session.get('live_bot_bankroll')
            saved_starting_bankroll = session.get('live_bot_starting_bankroll')

            if saved_bankroll is not None:
                self.bankroll = saved_bankroll
            if saved_starting_bankroll is not None:
                self.starting_bankroll = saved_starting_bankroll

            # Load opening prices if they exist
            opening_prices = session.get('opening_prices')
            if opening_prices:
                if isinstance(opening_prices, str):
                    opening_prices = json.loads(opening_prices)
                self.opening_home_price = opening_prices.get('home_price')
                self.opening_away_price = opening_prices.get('away_price')
                if self.opening_home_price is not None:
                    self.first_tick_received = True

        # Check for existing trades
        trades = await self.db.get_bot_trades(self.event_ticker)

        if trades:
            # Calculate stats from existing trades
            self.total_trades = len(trades)
            self.wins = len([t for t in trades if (t.get('pnl') or 0) > 0])
            self.losses = len([t for t in trades if (t.get('pnl') or 0) <= 0 and t.get('exit_price')])
            self.total_pnl = sum((t.get('pnl') or 0) for t in trades if t.get('pnl') is not None)

            # Check for open position
            open_trade = await self.db.get_open_trade(self.event_ticker)
            if open_trade:
                # Get DCA info from config_snapshot if available
                config_snapshot = open_trade.get('config_snapshot', {})
                if isinstance(config_snapshot, str):
                    config_snapshot = json.loads(config_snapshot)

                # Reconstruct position state
                self.position = {
                    'side': open_trade['side'],
                    'entry_price': open_trade['entry_price'],
                    'contracts': open_trade.get('contracts', 0),
                    'cost': 0,  # Will recalculate from contracts and entry price
                    'entry_tick': open_trade['entry_tick'],
                    'entry_time': open_trade['entry_time'],
                    'trade_id': open_trade['id'],
                    'high': open_trade['entry_price'] if open_trade['side'] == 'long' else None,
                    'low': open_trade['entry_price'] if open_trade['side'] == 'short' else None,
                    # DCA fields from config_snapshot
                    'dca_count': config_snapshot.get('dca_count', 0),
                    'avg_entry_price': config_snapshot.get('avg_entry_price', open_trade['entry_price']),
                    'total_cost': config_snapshot.get('total_cost'),
                    'dca_history': config_snapshot.get('dca_history', [])
                }

                # Recalculate cost from contracts if total_cost not available
                if self.position['total_cost'] is None:
                    if self.position['side'] == 'long':
                        self.position['cost'] = self.position['contracts'] * self.position['entry_price'] / 100
                        self.position['total_cost'] = self.position['cost']
                    else:
                        no_price = 100 - self.position['entry_price']
                        self.position['cost'] = self.position['contracts'] * no_price / 100
                        self.position['total_cost'] = self.position['cost']
                else:
                    self.position['cost'] = self.position['total_cost']

        # Save initial state to database
        await self.db.save_live_bot_state(
            self.event_ticker,
            self.bankroll,
            self.starting_bankroll,
            {
                'momentum_threshold': self.momentum_threshold,
                'initial_stop': self.initial_stop,
                'profit_target': self.profit_target,
                'breakeven_trigger': self.breakeven_trigger,
                'position_size_pct': self.position_size_pct
            }
        )

    async def on_tick(self, tick: Dict):
        """Process new tick data"""
        if not self.is_active:
            return

        home_price = tick.get('home_price', 0)
        if home_price == 0:
            return

        # Capture opening prices on first tick
        if not self.first_tick_received:
            await self._store_opening_price(tick)

        # Update price history
        self.price_history.append(home_price)
        if len(self.price_history) > 10:
            self.price_history = self.price_history[-10:]

        # Check exit first
        if self.position:
            await self._check_exit(home_price, tick)

            # Check for DCA opportunity (after exit check, while position still exists)
            if self.position:  # Position might have been closed by exit check
                await self._check_dca(home_price, tick)

        # Check entry
        elif self.bankroll > 1:
            await self._check_entry(home_price, tick)
        elif self.bankroll <= 1 and not self.position:
            # Bot is out of funds and has no position - notify user
            if self.broadcast_fn:
                await self.broadcast_fn({
                    "type": "live_bot_low_balance",
                    "event_ticker": self.event_ticker,
                    "data": {
                        "bankroll": self.bankroll,
                        "message": "Bot has insufficient funds to enter new trades"
                    }
                })

        # Broadcast wallet update
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "live_bot_wallet",
                "event_ticker": self.event_ticker,
                "data": self.get_wallet_status()
            })

    async def _check_entry(self, price: int, tick: Dict):
        """Check for entry signal"""
        if price < 10 or price > 90:
            return

        if len(self.price_history) < 3:
            return

        # Game context filters
        if self.enable_game_context:
            context = self._calculate_game_context_score(tick)

            # Don't enter if <5 mins remaining (too risky for new position)
            if context['time_remaining'] < 300:
                return

            # Apply market sentiment filter
            momentum_required = self.momentum_threshold

            if context['market_sentiment'] == 'fade':
                # Fading favorites requires stronger momentum
                momentum_required = self.momentum_threshold + 2

        else:
            momentum_required = self.momentum_threshold

        momentum = self.price_history[-1] - self.price_history[-3]
        position_size = self.bankroll * self.position_size_pct

        side = None
        contracts = 0
        cost = 0.0

        # Long entry
        if momentum >= momentum_required:
            contracts = int(position_size / price * 100)
            if contracts < 1:
                return
            cost = contracts * price / 100
            side = 'long'

        # Short entry
        elif momentum <= -momentum_required:
            no_price = 100 - price
            contracts = int(position_size / no_price * 100)
            if contracts < 1:
                return
            cost = contracts * no_price / 100
            side = 'short'

        if side:
            self.position = {
                'side': side,
                'entry_price': price,
                'contracts': contracts,
                'cost': cost,
                'entry_tick': tick['tick'],
                'entry_time': datetime.now(timezone.utc),
                'high': price if side == 'long' else None,
                'low': price if side == 'short' else None,
                # DCA fields
                'dca_count': 0,
                'avg_entry_price': price,
                'total_cost': cost,
                'dca_history': []
            }
            self.bankroll -= cost

            # Update bankroll in database
            await self.db.update_live_bot_bankroll(self.event_ticker, self.bankroll)

            # Store in database
            trade_id = await self.db.insert_trade({
                'event_ticker': self.event_ticker,
                'side': side,
                'team': tick.get('home_team'),
                'entry_price': price,
                'entry_tick': tick['tick'],
                'entry_time': datetime.now(timezone.utc),
                'contracts': contracts,
                'user_id': self.user_id,
                'config_snapshot': {
                    'momentum_threshold': self.momentum_threshold,
                    'initial_stop': self.initial_stop,
                    'profit_target': self.profit_target,
                    'breakeven_trigger': self.breakeven_trigger,
                    'position_size_pct': self.position_size_pct
                }
            })
            self.position['trade_id'] = trade_id

            # Broadcast entry
            if self.broadcast_fn:
                await self.broadcast_fn({
                    "type": "live_bot_entry",
                    "event_ticker": self.event_ticker,
                    "data": {
                        "side": side,
                        "price": price,
                        "contracts": contracts,
                        "cost": cost,
                        "momentum": momentum,
                        "bankroll": self.bankroll
                    }
                })

    async def _check_exit(self, price: int, tick: Dict):
        """Check for exit signal"""
        pos = self.position
        exit_reason = None

        # Use average entry price if DCA position, otherwise use original entry
        entry_price = pos.get('avg_entry_price', pos['entry_price'])

        # Calculate dynamic stops and targets based on time remaining
        current_stop = self._calculate_dynamic_stop(self.initial_stop, tick)
        current_target = self._calculate_dynamic_target(self.profit_target, tick)

        if pos['side'] == 'long':
            gain = price - entry_price
            pos['high'] = max(pos.get('high', pos['entry_price']), price)

            # Determine stop price (using dynamic stop)
            if gain >= self.breakeven_trigger:
                stop_price = entry_price
                stop_type = 'BREAKEVEN'
            else:
                stop_price = entry_price - current_stop
                stop_type = 'STOP'

            # Check exit conditions (using dynamic target)
            if gain >= current_target:
                exit_reason = 'PROFIT'
            elif price <= stop_price:
                exit_reason = stop_type

        elif pos['side'] == 'short':
            gain = entry_price - price
            pos['low'] = min(pos.get('low', pos['entry_price']), price)

            # Determine stop price (using dynamic stop)
            if gain >= self.breakeven_trigger:
                stop_price = entry_price
                stop_type = 'BREAKEVEN'
            else:
                stop_price = entry_price + current_stop
                stop_type = 'STOP'

            # Check exit conditions (using dynamic target)
            if gain >= current_target:
                exit_reason = 'PROFIT'
            elif price >= stop_price:
                exit_reason = stop_type

        if exit_reason:
            await self._execute_exit(price, tick, exit_reason)

    async def _execute_exit(self, price: int, tick: Dict, reason: str):
        """Execute exit and update database"""
        pos = self.position

        # Calculate P&L
        if pos['side'] == 'long':
            proceeds = pos['contracts'] * price / 100
        else:  # short
            current_no_price = 100 - price
            proceeds = pos['contracts'] * current_no_price / 100

        pnl = proceeds - pos['cost']
        self.bankroll += proceeds
        self.total_pnl += pnl
        self.total_trades += 1

        if pnl > 0:
            self.wins += 1
        elif pnl < 0:
            self.losses += 1

        # Update bankroll in database
        await self.db.update_live_bot_bankroll(self.event_ticker, self.bankroll)

        # Update database
        await self.db.update_trade_exit(pos['trade_id'], {
            'exit_price': price,
            'exit_tick': tick['tick'],
            'exit_time': datetime.now(timezone.utc),
            'exit_reason': reason,
            'pnl': pnl
        })

        # Broadcast exit
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "live_bot_exit",
                "event_ticker": self.event_ticker,
                "data": {
                    "side": pos['side'],
                    "entry_price": pos['entry_price'],
                    "exit_price": price,
                    "contracts": pos['contracts'],
                    "pnl": pnl,
                    "reason": reason,
                    "bankroll": self.bankroll
                }
            })

        self.position = None

    def get_wallet_status(self) -> Dict:
        """Get current wallet and position status"""
        position_value = 0.0
        unrealized_pnl = 0.0

        if self.position and self.price_history:
            current_price = self.price_history[-1]
            pos = self.position

            if pos['side'] == 'long':
                position_value = pos['contracts'] * current_price / 100
            else:  # short
                position_value = pos['contracts'] * (100 - current_price) / 100

            unrealized_pnl = position_value - pos['cost']

        return {
            "bankroll": self.bankroll,
            "starting_bankroll": self.starting_bankroll,
            "position_value": position_value,
            "unrealized_pnl": unrealized_pnl,
            "realized_pnl": self.total_pnl,
            "total_pnl": self.total_pnl + unrealized_pnl,
            "total_value": self.bankroll + position_value,
            "total_return_pct": ((self.bankroll + position_value) / self.starting_bankroll - 1) * 100,
            "position": {
                "side": self.position['side'] if self.position else None,
                "entry_price": self.position['entry_price'] if self.position else None,
                "contracts": self.position['contracts'] if self.position else None,
                "cost": self.position['cost'] if self.position else None,
                "current_price": self.price_history[-1] if self.price_history else None
            } if self.position else None,
            "stats": {
                "total_trades": self.total_trades,
                "wins": self.wins,
                "losses": self.losses,
                "win_rate": (self.wins / self.total_trades * 100) if self.total_trades > 0 else 0
            },
            "config": {
                "momentum_threshold": self.momentum_threshold,
                "initial_stop": self.initial_stop,
                "profit_target": self.profit_target,
                "breakeven_trigger": self.breakeven_trigger,
                "position_size_pct": self.position_size_pct
            }
        }

    def update_config(self, config: Dict):
        """Update strategy configuration"""
        # Note: Bankroll cannot be updated after bot starts
        # starting_bankroll must remain fixed for accurate P&L tracking

        if 'momentum_threshold' in config:
            self.momentum_threshold = config['momentum_threshold']
        if 'initial_stop' in config:
            self.initial_stop = config['initial_stop']
        if 'profit_target' in config:
            self.profit_target = config['profit_target']
        if 'breakeven_trigger' in config:
            self.breakeven_trigger = config['breakeven_trigger']
        if 'position_size_pct' in config:
            self.position_size_pct = config['position_size_pct']

    async def top_up(self, amount: float):
        """Add more funds to the bot's bankroll from user wallet"""
        if not self.user_id:
            raise ValueError("Cannot top up bot without user_id")

        # Check user has enough balance
        user = await self.db.get_user_by_id(self.user_id)
        if not user:
            raise ValueError("User not found")

        if user['current_balance'] < amount:
            raise ValueError(f"Insufficient funds. Available: ${user['current_balance']:.2f}, Requested: ${amount:.2f}")

        # Deduct from user wallet
        new_balance = user['current_balance'] - amount
        await self.db.update_user_balance(self.user_id, new_balance)
        await self.db.add_wallet_transaction(
            user_id=self.user_id,
            amount=-amount,
            tx_type='bot_topup',
            balance_after=new_balance,
            event_ticker=self.event_ticker
        )

        # Add to bot bankroll
        self.bankroll += amount

        # Update database
        await self.db.update_live_bot_bankroll(self.event_ticker, self.bankroll)

        # Broadcast update
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "live_bot_topup",
                "event_ticker": self.event_ticker,
                "data": {
                    "amount": amount,
                    "new_bankroll": self.bankroll,
                    "user_balance": new_balance
                }
            })

        return {
            "amount": amount,
            "new_bankroll": self.bankroll,
            "user_balance": new_balance
        }

    async def stop(self, reason: str = 'BOT_STOPPED'):
        """Stop the bot and close any open positions"""
        self.is_active = False

        if self.position and self.price_history:
            # Force close at current price
            current_price = self.price_history[-1]
            await self._execute_exit(current_price, {
                'tick': 0,
                'home_team': ''
            }, reason)

        # Return remaining bankroll to user wallet
        if self.user_id and self.bankroll > 0:
            user = await self.db.get_user_by_id(self.user_id)
            if user:
                new_balance = user['current_balance'] + self.bankroll
                await self.db.update_user_balance(self.user_id, new_balance)
                await self.db.add_wallet_transaction(
                    user_id=self.user_id,
                    amount=self.bankroll,
                    tx_type='bot_stop',
                    balance_after=new_balance,
                    event_ticker=self.event_ticker
                )

        # Mark as stopped in database
        await self.db.stop_live_bot(self.event_ticker)

    # ============================================================================
    # HELPER METHODS - Time and Game Context
    # ============================================================================

    def _calculate_time_remaining(self, quarter: int, clock: str) -> int:
        """
        Calculate total seconds remaining in game.

        Football quarters are 15 minutes = 900 seconds each.
        Total game = 3600 seconds.

        Args:
            quarter: Current quarter (0-4, where 0=pregame, 5=final)
            clock: Time remaining in quarter (format: "12:34")

        Returns:
            Seconds remaining in game (0-3600)
        """
        # Edge cases
        if quarter == 0:  # Pregame
            return 3600
        if quarter >= 5:  # Final
            return 0

        # Parse clock string
        clock_seconds = 0
        try:
            if ':' in str(clock):
                parts = str(clock).strip().split(':')
                mins = int(parts[0])
                secs = int(parts[1]) if len(parts) > 1 else 0
                clock_seconds = mins * 60 + secs
            else:
                # If no colon, assume it's already in seconds
                clock_seconds = int(float(str(clock)))
        except:
            # Default to full quarter if parse fails
            clock_seconds = 900

        # Calculate remaining time
        # Quarters after current quarter
        quarters_after_current = 4 - quarter
        time_remaining = (quarters_after_current * 900) + clock_seconds

        return max(0, min(3600, time_remaining))

    def _calculate_dynamic_stop(self, base_stop: int, tick: Dict) -> int:
        """
        Calculate stop loss adjusted for time remaining.

        Args:
            base_stop: Base stop loss in cents (e.g., 8)
            tick: Current tick data with quarter and clock

        Returns:
            Adjusted stop loss in cents (minimum 3, maximum 20)
        """
        if not self.enable_time_scaling:
            return base_stop

        time_remaining = self._calculate_time_remaining(
            tick.get('quarter', 0),
            tick.get('clock', '15:00')
        )

        # Calculate time ratio (0.0 = end of game, 1.0 = start)
        time_ratio = time_remaining / 3600

        # Linear interpolation between late game and early game multipliers
        # Early game (time_ratio > 0.5): use early_game_multiplier
        # Late game (time_ratio < 0.5): interpolate to late_game_multiplier
        if time_ratio >= 0.5:
            # First half: use early game multiplier
            multiplier = self.early_game_stop_multiplier
        else:
            # Second half: interpolate from 1.0 to late_game_multiplier
            # At halftime (0.5), use 1.0
            # At end (0.0), use late_game_multiplier
            progress = (0.5 - time_ratio) / 0.5  # 0.0 at halftime, 1.0 at end
            multiplier = 1.0 + progress * (self.late_game_stop_multiplier - 1.0)

        adjusted_stop = int(base_stop * multiplier)

        # Apply bounds
        return max(3, min(20, adjusted_stop))

    def _calculate_dynamic_target(self, base_target: int, tick: Dict) -> int:
        """
        Calculate profit target adjusted for time remaining.

        Args:
            base_target: Base profit target in cents (e.g., 15)
            tick: Current tick data with quarter and clock

        Returns:
            Adjusted profit target in cents (minimum 5, maximum 30)
        """
        if not self.enable_time_scaling:
            return base_target

        time_remaining = self._calculate_time_remaining(
            tick.get('quarter', 0),
            tick.get('clock', '15:00')
        )

        # Calculate time ratio
        time_ratio = time_remaining / 3600

        # Similar logic to stops but inverse
        if time_ratio >= 0.5:
            # First half: use early game multiplier (higher targets)
            multiplier = self.early_game_target_multiplier
        else:
            # Second half: interpolate from 1.0 to late_game_multiplier
            progress = (0.5 - time_ratio) / 0.5
            multiplier = 1.0 + progress * (self.late_game_target_multiplier - 1.0)

        adjusted_target = int(base_target * multiplier)

        # Apply bounds
        return max(5, min(30, adjusted_target))

    async def _store_opening_price(self, tick: Dict) -> None:
        """
        Store the first tick's price as market opening sentiment.

        Args:
            tick: First tick data with home_price and away_price
        """
        if self.first_tick_received:
            return

        self.opening_home_price = tick.get('home_price', 50)
        self.opening_away_price = tick.get('away_price', 50)
        self.first_tick_received = True

        # Save to database for persistence across bot restarts
        await self.db.save_opening_prices(
            self.event_ticker,
            self.opening_home_price,
            self.opening_away_price
        )

    def _get_market_bias(self, current_price: int, side: str) -> str:
        """
        Determine if we're trading with or against opening market sentiment.

        Args:
            current_price: Current home team price
            side: Trade side ('long' or 'short')

        Returns:
            "fade_favorite" | "support_underdog" | "neutral"
        """
        if self.opening_home_price is None:
            return "neutral"

        opening = self.opening_home_price

        # Determine if opening indicated favorite or underdog
        if opening >= self.favorite_fade_threshold:
            # Home was strong favorite at open
            if side == 'long':
                return "fade_favorite"  # Going long on favorite
            else:
                return "support_underdog"  # Shorting favorite = supporting away
        elif opening <= self.underdog_support_threshold:
            # Home was strong underdog at open
            if side == 'long':
                return "support_underdog"  # Going long on underdog
            else:
                return "fade_favorite"  # Shorting underdog = supporting favorite

        return "neutral"

    def _calculate_game_context_score(self, tick: Dict) -> Dict:
        """
        Analyze current game state and return context factors.

        Args:
            tick: Current tick data

        Returns:
            Dict with:
                - time_remaining: seconds left in game
                - time_quartile: 0-3 (Q1-Q4 equivalent)
                - possession_factor: 1.0-1.2 based on possession
                - volatility_factor: 1.0-1.5 based on score differential
                - market_sentiment: "fade" or "follow"
        """
        time_remaining = self._calculate_time_remaining(
            tick.get('quarter', 0),
            tick.get('clock', '15:00')
        )

        # Calculate which quartile we're in
        time_quartile = min(3, int((3600 - time_remaining) / 900))

        # Possession factor (favor team with ball)
        possession_factor = 1.0
        if self.position and self.enable_game_context:
            possession_team = tick.get('possession_team_id', '')
            home_team_id = tick.get('home_team', '')

            if possession_team and home_team_id:
                # If we're long and home has possession, or short and away has possession
                has_favorable_possession = (
                    (self.position['side'] == 'long' and possession_team == home_team_id) or
                    (self.position['side'] == 'short' and possession_team != home_team_id)
                )
                if has_favorable_possession:
                    possession_factor = 1.0 + (self.possession_bias_cents / 100.0)

        # Volatility factor based on score differential
        volatility_factor = 1.0
        score_diff = abs(tick.get('score_diff', 0))
        if score_diff > 14:
            # Blowout: lower volatility (garbage time)
            volatility_factor = 0.9
        elif 7 <= score_diff <= 14:
            # Moderate lead: higher volatility (losing team pressing)
            volatility_factor = self.score_volatility_multiplier

        # Market sentiment
        current_price = tick.get('home_price', 50)
        market_sentiment = "follow"
        if self.opening_home_price:
            if self.opening_home_price >= self.favorite_fade_threshold:
                market_sentiment = "fade"
            elif self.opening_home_price <= self.underdog_support_threshold:
                market_sentiment = "follow"

        return {
            'time_remaining': time_remaining,
            'time_quartile': time_quartile,
            'possession_factor': possession_factor,
            'volatility_factor': volatility_factor,
            'market_sentiment': market_sentiment
        }

    # ============================================================================
    # HELPER METHODS - Dollar Cost Averaging (DCA)
    # ============================================================================

    async def _check_dca(self, price: int, tick: Dict):
        """
        Check if we should add to existing position (dollar cost averaging).

        Args:
            price: Current price
            tick: Current tick data
        """
        if not self.enable_dca:
            return

        if not self.position:
            return

        # Check DCA limits
        dca_count = self.position.get('dca_count', 0)
        if dca_count >= self.dca_max_additions:
            return

        # Check time remaining
        context = self._calculate_game_context_score(tick)
        if context['time_remaining'] < self.dca_min_time_remaining:
            return

        # Check if price moved against us enough
        avg_entry = self.position.get('avg_entry_price', self.position['entry_price'])

        if self.position['side'] == 'long':
            loss_from_avg = avg_entry - price
            if loss_from_avg < self.dca_trigger_cents:
                return  # Not enough adverse movement
        else:  # short
            loss_from_avg = price - avg_entry
            if loss_from_avg < self.dca_trigger_cents:
                return

        # Calculate DCA size (decreasing with each addition)
        base_size = self.starting_bankroll * self.position_size_pct
        dca_size = base_size * (self.dca_size_multiplier ** (dca_count + 1))

        # Check total risk limit
        total_cost = self.position.get('total_cost', self.position['cost'])
        potential_total_cost = total_cost + dca_size
        if potential_total_cost > self.starting_bankroll * self.dca_max_total_risk_pct:
            return  # Would exceed risk limit

        # Check if we have enough bankroll
        if dca_size > self.bankroll:
            return

        # Execute DCA add
        await self._execute_dca_addition(price, tick, dca_size)

    async def _execute_dca_addition(self, price: int, tick: Dict, dca_size: float):
        """
        Add to existing position (dollar cost averaging).

        Args:
            price: Current price to add at
            tick: Current tick data
            dca_size: Amount to add in dollars
        """
        pos = self.position

        # Calculate contracts for this addition
        if pos['side'] == 'long':
            new_contracts = int(dca_size / price * 100)
            if new_contracts < 1:
                return
            add_cost = new_contracts * price / 100
        else:  # short
            no_price = 100 - price
            new_contracts = int(dca_size / no_price * 100)
            if new_contracts < 1:
                return
            add_cost = new_contracts * no_price / 100

        # Get current totals
        old_total_cost = pos.get('total_cost', pos['cost'])
        old_contracts = pos['contracts']

        # Update position
        pos['contracts'] += new_contracts
        pos['total_cost'] = old_total_cost + add_cost

        # Recalculate average entry price (weighted average)
        if pos['side'] == 'long':
            # For longs: weighted average of prices
            total_cost_dollars = pos['total_cost']
            total_contracts = pos['contracts']
            pos['avg_entry_price'] = int((total_cost_dollars * 100) / total_contracts)
        else:  # short
            # For shorts: weighted average of "no" prices
            total_cost_dollars = pos['total_cost']
            total_contracts = pos['contracts']
            avg_no_price = (total_cost_dollars * 100) / total_contracts
            pos['avg_entry_price'] = int(100 - avg_no_price)

        # Record DCA event
        dca_count = pos.get('dca_count', 0)
        pos['dca_count'] = dca_count + 1

        if 'dca_history' not in pos:
            pos['dca_history'] = []

        pos['dca_history'].append({
            'price': price,
            'contracts': new_contracts,
            'cost': add_cost,
            'tick': tick['tick']
        })

        # Deduct from bankroll
        self.bankroll -= add_cost

        # Update database - save DCA info in config_snapshot
        await self.db.update_trade_dca(pos['trade_id'], {
            'avg_entry_price': pos['avg_entry_price'],
            'total_contracts': pos['contracts'],
            'total_cost': pos['total_cost'],
            'dca_count': pos['dca_count'],
            'dca_history': pos['dca_history']
        })

        # Update bankroll in database
        await self.db.update_live_bot_bankroll(self.event_ticker, self.bankroll)

        # Broadcast DCA event
        if self.broadcast_fn:
            await self.broadcast_fn({
                "type": "live_bot_dca",
                "event_ticker": self.event_ticker,
                "data": {
                    "side": pos['side'],
                    "add_price": price,
                    "add_contracts": new_contracts,
                    "add_cost": add_cost,
                    "new_avg_entry": pos['avg_entry_price'],
                    "total_contracts": pos['contracts'],
                    "dca_count": pos['dca_count'],
                    "bankroll": self.bankroll,
                    "time_remaining": self._calculate_time_remaining(
                        tick.get('quarter', 0),
                        tick.get('clock', '15:00')
                    )
                }
            })
