// src/lib/api.js
const BASE = import.meta.env.VITE_API_BASE || '/.netlify/functions';

// tiny fetch wrapper for the SPA
async function http(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include', // send/receive cookies
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.detail)) || res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }
  return data;
}

export const api = {
  login: (email, password) =>
    http('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  agents: () => http('/agents'),

  outbound: (numbers, agentId, fromNumber) =>
    http('/calls-outbound', {
      method: 'POST',
      body: JSON.stringify({ numbers, agentId, fromNumber })
    }),

  analyticsSummary: (window = '7d') =>
    http(`/analytics-summary?window=${encodeURIComponent(window)}`),

  analyticsTimeseries: (window = '7d') =>
    http(`/analytics-timeseries?window=${encodeURIComponent(window)}`),

  conversations: () => http('/conversations')
};
