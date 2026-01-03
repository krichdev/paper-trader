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
        user_id: Optional[int] = None
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

        # Check for existing trades
        trades = await self.db.get_bot_trades(self.event_ticker)

        if trades:
            # Calculate stats from existing trades
            self.total_trades = len(trades)
            self.wins = len([t for t in trades if t.get('pnl', 0) > 0])
            self.losses = len([t for t in trades if t.get('pnl', 0) <= 0 and t.get('exit_price')])
            self.total_pnl = sum(t.get('pnl', 0) for t in trades if t.get('pnl'))

            # Check for open position
            open_trade = await self.db.get_open_trade(self.event_ticker)
            if open_trade:
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
                    'low': open_trade['entry_price'] if open_trade['side'] == 'short' else None
                }

                # Recalculate cost from contracts
                if self.position['side'] == 'long':
                    self.position['cost'] = self.position['contracts'] * self.position['entry_price'] / 100
                else:
                    no_price = 100 - self.position['entry_price']
                    self.position['cost'] = self.position['contracts'] * no_price / 100

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

        # Update price history
        self.price_history.append(home_price)
        if len(self.price_history) > 10:
            self.price_history = self.price_history[-10:]

        # Check exit first
        if self.position:
            await self._check_exit(home_price, tick)

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

        momentum = self.price_history[-1] - self.price_history[-3]
        position_size = self.bankroll * self.position_size_pct

        side = None
        contracts = 0
        cost = 0.0

        # Long entry
        if momentum >= self.momentum_threshold:
            contracts = int(position_size / price * 100)
            if contracts < 1:
                return
            cost = contracts * price / 100
            side = 'long'

        # Short entry
        elif momentum <= -self.momentum_threshold:
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
                'low': price if side == 'short' else None
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
                    'breakeven_trigger': self.breakeven_trigger
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

        if pos['side'] == 'long':
            gain = price - pos['entry_price']
            pos['high'] = max(pos.get('high', pos['entry_price']), price)

            # Determine stop price
            if gain >= self.breakeven_trigger:
                stop_price = pos['entry_price']
                stop_type = 'BREAKEVEN'
            else:
                stop_price = pos['entry_price'] - self.initial_stop
                stop_type = 'STOP'

            # Check exit conditions
            if gain >= self.profit_target:
                exit_reason = 'PROFIT'
            elif price <= stop_price:
                exit_reason = stop_type

        elif pos['side'] == 'short':
            gain = pos['entry_price'] - price
            pos['low'] = min(pos.get('low', pos['entry_price']), price)

            # Determine stop price
            if gain >= self.breakeven_trigger:
                stop_price = pos['entry_price']
                stop_type = 'BREAKEVEN'
            else:
                stop_price = pos['entry_price'] + self.initial_stop
                stop_type = 'STOP'

            # Check exit conditions
            if gain >= self.profit_target:
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

        # Update user wallet (return funds + P&L)
        if self.user_id:
            user = await self.db.get_user_by_id(self.user_id)
            if user:
                new_balance = user['current_balance'] + proceeds
                await self.db.update_user_balance(self.user_id, new_balance, pnl)
                await self.db.add_wallet_transaction(
                    user_id=self.user_id,
                    amount=proceeds,
                    tx_type='trade_exit',
                    balance_after=new_balance,
                    event_ticker=self.event_ticker,
                    trade_id=pos['trade_id']
                )

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

    async def stop(self):
        """Stop the bot and close any open positions"""
        self.is_active = False

        if self.position and self.price_history:
            # Force close at current price
            current_price = self.price_history[-1]
            await self._execute_exit(current_price, {
                'tick': 0,
                'home_team': ''
            }, 'BOT_STOPPED')

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
