const API_BASE = '/api';

export async function fetchGames() {
  const res = await fetch(`${API_BASE}/games`);
  return res.json();
}

export async function fetchActiveGames() {
  const res = await fetch(`${API_BASE}/games/active`);
  return res.json();
}

export async function startLogging(eventTicker: string, milestoneId: string) {
  const res = await fetch(`${API_BASE}/games/${eventTicker}/start?milestone_id=${milestoneId}`, {
    method: 'POST'
  });
  return res.json();
}

export async function stopLogging(eventTicker: string) {
  const res = await fetch(`${API_BASE}/games/${eventTicker}/stop`, {
    method: 'POST'
  });
  return res.json();
}

export async function getGameTicks(eventTicker: string, limit = 100) {
  const res = await fetch(`${API_BASE}/games/${eventTicker}/ticks?limit=${limit}`);
  return res.json();
}

export async function startBot(eventTicker: string, config: any) {
  const res = await fetch(`${API_BASE}/bot/${eventTicker}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return res.json();
}

export async function stopBot(eventTicker: string) {
  const res = await fetch(`${API_BASE}/bot/${eventTicker}/stop`, {
    method: 'POST'
  });
  return res.json();
}

export async function updateBotConfig(eventTicker: string, config: any) {
  const res = await fetch(`${API_BASE}/bot/${eventTicker}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return res.json();
}

export async function getBotTrades(eventTicker: string) {
  const res = await fetch(`${API_BASE}/bot/${eventTicker}/trades`, {
    credentials: 'include'
  });
  return res.json();
}

export async function getSessionHistory() {
  const res = await fetch(`${API_BASE}/history/sessions`);
  return res.json();
}

export function getExportUrl(eventTicker: string) {
  return `${API_BASE}/games/${eventTicker}/export`;
}

// Live Bot API
export async function startLiveBot(eventTicker: string, config: {
  bankroll?: number;
  momentum_threshold?: number;
  initial_stop?: number;
  profit_target?: number;
  breakeven_trigger?: number;
  position_size_pct?: number;
}) {
  const params = new URLSearchParams();
  if (config.bankroll !== undefined) params.set('bankroll', config.bankroll.toString());
  if (config.momentum_threshold !== undefined) params.set('momentum_threshold', config.momentum_threshold.toString());
  if (config.initial_stop !== undefined) params.set('initial_stop', config.initial_stop.toString());
  if (config.profit_target !== undefined) params.set('profit_target', config.profit_target.toString());
  if (config.breakeven_trigger !== undefined) params.set('breakeven_trigger', config.breakeven_trigger.toString());
  if (config.position_size_pct !== undefined) params.set('position_size_pct', config.position_size_pct.toString());

  const res = await fetch(`${API_BASE}/livebot/${eventTicker}/start?${params}`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to start live bot');
  }

  return res.json();
}

export async function stopLiveBot(eventTicker: string) {
  const res = await fetch(`${API_BASE}/livebot/${eventTicker}/stop`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to stop live bot');
  }

  return res.json();
}

export async function getLiveBotWallet(eventTicker: string) {
  const res = await fetch(`${API_BASE}/livebot/${eventTicker}/wallet`, {
    credentials: 'include'
  });
  return res.json();
}

export async function updateLiveBotConfig(eventTicker: string, config: {
  bankroll?: number;
  momentum_threshold?: number;
  initial_stop?: number;
  profit_target?: number;
  breakeven_trigger?: number;
  position_size_pct?: number;
}) {
  const params = new URLSearchParams();
  if (config.bankroll !== undefined) params.set('bankroll', config.bankroll.toString());
  if (config.momentum_threshold !== undefined) params.set('momentum_threshold', config.momentum_threshold.toString());
  if (config.initial_stop !== undefined) params.set('initial_stop', config.initial_stop.toString());
  if (config.profit_target !== undefined) params.set('profit_target', config.profit_target.toString());
  if (config.breakeven_trigger !== undefined) params.set('breakeven_trigger', config.breakeven_trigger.toString());
  if (config.position_size_pct !== undefined) params.set('position_size_pct', config.position_size_pct.toString());

  const res = await fetch(`${API_BASE}/livebot/${eventTicker}/config?${params}`, {
    method: 'PUT',
    credentials: 'include'
  });
  return res.json();
}

export async function topUpLiveBot(eventTicker: string, amount: number) {
  const res = await fetch(`${API_BASE}/livebot/${eventTicker}/topup?amount=${amount}`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to top up bot');
  }

  return res.json();
}

export async function resetUserAccount() {
  const res = await fetch(`${API_BASE}/user/reset`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to reset account');
  }

  return res.json();
}
