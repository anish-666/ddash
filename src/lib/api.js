/*
 * Frontend fetch helpers for the Docvai dashboard.  All
 * requests are proxied through Netlify Functions via
 * VITE_API_BASE.  The http() function wraps fetch to
 * automatically parse JSON and throw errors on
 * non‑successful responses.
 */

const BASE = import.meta.env.VITE_API_BASE || '/.netlify/functions';

async function http(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init
  });
  const txt = await res.text();
  let data;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = { raw: txt };
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.detail)) || res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }
  return data;
}

export const api = {
  /**
   * Log the user in.  Credentials are passed to the
   * Netlify function which returns the authenticated
   * user or an error.
   */
  login: (email, password) => http('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  /**
   * Retrieve the list of agents from the backend.  If
   * authentication is disabled, this always returns an
   * array, otherwise it may throw if the user is not
   * authenticated.
   */
  agents: () => http('/agents'),
  /**
   * Initiate outbound calls to a list of phone numbers.
   * If agentId is omitted, the configured fallback
   * agent will be used.
   */
  outbound: (numbers, agentId) => http('/calls-outbound', { method: 'POST', body: JSON.stringify({ numbers, agentId }) }),
  /**
   * Get a summary of analytics for the given time
   * window.  window should be a string like '7d'.
   */
  analyticsSummary: (window = '7d') => http(`/analytics-summary?window=${encodeURIComponent(window)}`),
  /**
   * Get a timeseries of analytics data for the given
   * window.
   */
  analyticsTimeseries: (window = '7d') => http(`/analytics-timeseries?window=${encodeURIComponent(window)}`)
};