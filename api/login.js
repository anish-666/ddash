// api/login.js (CJS)
const COOKIE_NAME = 'docvai_auth';
const SECRET = process.env.JWT_SECRET || 'supersecret';
const DISABLE = process.env.DISABLE_AUTH === '1';

// Simple CORS headers so you can hit the function from the SPA
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.PUBLIC_SITE_URL || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };
}

function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { ...corsHeaders(), ...extra },
    body: JSON.stringify(body ?? null),
  };
}

function setCookieHeader(value, maxAgeSeconds = 60 * 60 * 24 * 7) {
  // super simple cookie; replace with a signed JWT in production
  const sameSite = 'Lax';
  const secure = 'Secure'; // Netlify over HTTPS
  return `Set-Cookie, ${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; ${secure}; SameSite=${sameSite}`;
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // 1) OPTIONS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  // 2) GET health/diagnostic (avoid console 500s if someone GETs this URL)
  if (method === 'GET') {
    return json(200, { ok: true, message: 'login endpoint ready', method });
  }

  // 3) Only POST performs a login
  if (method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  try {
    const { email, password } = JSON.parse(event.body || '{}');

    if (DISABLE) {
      // Auth bypass for setup
      const user = { email: email || 'bypass@docvai.com', name: 'Bypass User' };
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders(),
          // set a very basic cookie just so the SPA can feel logged-in
          'Set-Cookie': setCookieHeader(`${user.email}|${SECRET}`)
        },
        body: JSON.stringify(user),
      };
    }

    // Optional: support DEMO_USERS JSON array
    const raw = process.env.DEMO_USERS || '[]';
    let demos = [];
    try { demos = JSON.parse(raw); } catch {}

    const found = Array.isArray(demos) && demos.find(u => u.email === email && u.password === password);
    if (!found) {
      return json(401, { error: 'invalid_credentials' });
    }

    const user = { email: found.email, name: found.name || 'Demo User' };
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Set-Cookie': setCookieHeader(`${user.email}|${SECRET}`)
      },
      body: JSON.stringify(user),
    };
  } catch (e) {
    return json(500, { error: e.message || 'login_failed' });
  }
};
