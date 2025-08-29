// api/calls-outbound.js (CJS)
const { requireAuth } = require('./_lib/auth');
const { query } = require('./_lib/db');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  try {
    // auth (allow DISABLE_AUTH=1 bypass if you’ve set it)
    requireAuth(event);

    const body = JSON.parse(event.body || '{}');
    const numbers = Array.isArray(body.numbers) ? body.numbers.map(String).filter(Boolean) : [];
    const agentId = (body.agentId || '').trim();

    if (!numbers.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'numbers_required' }) };
    }

    const BOLNA_BASE = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
    const FALLBACK_AGENT = process.env.BOLNA_AGENT_ID;
    const AGENT = agentId || FALLBACK_AGENT;

    const OUTBOUND_CALLER_ID = process.env.OUTBOUND_CALLER_ID || null;
    const webhook_url = process.env.BOLNA_WEBHOOK_URL || null;

    // limit parallelism to keep within function time limits
    const maxConcurrent = 3;
    let idx = 0;
    const created = [];
    const provider = [];

    async function startOne(num) {
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

      // Bolna returns an execution id here (data.id). Save it immediately so Refresh works.
      const execId = data?.id || data?.call_id || null;

      if (ok && execId) {
        // Upsert a seed row keyed by the execution id
        await query(`
          INSERT INTO docvai_calls
            (provider_call_id, to_number, from_number, status, duration_sec, recording_url, transcript_text, payload, created_at)
          VALUES
            ($1, $2, $3, 'queued', NULL, NULL, NULL, $4::jsonb, NOW())
          ON CONFLICT (provider_call_id) DO NOTHING
        `, [
          execId,
          num,
          OUTBOUND_CALLER_ID,
          JSON.stringify({ seed: true, at: new Date().toISOString(), start_payload: payload })
        ]);

        created.push(execId);
      }

      provider.push({ phone: num, ok, status: res.status, id: execId, body: data });
    }

    const queue = [];
    while (idx < numbers.length) {
      const slice = numbers.slice(idx, idx + maxConcurrent);
      queue.push(Promise.all(slice.map(startOne)));
      idx += maxConcurrent;
    }
    await Promise.all(queue);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, created_count: created.length, created, provider })
    };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};
