// api/provider-poll.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query, ensureSchema } = require('./_lib/db.js');

function normalizeExecution(exec) {
  const td = exec?.telephony_data || {};
  let dur =
    td.duration != null ? parseInt(td.duration, 10) :
    exec?.conversation_duration != null ? Math.round(Number(exec.conversation_duration)) :
    exec?.transcriber_duration != null ? Math.round(Number(exec.transcriber_duration)) :
    null;

  const status = exec?.status || exec?.smart_status || null;
  const to_number   = td.to_number   || exec?.to_number   || null;
  const from_number = td.from_number || exec?.from_number || null;
  const recording_url  = td.recording_url || exec?.recording_url || null;
  const transcript_text = exec?.transcript || null;
  const provider_call_id = td.provider_call_id || exec?.provider_call_id || exec?.id || null;

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

async function fetchExec(base, key, id) {
  const r = await fetch(`${base}/executions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: r.ok, status: r.status, data: json };
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

    const base = (process.env.BOLNA_BASE || 'https://api.bolna.ai').replace(/\/+$/,'');
    const key  = process.env.BOLNA_API_KEY;

    // 1st attempt
    let attempt = await fetchExec(base, key, id);
    const attempted = [{ id, status: attempt.status }];

    // If 404, try to discover a real execution id from our payload and retry once
    if (!attempt.ok && attempt.status === 404) {
      const { rows } = await query(`SELECT payload FROM docvai_calls WHERE provider_call_id = $1 LIMIT 1`, [id]);
      if (rows.length) {
        const p = rows[0].payload || {};
        const alt =
          p?.provider_start?.id ||
          p?.provider_start?.call_id ||
          p?.telephony_data?.provider_call_id ||
          null;
        if (alt && alt !== id) {
          attempt = await fetchExec(base, key, alt);
          attempted.push({ id: alt, status: attempt.status });
        }
      }
    }

    if (!attempt.ok) {
      return {
        statusCode: attempt.status || 502,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'provider_error', detail: attempt.data, attempted })
      };
    }

    const picked = normalizeExecution(attempt.data);

    await query(`
      INSERT INTO docvai_calls
        (provider_call_id, to_number, from_number, status, duration_sec, recording_url, transcript_text, payload, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
      ON CONFLICT (provider_call_id) DO UPDATE SET
        to_number       = COALESCE(EXCLUDED.to_number,       docvai_calls.to_number),
        from_number     = COALESCE(EXCLUDED.from_number,     docvai_calls.from_number),
        status          = COALESCE(EXCLUDED.status,          docvai_calls.status),
        duration_sec    = COALESCE(EXCLUDED.duration_sec,    docvai_calls.duration_sec),
        recording_url   = COALESCE(EXCLUDED.recording_url,   docvai_calls.recording_url),
        transcript_text = COALESCE(EXCLUDED.transcript_text, docvai_calls.transcript_text),
        payload         = EXCLUDED.payload
    `, [
      id, // keep the original id as the row key you refreshed
      picked.to_number,
      picked.from_number,
      picked.status,
      picked.duration_sec,
      picked.recording_url,
      picked.transcript_text,
      JSON.stringify(attempt.data)
    ]);

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        ok: true,
        id,
        extracted: {
          status: picked.status,
          duration_sec: picked.duration_sec,
          recording_url: picked.recording_url
        },
        attempted
      })
    };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: 'poll_failed', detail: e.message }) };
  }
};
