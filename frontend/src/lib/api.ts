const API_BASE = '/api';

export async function fetchGames() {
  const res = await fetch(`${API_BASE}/games`);
  return res.json();
}

export async function fetchActiveGames() {
  const res = await fetch(`${API_BASE}/games/active`);
  return res.json();
}

export async function getGameInfo(eventTicker: string) {
  const res = await fetch(`${API_BASE}/games`);
  const data = await res.json();
  return data.games?.find((game: any) => game.event_ticker === eventTicker);
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

export async function getBotSessionHistory() {
  const res = await fetch(`${API_BASE}/history/bot-sessions`, {
    credentials: 'include'
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to get bot session history');
  }
  return res.json();
}

export async function getBotSessionDetail(eventTicker: string) {
  const res = await fetch(`${API_BASE}/history/${eventTicker}`, {
    credentials: 'include'
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to get session detail');
  }
  return res.json();
}

export function getExportUrl(eventTicker: string) {
  return `${API_BASE}/games/${eventTicker}/export`;
}

// Live Bot API
export async function startLiveBot(eventTicker: string, config: {
  momentum_threshold?: number;
  initial_stop?: number;
  profit_target?: number;
  breakeven_trigger?: number;
  position_size_pct?: number;
  // Time-based dynamic exits
  enable_time_scaling?: boolean;
  early_game_stop_multiplier?: number;
  late_game_stop_multiplier?: number;
  early_game_target_multiplier?: number;
  late_game_target_multiplier?: number;
  // Game context factors
  enable_game_context?: boolean;
  possession_bias_cents?: number;
  score_volatility_multiplier?: number;
  favorite_fade_threshold?: number;
  underdog_support_threshold?: number;
  // DCA parameters
  enable_dca?: boolean;
  dca_max_additions?: number;
  dca_trigger_cents?: number;
  dca_size_multiplier?: number;
  dca_min_time_remaining?: number;
  dca_max_total_risk_pct?: number;
}) {
  const params = new URLSearchParams();
  // Basic parameters
  if (config.momentum_threshold !== undefined) params.set('momentum_threshold', config.momentum_threshold.toString());
  if (config.initial_stop !== undefined) params.set('initial_stop', config.initial_stop.toString());
  if (config.profit_target !== undefined) params.set('profit_target', config.profit_target.toString());
  if (config.breakeven_trigger !== undefined) params.set('breakeven_trigger', config.breakeven_trigger.toString());
  if (config.position_size_pct !== undefined) params.set('position_size_pct', config.position_size_pct.toString());
  // Time-based parameters
  if (config.enable_time_scaling !== undefined) params.set('enable_time_scaling', config.enable_time_scaling.toString());
  if (config.early_game_stop_multiplier !== undefined) params.set('early_game_stop_multiplier', config.early_game_stop_multiplier.toString());
  if (config.late_game_stop_multiplier !== undefined) params.set('late_game_stop_multiplier', config.late_game_stop_multiplier.toString());
  if (config.early_game_target_multiplier !== undefined) params.set('early_game_target_multiplier', config.early_game_target_multiplier.toString());
  if (config.late_game_target_multiplier !== undefined) params.set('late_game_target_multiplier', config.late_game_target_multiplier.toString());
  // Game context parameters
  if (config.enable_game_context !== undefined) params.set('enable_game_context', config.enable_game_context.toString());
  if (config.possession_bias_cents !== undefined) params.set('possession_bias_cents', config.possession_bias_cents.toString());
  if (config.score_volatility_multiplier !== undefined) params.set('score_volatility_multiplier', config.score_volatility_multiplier.toString());
  if (config.favorite_fade_threshold !== undefined) params.set('favorite_fade_threshold', config.favorite_fade_threshold.toString());
  if (config.underdog_support_threshold !== undefined) params.set('underdog_support_threshold', config.underdog_support_threshold.toString());
  // DCA parameters
  if (config.enable_dca !== undefined) params.set('enable_dca', config.enable_dca.toString());
  if (config.dca_max_additions !== undefined) params.set('dca_max_additions', config.dca_max_additions.toString());
  if (config.dca_trigger_cents !== undefined) params.set('dca_trigger_cents', config.dca_trigger_cents.toString());
  if (config.dca_size_multiplier !== undefined) params.set('dca_size_multiplier', config.dca_size_multiplier.toString());
  if (config.dca_min_time_remaining !== undefined) params.set('dca_min_time_remaining', config.dca_min_time_remaining.toString());
  if (config.dca_max_total_risk_pct !== undefined) params.set('dca_max_total_risk_pct', config.dca_max_total_risk_pct.toString());

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

export async function getUserDefaultBotConfig() {
  const res = await fetch(`${API_BASE}/user/default-bot-config`, {
    credentials: 'include'
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to get default bot config');
  }

  return res.json();
}

export async function updateUserDefaultBotConfig(config: {
  momentum_threshold: number;
  initial_stop: number;
  profit_target: number;
  breakeven_trigger: number;
  position_size_pct: number;
}) {
  const res = await fetch(`${API_BASE}/user/default-bot-config`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to update default bot config');
  }

  return res.json();
}
