// api/provider-poll.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query, ensureSchema } = require('./_lib/db.js');

// Normalize fields from a Bolna execution object
function normalizeExecution(exec) {
  const td = exec?.telephony_data || {};
  // Duration sources: telephony_data.duration (string seconds), conversation_duration (int),
  // or transcriber_duration (float seconds) as last resort.
  let dur =
    td.duration != null ? parseInt(td.duration, 10) :
    exec?.conversation_duration != null ? parseInt(exec.conversation_duration, 10) :
    exec?.transcriber_duration != null ? Math.round(Number(exec.transcriber_duration)) :
    null;

  const status =
    exec?.status ||
    exec?.smart_status ||
    null;

  const to_number   = td.to_number   || exec?.to_number   || null;
  const from_number = td.from_number || exec?.from_number || null;

  const recording_url =
    td.recording_url ||
    exec?.recording_url ||
    null;

  const transcript_text =
    exec?.transcript ||
    null;

  const provider_call_id =
    td.provider_call_id ||
    exec?.provider_call_id ||
    exec?.id || // occasionally same as execution id
    null;

  return {
    provider_call_id,
    to_number,
    from_number,
    status,
    duration_sec: Number.isFinite(dur) ? dur : null,
    recording_url,
    transcript_text
  };
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };

  try {
    requireAuth(event);
    await ensureSchema();

    const qs = event.queryStringParameters || {};
    const id = (qs.id || '').trim();
    if (!id) return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'missing_id' }) };

    const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const key  = process.env.BOLNA_API_KEY;

    const r = await fetch(`${base}/executions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    const rawText = await r.text();
    let exec;
    try { exec = rawText ? JSON.parse(rawText) : {}; } catch { exec = { raw: rawText }; }
    if (!r.ok) {
      return { statusCode: r.status, headers: corsHeaders(event), body: JSON.stringify({ error: 'provider_error', detail: exec }) };
    }

    const picked = normalizeExecution(exec);
    // Always use the ID you asked for as the key; fall back to picked.provider_call_id
    const keyId = id || picked.provider_call_id;

    // Upsert logic: only overwrite when the new value is non-null
    await query(`
      INSERT INTO docvai_calls
        (provider_call_id, to_number, from_number, status, duration_sec, recording_url, transcript_text, payload, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      ON CONFLICT (provider_call_id) DO UPDATE SET
        to_number     = COALESCE(EXCLUDED.to_number,     docvai_calls.to_number),
        from_number   = COALESCE(EXCLUDED.from_number,   docvai_calls.from_number),
        status        = COALESCE(EXCLUDED.status,        docvai_calls.status),
        duration_sec  = COALESCE(EXCLUDED.duration_sec,  docvai_calls.duration_sec),
        recording_url = COALESCE(EXCLUDED.recording_url, docvai_calls.recording_url),
        transcript_text = COALESCE(EXCLUDED.transcript_text, docvai_calls.transcript_text),
        payload       = EXCLUDED.payload,
        updated_at    = NOW()
    `, [
      keyId,
      picked.to_number,
      picked.from_number,
      picked.status,
      picked.duration_sec,
      picked.recording_url,
      picked.transcript_text,
      JSON.stringify(exec)
    ]);

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        ok: true,
        id: keyId,
        extracted: {
          status: picked.status,
          duration_sec: picked.duration_sec,
          recording_url: picked.recording_url
        },
        probe_status: r.status,
        probe_url: `${base}/executions/${id}`
      })
    };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: 'poll_failed', detail: e.message }) };
  }
};
