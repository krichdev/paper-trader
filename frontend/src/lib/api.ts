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
  const res = await fetch(`${API_BASE}/bot/${eventTicker}/trades`);
  return res.json();
}

export async function getSessionHistory() {
  const res = await fetch(`${API_BASE}/history/sessions`);
  return res.json();
}

export function getExportUrl(eventTicker: string) {
  return `${API_BASE}/games/${eventTicker}/export`;
}
