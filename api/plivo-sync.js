// api/plivo-sync.js (CJS) — On-demand inbound sync from Plivo -> docvai_calls
const { requireAuth, corsHeaders } = require('./_lib/auth');
const { query } = require('./_lib/db');

// Use Node 18+ native fetch
const fetchFn = (...args) => fetch(...args);

// --- helpers ---
function basicAuthHeader(id, token) {
  const b64 = Buffer.from(`${id}:${token}`).toString('base64');
  return { Authorization: `Basic ${b64}` };
}

function dtIsoMinutesAgo(mins) {
  const d = new Date(Date.now() - mins * 60 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function listCalls({ authId, token, sinceIso, limit = 50, offset = 0 }) {
  const base = `https://api.plivo.com/v1/Account/${encodeURIComponent(authId)}`;
  const attempts = [];

  // Candidate #1: filter by end_time__gt (common on Plivo)
  let url = `${base}/Call/?limit=${limit}&offset=${offset}&end_time__gt=${encodeURIComponent(sinceIso)}&direction=inbound`;
  let r = await fetchFn(url, { headers: basicAuthHeader(authId, token) });
  attempts.push({ url, status: r.status });
  if (r.ok) {
    const json = await r.json().catch(() => ({}));
    const arr = Array.isArray(json?.objects) ? json.objects : (Array.isArray(json) ? json : []);
    return { ok: true, items: arr, attempts, nextOffset: arr.length === limit ? offset + limit : null };
  }

  // Candidate #2: fallback to add_time__gt param
  url = `${base}/Call/?limit=${limit}&offset=${offset}&add_time__gt=${encodeURIComponent(sinceIso)}&direction=inbound`;
  r = await fetchFn(url, { headers: basicAuthHeader(authId, token) });
  attempts.push({ url, status: r.status });
  if (r.ok) {
    const json = await r.json().catch(() => ({}));
    const arr = Array.isArray(json?.objects) ? json.objects : (Array.isArray(json) ? json : []);
    return { ok: true, items: arr, attempts, nextOffset: arr.length === limit ? offset + limit : null };
  }

  return { ok: false, items: [], attempts };
}

async function listRecordingsForCall({ authId, token, callUuid }) {
  const base = `https://api.plivo.com/v1/Account/${encodeURIComponent(authId)}`;
  const attempts = [];

  // Candidate #1: per-call recordings
  let url = `${base}/Call/${encodeURIComponent(callUuid)}/Recording/`;
  let r = await fetchFn(url, { headers: basicAuthHeader(authId, token) });
  attempts.push({ url, status: r.status });
  if (r.ok) {
    const json = await r.json().catch(() => ({}));
    const arr = Array.isArray(json?.objects) ? json.objects : (Array.isArray(json) ? json : []);
    return { ok: true, items: arr, attempts };
  }

  // Candidate #2: global recordings list (recent), filter client-side
  const sinceIso = dtIsoMinutesAgo(24 * 60);
  url = `${base}/Recording/?add_time__gt=${encodeURIComponent(sinceIso)}`;
  r = await fetchFn(url, { headers: basicAuthHeader(authId, token) });
  attempts.push({ url, status: r.status });
  if (r.ok) {
    const json = await r.json().catch(() => ({}));
    const arr = Array.isArray(json?.objects) ? json.objects : (Array.isArray(json) ? json : []);
    const filtered = arr.filter(x => (x?.call_uuid || '') === callUuid);
    return { ok: true, items: filtered, attempts };
  }

  return { ok: false, items: [], attempts };
}

function pickFromCall(c) {
  const call_uuid = c?.call_uuid || c?.uuid || c?.call_uuid_v2 || null;
  const to_number = c?.to_number || c?.to || c?.to_formatted || null;
  const from_number = c?.from_number || c?.from || c?.from_formatted || null;
  const direction = c?.direction || null;
  const dur =
    c?.total_duration_sec != null ? parseInt(c.total_duration_sec, 10) :
    c?.total_time != null ? parseInt(c.total_time, 10) :
    c?.call_duration != null ? parseInt(c.call_duration, 10) :
    c?.bill_duration != null ? parseInt(c.bill_duration, 10) :
    null;

  return {
    call_uuid,
    to_number,
    from_number,
    direction,
    duration_sec: Number.isFinite(dur) ? dur : null
  };
}

function pickFromRecording(rec) {
  return {
    recording_url: rec?.recording_url || rec?.url || null,
    recording_duration_sec:
      rec?.recording_duration_ms != null ? Math.round(Number(rec.recording_duration_ms) / 1000) :
      (rec?.recording_duration != null ? parseInt(rec.recording_duration, 10) : null)
  };
}

// --- handler ---
module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(event), body: '' };
  }
  if (method !== 'POST' && method !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(event), body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  try {
    // allow DISABLE_AUTH=1 or admin header via requireAuth
    requireAuth(event);

    const authId = process.env.PLIVO_AUTH_ID;
    const token = process.env.PLIVO_AUTH_TOKEN;
    if (!authId || !token) {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'missing_plivo_env' }) };
    }

    const qs = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    const lookbackMin = parseInt(qs.lookback_min || body.lookback_min || process.env.PLIVO_SYNC_LOOKBACK_MIN || '240', 10);
    const limit = parseInt(process.env.PLIVO_SYNC_PAGE_LIMIT || '50', 10);

    const sinceIso = dtIsoMinutesAgo(lookbackMin);
    let synced = 0;
    const debug = { sinceIso, pages: [], recordings_attempts: [] };

    // page through recent calls
    let offset = 0;
    for (let page = 0; page < 10; page++) {
      const list = await listCalls({ authId, token, sinceIso, limit, offset });
      debug.pages.push({ offset, attempts: list.attempts, count: list.items.length });

      if (!list.ok || !list.items.length) break;

      for (const c of list.items) {
        const norm = pickFromCall(c);
        if (!norm.call_uuid) continue;

        // only inbound
        if (norm.direction && !/inbound/i.test(norm.direction)) continue;

        // recordings
        const recs = await listRecordingsForCall({ authId, token, callUuid: norm.call_uuid });
        debug.recordings_attempts.push({ call_uuid: norm.call_uuid, attempts: recs.attempts, count: recs.items.length });

        let bestRec = null;
        if (Array.isArray(recs.items) && recs.items.length) {
          bestRec = recs.items.sort((a, b) => {
            const ta = new Date(a?.add_time || a?.created_at || 0).getTime();
            const tb = new Date(b?.add_time || b?.created_at || 0).getTime();
            return tb - ta;
          })[0];
        }
        const recInfo = bestRec ? pickFromRecording(bestRec) : { recording_url: null, recording_duration_sec: null };

        await query(`
          INSERT INTO docvai_calls
            (provider_call_id, to_number, from_number, status, duration_sec, recording_url, transcript_text, payload, created_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, NULL, $7::jsonb, NOW())
          ON CONFLICT (provider_call_id) DO UPDATE SET
            to_number     = COALESCE(EXCLUDED.to_number,     docvai_calls.to_number),
            from_number   = COALESCE(EXCLUDED.from_number,   docvai_calls.from_number),
            status        = COALESCE(EXCLUDED.status,        docvai_calls.status),
            duration_sec  = COALESCE(EXCLUDED.duration_sec,  docvai_calls.duration_sec),
            recording_url = COALESCE(EXCLUDED.recording_url, docvai_calls.recording_url),
            payload       = EXCLUDED.payload
        `, [
          norm.call_uuid,
          norm.to_number,
          norm.from_number,
          'completed',
          norm.duration_sec || recInfo.recording_duration_sec || null,
          recInfo.recording_url,
          JSON.stringify({ plivo_cdr: c, plivo_recording: bestRec || null })
        ]);

        synced++;
      }

      if (list.nextOffset == null) break;
      offset = list.nextOffset;
    }

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({ ok: true, synced, sinceIso, debug })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'plivo_sync_failed', detail: e.message })
    };
  }
};
