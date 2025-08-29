// api/provider-import.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query, ensureSchema } = require('./_lib/db.js');

async function tryJson(url, headers) {
  const r = await fetch(url, { headers });
  const t = await r.text().catch(()=> '');
  let j = null; try { j = t ? JSON.parse(t) : null } catch {}
  return { ok: r.ok, status: r.status, body: j ?? t, url };
}
const first = (...vals) => { for (const v of vals) if (v !== undefined && v !== null && v !== '') return v; };
const toInt  = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

async function upsertFromExecution(execBody) {
  const b  = execBody || {};
  const td = b.telephony_data || {};
  const provider_call_id = first(td.provider_call_id, b.provider_call_id);
  if (!provider_call_id) {
    return { upserted: false, reason: 'missing_provider_call_id' };
  }
  const recording_url   = first(td.recording_url, b.recording_url) || null;
  const duration_sec    = toInt(first(td.duration, b.duration_sec, b.conversation_duration));
  const status          = first(b.status, b.smart_status, b.state, b.event) || null;
  const to_number       = first(td.to_number, b.to_number, b.context_details?.recipient_phone_number) || null;
  const from_number     = first(td.from_number, b.from_number) || null;
  const transcript_url  = first(b.transcript_url, b.data?.transcript_url) || null;
  const transcript_text = first(b.transcript, b.data?.transcript) || null;
  const started_at      = first(b.started_at, b.created_at) || null;
  const ended_at        = first(b.ended_at, b.updated_at) || null;

  await query(
    `INSERT INTO docvai_calls
       (provider_call_id, agent_id, to_number, from_number, status, duration_sec,
        recording_url, transcript_url, transcript_text, started_at, ended_at, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (provider_call_id) DO UPDATE SET
       agent_id       = COALESCE(EXCLUDED.agent_id, docvai_calls.agent_id),
       to_number      = COALESCE(EXCLUDED.to_number, docvai_calls.to_number),
       from_number    = COALESCE(EXCLUDED.from_number, docvai_calls.from_number),
       status         = COALESCE(EXCLUDED.status, docvai_calls.status),
       duration_sec   = COALESCE(EXCLUDED.duration_sec, docvai_calls.duration_sec),
       recording_url  = COALESCE(EXCLUDED.recording_url, docvai_calls.recording_url),
       transcript_url = COALESCE(EXCLUDED.transcript_url, docvai_calls.transcript_url),
       transcript_text= COALESCE(EXCLUDED.transcript_text, docvai_calls.transcript_text),
       started_at     = COALESCE(EXCLUDED.started_at, docvai_calls.started_at),
       ended_at       = COALESCE(EXCLUDED.ended_at, docvai_calls.ended_at),
       payload        = EXCLUDED.payload`,
    [
      provider_call_id,
      b.agent_id || null,
      to_number,
      from_number,
      status,
      duration_sec,
      recording_url,
      transcript_url,
      transcript_text,
      started_at ? new Date(started_at) : null,
      ended_at ? new Date(ended_at) : null,
      b
    ]
  );
  return { upserted: true, provider_call_id };
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };
  if (method !== 'POST')   return { statusCode: 405, headers: corsHeaders(event), body: JSON.stringify({ error: 'method_not_allowed' }) };

  try {
    requireAuth(event);
    await ensureSchema();

    const { ids } = JSON.parse(event.body || '{}');
    const list = Array.isArray(ids) ? ids.map(s => String(s).trim()).filter(Boolean) : [];
    if (list.length === 0) return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'no_ids' }) };

    const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const key  = process.env.BOLNA_API_KEY;
    const headers = { Authorization: `Bearer ${key}` };

    const results = [];
    for (const id of list) {
      // fetch the execution detail
      const candidates = [
        `${base}/executions/${id}`,
        `${base}/v2/executions/${id}`,
        `${base}/call/${id}`
      ];
      let got = null;
      for (const u of candidates) {
        const r = await tryJson(u, headers);
        if (r.ok && r.body && typeof r.body === 'object') { got = r; break; }
      }
      if (!got) { results.push({ id, ok: false, reason: 'not_found' }); continue; }

      try {
        const res = await upsertFromExecution(got.body);
        results.push({ id, ok: true, ...res });
      } catch (e) {
        results.push({ id, ok: false, reason: e.message || 'upsert_failed' });
      }
    }

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true, imported: results }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'import_failed' }) };
  }
};
