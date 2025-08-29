// api/provider-poll.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query } = require('./_lib/db.js');

async function tryJson(url, headers) {
  const r = await fetch(url, { headers });
  const t = await r.text().catch(()=>'');
  let j = null; try { j = t ? JSON.parse(t) : null } catch {}
  return { ok: r.ok, status: r.status, body: j || t };
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

    // Try a few common shapes
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

    if (!resp || !resp.ok) {
      return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ id, found: false, probe_status: resp?.status, body: resp?.body }) };
    }

    const b = resp.body || {};
    const recording_url  = first(b.recording_url,  b.call?.recording_url,  b.data?.recording_url);
    const transcript_url = first(b.transcript_url, b.call?.transcript_url, b.data?.transcript_url);
    const status         = first(b.status, b.state, b.event, b.call?.status, b.data?.status);
    const duration       = first(b.duration_sec, b.duration, b.call?.duration);

    // Update our row if we have anything meaningful
    await query(
      `UPDATE docvai_calls
         SET status = COALESCE($2, status),
             duration_sec = COALESCE($3, duration_sec),
             recording_url = COALESCE($4, recording_url),
             transcript_url = COALESCE($5, transcript_url),
             payload = $6
       WHERE provider_call_id = $1`,
      [id, status || null, Number.isFinite(parseInt(duration)) ? parseInt(duration) : null, recording_url || null, transcript_url || null, b]
    );

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ id, found: true, status, duration, recording_url, transcript_url }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'poll_failed' }) };
  }
};
