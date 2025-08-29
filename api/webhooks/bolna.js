// api/webhooks/bolna.js
const { corsHeaders } = require('../_lib/auth.js'); // re-use same CORS helper
const { query } = require('../_lib/db.js');

function pick(obj, keys) {
  const out = {};
  keys.forEach(k => { if (obj && obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

function firstNonNull(...vals) {
  for (const v of vals) { if (v !== undefined && v !== null && v !== '') return v; }
  return undefined;
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'POST';
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(event), body: '' };
  }
  if (method !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(event), body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    // Try hard to normalize likely fields from Bolna (names may vary)
    const provider_call_id = firstNonNull(
      body.id, body.call_id, body.execution_id, body.call?.id, body.data?.id
    );

    const agent_id = firstNonNull(
      body.agent_id, body.agent?.id, body.data?.agent_id
    );

    const to_number = firstNonNull(
      body.recipient_phone_number, body.to, body.call?.to, body.data?.recipient_phone_number
    );

    const from_number = firstNonNull(
      body.from_phone_number, body.from, body.call?.from, body.data?.from_phone_number, process.env.OUTBOUND_CALLER_ID
    );

    const status = firstNonNull(
      body.status, body.event, body.state, body.data?.status
    );

    const duration_sec = (() => {
      const d = firstNonNull(body.duration_sec, body.duration, body.call?.duration);
      const n = parseInt(d, 10);
      return Number.isFinite(n) ? n : null;
    })();

    const recording_url = firstNonNull(
      body.recording_url, body.call?.recording_url, body.data?.recording_url
    );

    const transcript_url = firstNonNull(
      body.transcript_url, body.call?.transcript_url, body.data?.transcript_url
    );

    const started_at = firstNonNull(
      body.started_at, body.call?.started_at, body.data?.started_at
    );
    const ended_at = firstNonNull(
      body.ended_at, body.call?.ended_at, body.data?.ended_at
    );

    await query(
      `INSERT INTO docvai_calls
       (provider_call_id, agent_id, to_number, from_number, status, duration_sec, recording_url, transcript_url, started_at, ended_at, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        provider_call_id || null,
        agent_id || null,
        to_number || null,
        from_number || null,
        status || null,
        duration_sec,
        recording_url || null,
        transcript_url || null,
        started_at ? new Date(started_at) : null,
        ended_at ? new Date(ended_at) : null,
        body
      ]
    );

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'webhook_failed' }) };
  }
};
