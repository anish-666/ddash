// Netlify function to initiate outbound calls via Bolna.  It
// accepts a POST body with a list of phone numbers and an
// optional agentId.  Numbers are fanned out to Bolna’s
// /call endpoint with limited concurrency to stay within
// Netlify timeouts.  Authentication is enforced via
// requireAuth().

const { requireAuth } = require('./_lib/auth.js');
const fetch = require('node-fetch');

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }
  try {
    requireAuth(event);
    const body = JSON.parse(event.body || '{}');
    const numbers = Array.isArray(body.numbers) ? body.numbers.map(String) : [];
    const agentId = (body.agentId || '').trim();
    if (numbers.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'numbers_required' }) };
    }
    const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const version = process.env.BOLNA_API_VERSION || '';
    const endpoint = version ? `${base}/${version}/call` : `${base}/call`;
    const apiKey = process.env.BOLNA_API_KEY;
    if (!apiKey) {
      throw { statusCode: 500, message: 'BOLNA_API_KEY not configured' };
    }
    const fallbackAgent = process.env.BOLNA_AGENT_ID;
    const chosenAgent = agentId || fallbackAgent;
    const webhook_url = process.env.BOLNA_WEBHOOK_URL || '';

    // Constrain concurrency to avoid hitting Netlify’s 10 second limit.
    const maxConcurrent = 3;
    let idx = 0;
    const created = [];
    const provider = [];

    async function one(num) {
      const payload = { agent_id: chosenAgent, recipient_phone_number: num };
      if (webhook_url) payload.webhook_url = webhook_url;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      let data = null;
      try {
        data = await res.json();
      } catch {}
      const ok = res.ok;
      const id = data?.execution_id || data?.id || data?.call_id || null;
      if (id) created.push(id);
      provider.push({ phone: num, ok, status: res.status, id, body: data });
    }

    const tasks = [];
    while (idx < numbers.length) {
      const slice = numbers.slice(idx, idx + maxConcurrent);
      tasks.push(Promise.all(slice.map(one)));
      idx += maxConcurrent;
    }
    await Promise.all(tasks);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, created_count: created.filter(Boolean).length, created, provider })
    };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};