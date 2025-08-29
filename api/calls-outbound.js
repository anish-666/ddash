// api/calls-outbound.js (CJS)
const { requireAuth, corsHeaders } = require('./_lib/auth.js');

module.exports.handler = async (event) => {
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(event), body: '' };
  }

  if (method !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(event), body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  try {
    requireAuth(event);

    const body = JSON.parse(event.body || '{}');
    const numbers = Array.isArray(body.numbers) ? body.numbers.map(String) : [];
    const agentId = (body.agentId || '').trim();

    if (numbers.length === 0) {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'numbers_required' }) };
    }

    const BOLNA_BASE = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
    const FALLBACK_AGENT = process.env.BOLNA_AGENT_ID;
    const AGENT = agentId || FALLBACK_AGENT;
    const webhook_url = process.env.BOLNA_WEBHOOK_URL || undefined;

    if (!BOLNA_API_KEY) {
      return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: 'missing_BOLNA_API_KEY' }) };
    }
    if (!AGENT) {
      return { statusCode: 400, headers: corsHeaders(event), body: JSON.stringify({ error: 'agent_id_required' }) };
    }

    // controlled parallelism
    const maxConcurrent = 3;
    let i = 0;
    const created = [];
    const provider = [];

    async function one(num) {
      const payload = { agent_id: AGENT, recipient_phone_number: num };
      if (webhook_url) payload.webhook_url = webhook_url;

      const res = await fetch(`${BOLNA_BASE}/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BOLNA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let data = null;
      try { data = await res.json(); } catch {}
      const ok = res.ok;
      const id = data && (data.id || data.call_id || data.execution_id) || null;

      if (id) created.push(id);
      provider.push({ phone: num, ok, status: res.status, id, body: data });
    }

    const queue = [];
    while (i < numbers.length) {
      const slice = numbers.slice(i, i + maxConcurrent);
      queue.push(Promise.all(slice.map(one)));
      i += maxConcurrent;
    }
    await Promise.all(queue);

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify({ ok: true, created_count: created.length, created, provider })
    };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};
