// src/lib/api.js
const BASE = import.meta.env.VITE_API_BASE || '/.netlify/functions';

async function http(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init
  });
  const txt = await res.text();
  let data;
  try { data = txt ? JSON.parse(txt) : null } catch { data = { raw: txt } }
  if (!res.ok) {
    const errMsg = (data && (data.detail || data.message || data.error)) || res.statusText;
    throw new Error(`${res.status} ${errMsg}`);
  }
  return data;
}

export const api = {
  login: (email, password) => http('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  agents: () => http('/agents'),
  outbound: (numbers, agentId) => http('/calls-outbound', { method: 'POST', body: JSON.stringify({ numbers, agentId }) }),
  analyticsSummary: (window='7d') => http(`/analytics-summary?window=${encodeURIComponent(window)}`),
  analyticsTimeseries: (window='7d') => http(`/analytics-timeseries?window=${encodeURIComponent(window)}`),
  conversations: () => http('/conversations')
};
