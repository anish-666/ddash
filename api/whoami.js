// api/whoami.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth');

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };

  try {
    const user = requireAuth(event); // respects DISABLE_AUTH=1 bypass
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({ ok: true, user })
    };
  } catch (e) {
    return {
      statusCode: 401,
      headers: corsHeaders(event),
      body: JSON.stringify({ ok: false, error: 'unauthorized' })
    };
  }
};
