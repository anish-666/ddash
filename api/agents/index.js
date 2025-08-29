// Netlify function to list available Bolna agents.  It
// proxies the request to Bolna’s API and normalises
// the response for the frontend.  Authentication is
// enforced via requireAuth().  Environment variables
// must provide BOLNA_API_KEY; optionally BOLNA_BASE
// and BOLNA_API_VERSION override the endpoint.

const { requireAuth } = require('../_lib/auth.js');
const fetch = require('node-fetch');

module.exports.handler = async (event) => {
  try {
    requireAuth(event);
    const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
    const version = process.env.BOLNA_API_VERSION || '';
    const endpoint = version ? `${base}/${version}/agent/all` : `${base}/agent/all`;
    const key = process.env.BOLNA_API_KEY;
    if (!key) {
      throw { statusCode: 500, message: 'BOLNA_API_KEY not configured' };
    }
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${key}` }
    });
    const data = await res.json();
    const items = Array.isArray(data)
      ? data.map(a => ({
          id: `agent_${a.id || a.agent_id || a.provider_agent_id || a.uuid || a.agent_name}`,
          tenant_id: 't_docvai',
          name: a.agent_name || a.name || a.id,
          provider_agent_id: a.id || a.agent_id || a.provider_agent_id,
          active: true
        }))
      : [];
    return { statusCode: 200, body: JSON.stringify(items) };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};