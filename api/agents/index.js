const { requireAuth, corsHeaders } = require('../_lib/auth.js');
const fetch = require('node-fetch');


module.exports.handler = async (event) => {
const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';
if (method === 'OPTIONS') {
return { statusCode: 200, headers: corsHeaders(event), body: '' };
}
try {
requireAuth(event);
const base = process.env.BOLNA_BASE || 'https://api.bolna.ai';
const key = process.env.BOLNA_API_KEY;
const r = await fetch(`${base}/v2/agent/all`, { headers: { Authorization: `Bearer ${key}` } });
const agents = await r.json();
const items = Array.isArray(agents)
? agents.map((a) => ({
id: `agent_${a.id || a.agent_id || a.provider_agent_id || a.uuid || a.agent_name}`,
tenant_id: 't_demo',
name: a.agent_name || a.name || a.id,
provider_agent_id: a.id || a.agent_id || a.provider_agent_id,
active: true,
}))
: [];
return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(items) };
} catch (e) {
const status = e.statusCode || 500;
return { statusCode: status, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'failed' }) };
}
};
