// api/agents/index.js (CJS)
const { requireAuth, corsHeaders } = require('../_lib/auth.js');

module.exports.handler = async (event) => {
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(event), body: '' };
  }

  try {
    requireAuth(event);

    const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const key = process.env.BOLNA_API_KEY;
    if (!key) {
      return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: 'missing_BOLNA_API_KEY' }) };
    }

    const resp = a
