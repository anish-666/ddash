// api/analytics-timeseries.js (CJS)
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

    const OUTBOUND = process.env.OUTBOUND_CALLER_ID || null;

    const sql = `
    WITH base_raw AS (
      SELECT created_at, status, duration_sec, to_number, from_number, payload
      FROM docvai_calls
      WHERE created_at >= $2::timestamptz
    ),
    base AS (
      SELECT
        date_trunc('day', created_at)::date AS d,
        lower(COALESCE(status,'')) AS status_lc,
        duration_sec,
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
      d::text AS day,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE direction='inbound')  AS inbound,
      COUNT(*) FILTER (WHERE direction='outbound') AS outbound,
      COUNT(*) FILTER (WHERE status_lc='completed') AS completed,
      COALESCE(AVG(duration_sec),0)::int AS avg_duration_sec
    FROM base
    GROUP BY d
    ORDER BY d ASC;
    `;

    const { rows } = await query(sql, [OUTBOUND, fromTs]);

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({
        windowDays,
        labels: rows.map(r => r.day),
        total: rows.map(r => Number(r.total||0)),
        inbound: rows.map(r => Number(r.inbound||0)),
        outbound: rows.map(r => Number(r.outbound||0)),
        completed: rows.map(r => Number(r.completed||0)),
        avgDuration: rows.map(r => Number(r.avg_duration_sec||0))
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'analytics_timeseries_failed', detail: e.message })
    };
  }
};
