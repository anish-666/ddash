// api/_cron-plivo-sync.js (CJS) — Hourly scheduled wrapper calling plivo-sync logic
const { corsHeaders } = require('./_lib/auth');

module.exports.handler = async (event) => {
  try {
    // Call our own function locally (same origin), no need to expose admin header here
    const base = process.env.PUBLIC_SITE_URL || ''; // optional, we can also invoke code inline
    const res = await fetch(`${base}/.netlify/functions/plivo-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // You can pass a tighter window if you want:
      // body: JSON.stringify({ lookback_min: 120 })
    });
    const txt = await res.text();
    return { statusCode: res.status, headers: corsHeaders(event), body: txt };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: 'cron_failed', detail: e.message }) };
  }
};
