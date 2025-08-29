// Netlify function that returns a time series of
// analytics.  Without persistent storage this
// synthesises a list of call counts for each day in
// the requested window.  The front‑end visualises
// these values in a simple line chart.  If you later
// wire up a database this function can query real
// call logs instead.

const { requireAuth } = require('./_lib/auth.js');

module.exports.handler = async (event) => {
  try {
    requireAuth(event);
    const params = event.queryStringParameters || {};
    const windowStr = params.window || '7d';
    const daysMatch = /^(\d+)d$/.exec(windowStr);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 7;
    const now = Date.now();
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const iso = date.toISOString().split('T')[0];
      const calls = 5 + Math.floor(Math.random() * 10);
      const call_minutes = calls * (2 + Math.random() * 3);
      const interactions = calls * (3 + Math.random() * 2);
      series.push({ date: iso, calls, call_minutes: Math.round(call_minutes), interactions: Math.round(interactions) });
    }
    return { statusCode: 200, body: JSON.stringify({ window: windowStr, series }) };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};