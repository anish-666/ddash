// api/provider-sync.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query, ensureSchema } = require('./_lib/db.js');

async function tryJson(url, headers) {
  const r = await fetch(url, { headers });
  const t = await r.text().catch(()=>'');
  let j = null; try { j = t ? JSON.parse(t) : null } catch {}
  return { ok: r.ok, status: r.status, body: j ?? t, url };
}

function first(...vals){ for(const v of vals){ if(v!==undefined && v!==null && v!=='') return v } }

function toInt(v){ const n = parseInt(v,10); return Number.isFinite(n) ? n : null; }

function normalize(item) {
  // Accept both “execution” and “call log” shapes
  const id = first(item.id, item.execution_id, item.call_id, item.telephony_data?.provider_call_id);
  const td = item.telephony_data || {};
  return {
    provider_call_id: id || null,
    agent_id: first(item.agent_id, item.agent?.id) || null,
    to_number: first(td.to_number, item.to_number, item.recipient_phone_number) || null,
    from_number: first(td.from_number, item.from_number) || null,
    status: first(item.status, item.state, item.smart_status) || null,
    duration_sec: toInt(first(td.duration, item.duration, item.duration_sec)),
    recording_url: first(td.recording_url, item.recording_url) || null,
    transcript_url: first(item.transcript_url, item.data?.transcript_url) || null,
    transcript_text: first(item.transcript, item.data?.transcript) || null,
    started_at: first(item.started_at, item.created_at) || null,
    ended_at: first(item.ended_at, item.updated_at) || null,
    payload: item
  };
}

async function upsertCall(row) {
  // Upsert on provider_call_id (could be null; skip in that case)
  if (!row.provider_call_id) return;

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
       payload        = EXCLUDED.payload`
    ,
    [
      row.provider_call_id, row.agent_id, row.to_number, row.from_number, row.status,
      row.duration_sec, row.recording_url, row.transcript_url, row.transcript_text,
      row.started_at ? new Date(row.started_at) : null,
      row.ended_at ? new Date(row.ended_at) : null,
      row.payload
    ]
  );
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };

  try {
    requireAuth(event);
    await ensureSchema();

    const qs = event.queryStringParameters || {};
    // default: last 2 hours
    const minutes = parseInt(qs.minutes || '120', 10);
    const since = new Date(Date.now() - (isNaN(minutes) ? 120 : minutes) * 60 * 1000).toISOString();

    const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const key  = process.env.BOLNA_API_KEY;
    const headers = { Authorization: `Bearer ${key}` };

    // Try a few candidates for "list recent executions/calls"
    const candidates = [
      `${base}/executions?since=${encodeURIComponent(since)}&limit=100`,
      `${base}/v2/executions?since=${encodeURIComponent(since)}&limit=100`,
      `${base}/call/logs?since=${encodeURIComponent(since)}&limit=100`
    ];

    let got = null;
    let urlUsed = null;
    for (const u of candidates) {
      const r = await tryJson(u, headers);
      if (r.ok && r.body) {
        const body = r.body;
        const list = Array.isArray(body) ? body
                  : Array.isArray(body.items) ? body.items
                  : Array.isArray(body.data) ? body.data
                  : null;
        if (list && list.length) { got = list; urlUsed = r.url; break; }
        // If 200 but empty array, still accept it
        if (list && list.length === 0) { got = []; urlUsed = r.url; break; }
      }
    }

    if (!got) {
      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({ ok: true, synced: 0, source: urlUsed, note: 'no list endpoint returned data' })
      };
    }

    let synced = 0;
    for (const item of got) {
      const row = normalize(item);
      try {
        await upsertCall(row);
        synced++;
      } catch (e) {
        // ignore individual failures, continue
      }
    }

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true, synced, source: urlUsed }) };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'sync_failed' }) };
  }
};
