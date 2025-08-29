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
    const OUTBOUND = process.env.OUTBOUND_CALLER_ID || process.env.BOLNA_FROM_NUMBER || null;

    const sql = `
    WITH base AS (
      SELECT
        date_trunc('day', created_at)::date AS d,
        status,
        duration_sec,
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
      d::text AS day,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE direction='inbound')  AS inbound,
      COUNT(*) FILTER (WHERE direction='outbound') AS outbound,
      COUNT(*) FILTER (WHERE lower(status)='completed') AS completed,
      COALESCE(AVG(duration_sec),0)::int AS avg_duration_sec
    FROM base
    GROUP BY d
    ORDER BY d ASC;
    `;

    const { rows } = await query(sql, [OUTBOUND, fromTs]);

    const labels = rows.map(r => r.day);
    const total = rows.map(r => Number(r.total||0));
    const inbound = rows.map(r => Number(r.inbound||0));
    const outbound = rows.map(r => Number(r.outbound||0));
    const completed = rows.map(r => Number(r.completed||0));
    const avgDuration = rows.map(r => Number(r.avg_duration_sec||0));

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({ windowDays, labels, total, inbound, outbound, completed, avgDuration })
    };
  } catch (e) {
    return { statusCode: e.statusCode || 500, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};
