// api/calls-outbound.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');
const { query } = require('./_lib/db.js');

module.exports.handler = async (event) => {
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };
  if (method !== 'POST') return { statusCode: 405, headers: corsHeaders(event), body: JSON.stringify({ error: 'method_not_allowed' }) };

  try {
    const user = requireAuth(event);

    const body = JSON.parse(event.body || '{}');
    const numbers = Array.isArray(body.numbers) ? body.numbers.map(String) : [];
    const agentId = (body.agentId || '').trim();
    const fromNumberOverride = (body.fromNumber || '').trim();
    if (numbers.length === 0) return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'numbers_required' }) };

    const BOLNA_BASE = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
    const FALLBACK_AGENT = process.env.BOLNA_AGENT_ID;
    const WEBHOOK_URL = process.env.BOLNA_WEBHOOK_URL || undefined;
    const FROM_NUMBER = fromNumberOverride || process.env.OUTBOUND_CALLER_ID || process.env.BOLNA_FROM_NUMBER || undefined;

    if (!BOLNA_API_KEY) return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: 'missing_BOLNA_API_KEY' }) };
    const AGENT = agentId || FALLBACK_AGENT;
    if (!AGENT) return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'agent_id_required' }) };

    // fan-out with small concurrency
    const maxConcurrent = 3;
    let i = 0;
    const created = [];
    const provider = [];

    async function one(num) {
      const payload = { agent_id: AGENT, recipient_phone_number: num };
      if (FROM_NUMBER) payload.from_phone_number = FROM_NUMBER;
      if (WEBHOOK_URL) payload.webhook_url = WEBHOOK_URL;

      const res = await fetch(`${BOLNA_BASE}/call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${BOLNA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data = null;
      try { data = await res.json(); } catch {}
      const ok = res.ok;
      const callId = data && (data.id || data.call_id || data.execution_id) || null;

      // write a "pending" row so Conversations shows it immediately
      try {
        await query(
          `INSERT INTO docvai_calls
           (provider_call_id, agent_id, to_number, from_number, status, payload)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [callId, AGENT, num, FROM_NUMBER || null, ok ? 'initiated' : `error_${res.status}`, data || null]
        );
      } catch (_) {}

      if (callId) created.push(callId);
      provider.push({ phone: num, ok, status: res.status, id: callId, body: data });
    }

    const batches = [];
    while (i < numbers.length) {
      const slice = numbers.slice(i, i + maxConcurrent);
      batches.push(Promise.all(slice.map(one)));
      i += maxConcurrent;
    }
    await Promise.all(batches);

    return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true, created_count: created.length, created, provider }) };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};
