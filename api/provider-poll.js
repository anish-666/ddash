// api/provider-poll.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query, ensureSchema } = require('./_lib/db.js');

async function tryJson(url, headers) {
  const r = await fetch(url, { headers });
  const t = await r.text().catch(()=>'');
  let j = null; try { j = t ? JSON.parse(t) : null } catch {}
  return { ok: r.ok, status: r.status, body: j ?? t, url };
}

function first(...vals){ for(const v of vals){ if(v!==undefined && v!==null && v!=='') return v } }

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
    const headers = { Authorization: `Bearer ${key}` };

    const probes = [
      `${base}/call/${id}`,
      `${base}/v2/call/${id}`,
      `${base}/executions/${id}`
    ];

    let resp = null;
    for (const u of probes) {
      resp = await tryJson(u, headers);
      if (resp.ok) break;
    }

    const result = { id, probe_url: resp?.url, probe_status: resp?.status, raw: resp?.body };

    if (resp && resp.ok && resp.body && typeof resp.body === 'object') {
      const b = resp.body;

      // Map from your sample
      const recording_url  = first(
        b.telephony_data?.recording_url,
        b.recording_url, b.call?.recording_url, b.data?.recording_url
      );

      const durationRaw    = first(
        b.telephony_data?.duration,
        b.duration_sec, b.duration, b.call?.duration
      );
      const duration_sec   = Number.isFinite(parseInt(durationRaw, 10)) ? parseInt(durationRaw, 10) : null;

      const status         = first(
        b.status, b.state, b.event, b.call?.status, b.data?.status
      ) || b.smart_status || null;

      // Transcript may be plain text on top-level
      const transcript_text = first(
        b.transcript, b.data?.transcript, b.call?.transcript
      ) || null;

      await query(
        `UPDATE docvai_calls
           SET status = COALESCE($2, status),
               duration_sec = COALESCE($3, duration_sec),
               recording_url = COALESCE($4, recording_url),
               transcript_url = COALESCE($5, transcript_url),
               transcript_text = COALESCE($6, transcript_text),
               payload = $7
         WHERE provider_call_id = $1`,
        [id, status, duration_sec, recording_url || null, null, transcript_text, b]
      );

      result.extracted = { status, duration_sec, recording_url, transcript_text_present: !!transcript_text };
    }

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'poll_failed' }) };
  }
};
