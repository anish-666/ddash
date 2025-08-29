// api/analytics-summary.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query, ensureSchema } = require('./_lib/db.js');

function daysToInt(win) {
  const m = String(win || '').match(/^(\d+)\s*d$/i);
  return m ? Math.max(1, Math.min(90, parseInt(m[1],10))) : 7;
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };

  try {
    requireAuth(event);
    await ensureSchema();

    const qs = event.queryStringParameters || {};
    const windowDays = daysToInt(qs.window || '7d');
    const fromTs = new Date(Date.now() - windowDays*24*60*60*1000).toISOString();

    // OUTBOUND caller id is optional — if not set, we fall back to telephony_data.call_type only
    const OUTBOUND = process.env.OUTBOUND_CALLER_ID || null;

    // Keep the SQL very defensive: COALESCE for json paths, tolerate nulls
    const sql = `
    WITH base_raw AS (
      SELECT
        id,
        provider_call_id,
        to_number,
        from_number,
        status,
        duration_sec,
        created_at,
        payload
      FROM docvai_calls
      WHERE created_at >= $2::timestamptz
    ),
    base AS (
      SELECT
        id,
        provider_call_id,
        to_number,
        from_number,
        status,
        duration_sec,
        created_at,
        payload,
        CASE
          WHEN $1::text IS NOT NULL AND from_number = $1 THEN 'outbound'
          WHEN $1::text IS NOT NULL AND to_number   = $1 THEN 'inbound'
          WHEN COALESCE(payload->'telephony_data'->>'call_type','') IN ('inbound','outbound')
            THEN payload->'telephony_data'->>'call_type'
          ELSE 'unknown'
        END AS direction
      FROM base_raw
    )
    SELECT
      COUNT(*)                                         AS total_calls,
      COUNT(*) FILTER (WHERE direction='inbound')      AS inbound_calls,
      COUNT(*) FILTER (WHERE direction='outbound')     AS outbound_calls,
      COUNT(*) FILTER (WHERE lower(COALESCE(status,''))='completed') AS completed_calls,
      COALESCE(AVG(duration_sec),0)::int               AS avg_duration_sec,
      COUNT(*) FILTER (WHERE recording_url IS NOT NULL) AS with_recordings,
      COUNT(*) FILTER (WHERE (payload->>'transcript_text') IS NOT NULL
                        OR (payload->>'transcript_url') IS NOT NULL) AS with_transcripts
    FROM (
      SELECT
        provider_call_id,
        to_number,
        from_number,
        status,
        duration_sec,
        direction,
        created_at,
        payload,
        -- recording_url is also a column; prefer column, fallback to JSON path if column was empty
        COALESCE(recording_url, payload->>'recording_url',
                 payload->'telephony_data'->>'recording_url') AS recording_url
      FROM base
    ) z
    ;
    `;

    const { rows } = await query(sql, [OUTBOUND, fromTs]);
    const s = rows[0] || {};

    const body = {
      windowDays,
      totals: {
        total: Number(s.total_calls || 0),
        inbound: Number(s.inbound_calls || 0),
        outbound: Number(s.outbound_calls || 0),
        completed: Number(s.completed_calls || 0),
        avgDurationSec: Number(s.avg_duration_sec || 0),
        recordings: Number(s.with_recordings || 0),
        transcripts: Number(s.with_transcripts || 0)
      }
    };

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(body) };
  } catch (e) {
    // Surface the error so you can see it in DevTools Network response
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'analytics_summary_failed', detail: e.message })
    };
  }
};
