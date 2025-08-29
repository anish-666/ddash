// api/login.js
const { corsHeaders } = require('./_lib/auth');

function parseDemoUsers() {
  try {
    const raw = process.env.DEMO_USERS || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function makeCookie(value) {
  // Host-only cookie (no Domain=) so it sticks to your Netlify site host
  const attrs = [
    'HttpOnly',
    'Path=/',
    'SameSite=None', // allows iframes/cross-site; safe on Netlify (HTTPS)
    'Secure',        // required by SameSite=None
    'Max-Age=2592000' // 30 days
  ];
  return `docvai_sess=${encodeURIComponent(value)}; ${attrs.join('; ')}`;
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };
  if (method !== 'POST')   return { statusCode: 405, headers: corsHeaders(event), body: JSON.stringify({ error: 'method_not_allowed' }) };

  try {
    const bypass = process.env.DISABLE_AUTH === '1';
    const { email, password } = JSON.parse(event.body || '{}');
    const demo = parseDemoUsers();
    const ok = bypass || demo.some(u => u.email === email && u.password === password);
    if (!ok) return { statusCode: 401, headers: corsHeaders(event), body: JSON.stringify({ error: 'invalid_credentials' }) };

    const sess = Buffer.from(JSON.stringify({ email, name: email.split('@')[0] })).toString('base64');

    return {
      statusCode: 200,
      headers: { ...corsHeaders(event), 'Set-Cookie': makeCookie(sess), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, user: { email } })
    };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(event), body: JSON.stringify({ error: 'login_failed', detail: e.message }) };
  }
};
