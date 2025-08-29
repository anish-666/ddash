// api/conversations.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query } = require('./_lib/db.js');

module.exports.handler = async (event) => {
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(event), body: '' };
  }
  try {
    requireAuth(event);

    const res = await query(
      `SELECT id, provider_call_id, agent_id, to_number, from_number, status, duration_sec,
              recording_url, transcript_url, started_at, ended_at, created_at
       FROM docvai_calls
       ORDER BY created_at DESC
       LIMIT 200`
    );

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(res.rows || []) };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};
