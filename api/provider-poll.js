// api/provider-poll.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query } = require('./_lib/db.js');

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

    const qs = event.queryStringParameters || {};
    const id = (qs.id || '').trim();
    if (!id) return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'missing_id' }) };

    const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const key  = process.env.BOLNA_API_KEY;
    const headers = { Authorization: `Bearer ${key}` };

    // Probe a few likely endpoints
    const probes = [
      `${base}/call/${id}`,
      `${base}/v2/call/${id}`,
      `${base}/executions/${id}`
    ];

    let resp = null;
    for (const u of probes) {
      resp = await tryJson(u, headers);
      if (resp.ok) break; // stop at first 2xx
    }

    // Always return what we got so the UI can log it
    const result = {
      id,
      probe_url: resp?.url,
      probe_status: resp?.status,
      raw: resp?.body
    };

    // Try to extract known fields and update DB
    if (resp && resp.ok && resp.body && typeof resp.body === 'object') {
      const b = resp.body;
      const recording_url  = first(b.recording_url,  b.call?.recording_url,  b.data?.recording_url);
      const transcript_url = first(b.transcript_url, b.call?.transcript_url, b.data?.transcript_url);
      const status         = first(b.status, b.state, b.event, b.call?.status, b.data?.status);
      const duration       = first(b.duration_sec, b.duration, b.call?.duration);

      await query(
        `UPDATE docvai_calls
           SET status = COALESCE($2, status),
               duration_sec = COALESCE($3, duration_sec),
               recording_url = COALESCE($4, recording_url),
               transcript_url = COALESCE($5, transcript_url),
               payload = $6
         WHERE provider_call_id = $1`,
        [id,
         status || null,
         Number.isFinite(parseInt(duration)) ? parseInt(duration) : null,
         recording_url || null,
         transcript_url || null,
         b]
      );

      result.extracted = { status, duration, recording_url, transcript_url };
    }

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'poll_failed' }) };
  }
};
