const { requireAuth, corsHeaders } = require('./_lib/auth.js');

function makeSeries(days) {
  const today = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = d.toISOString().slice(0, 10);
    const value = Math.floor(20 + Math.random() * 30);
    out.push({ date: label, calls: value });
  }
  return out;
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(event), body: '' };
  }

  try {
    requireAuth(event);

    const url = new URL(event.rawUrl || `http://x${event.path}?${event.queryStringParameters || ''}`);
    const window = (url.searchParams.get('window') || '7d').toLowerCase();
    const n = window.endsWith('d') ? parseInt(window, 10) : 7;

    const series = makeSeries(isNaN(n) ? 7 : n);

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify(series),
    };
  } catch (e) {
    return {
      statusCode: e.statusCode || 401,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: e.message || 'unauthorized' }),
    };
  }
};
