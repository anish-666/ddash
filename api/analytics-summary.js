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
    const OUTBOUND = process.env.OUTBOUND_CALLER_ID || process.env.BOLNA_FROM_NUMBER || null;

    const sql = `
    WITH base AS (
      SELECT
        id,
        provider_call_id,
        to_number,
        from_number,
        status,
        duration_sec,
        created_at,
        payload,
        -- Try to infer direction
        CASE
          WHEN $1::text IS NOT NULL AND from_number = $1 THEN 'outbound'
          WHEN $1::text IS NOT NULL AND to_number   = $1 THEN 'inbound'
          WHEN (payload->'telephony_data'->>'call_type') IN ('inbound','outbound') THEN payload->'telephony_data'->>'call_type'
          ELSE 'unknown'
        END AS direction
      FROM docvai_calls
      WHERE created_at >= $2::timestamptz
    )
    SELECT
      (SELECT COUNT(*) FROM base) AS total_calls,
      (SELECT COUNT(*) FROM base WHERE direction='inbound')  AS inbound_calls,
      (SELECT COUNT(*) FROM base WHERE direction='outbound') AS outbound_calls,
      (SELECT COUNT(*) FROM base WHERE lower(status)='completed') AS completed_calls,
      (SELECT COALESCE(AVG(duration_sec),0)::int FROM base WHERE duration_sec IS NOT NULL) AS avg_duration_sec,
      (SELECT COUNT(*) FROM base WHERE recording_url IS NOT NULL) AS with_recordings,
      (SELECT COUNT(*) FROM base WHERE transcript_text IS NOT NULL OR transcript_url IS NOT NULL) AS with_transcripts
    ;
    `;

    const { rows } = await query(sql, [OUTBOUND, fromTs]);
    const s = rows[0] || {};
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        windowDays,
        totals: {
          total: Number(s.total_calls||0),
          inbound: Number(s.inbound_calls||0),
          outbound: Number(s.outbound_calls||0),
          completed: Number(s.completed_calls||0),
          avgDurationSec: Number(s.avg_duration_sec||0),
          recordings: Number(s.with_recordings||0),
          transcripts: Number(s.with_transcripts||0)
        }
      })
    };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};
