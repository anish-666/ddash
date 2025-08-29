// api/login.js (CJS)
const COOKIE_NAME = 'docvai_auth';
const SECRET = process.env.JWT_SECRET || 'supersecret';
const DISABLE = process.env.DISABLE_AUTH === '1';

function corsHeaders(event) {
  const incomingOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '*';
  const siteOrigin = process.env.PUBLIC_SITE_URL || incomingOrigin;
  return {
    'Access-Control-Allow-Origin': siteOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };
}

function json(event, statusCode, body, extra = {}) {
  return { statusCode, headers: { ...corsHeaders(event), ...extra }, body: JSON.stringify(body ?? null) };
}

function makeCookie(value, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const sameSite = 'Lax';
  const secure = 'Secure';
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; ${secure}; SameSite=${sameSite}`;
}

function parseDemoUsers() {
  const raw = process.env.DEMO_USERS || '[]';
  const arr = JSON.parse(raw); // throws with helpful 400 earlier we added
  return Array.isArray(arr) ? arr : [];
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };
  if (method === 'GET') return json(event, 200, { ok: true, message: 'login endpoint ready' });
  if (method !== 'POST') return json(event, 405, { error: 'method_not_allowed' });

  try {
    const { email, password } = JSON.parse(event.body || '{}');
    const emailNorm = (email || '').trim().toLowerCase();
    const passNorm = (password || '').trim();
    if (!emailNorm || !passNorm) return json(event, 400, { error: 'missing_credentials' });

    if (DISABLE) {
      const user = { email: emailNorm, name: 'Bypass User' };
      return {
        statusCode: 200,
        headers: { ...corsHeaders(event), 'Set-Cookie': makeCookie(`${user.email}|${SECRET}`) },
        body: JSON.stringify(user)
      };
    }

    const demos = parseDemoUsers();
    const found = demos.find(u => (u.email || '').trim().toLowerCase() === emailNorm && String(u.password || '') === passNorm);
    if (!found) return json(event, 401, { error: 'invalid_credentials' });

    const user = { email: found.email, name: found.name || 'Demo User' };
    return {
      statusCode: 200,
      headers: { ...corsHeaders(event), 'Set-Cookie': makeCookie(`${user.email}|${SECRET}`) },
      body: JSON.stringify(user)
    };
  } catch (e) {
    const status = e.statusCode || 500;
    const body = { error: e.message || 'login_failed' };
    if (e.hint) body.hint = e.hint;
    return json(event, status, body);
  }
};
