// api/login.js (CJS)
const COOKIE_NAME = 'docvai_auth';
const SECRET = process.env.JWT_SECRET || 'supersecret';
const DISABLE = process.env.DISABLE_AUTH === '1';

// Allow-list: if you set PUBLIC_SITE_URL, we echo it back for CORS (needed with credentials)
// Otherwise we reflect the incoming Origin for local dev. Adjust as needed for security.
function corsHeaders(event) {
  const incomingOrigin =
    (event.headers && (event.headers.origin || event.headers.Origin)) || '*';
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
  return {
    statusCode,
    headers: { ...corsHeaders(event), ...extra },
    body: JSON.stringify(body ?? null),
  };
}

// Return ONLY the cookie string (no "Set-Cookie," prefix)
function makeCookie(value, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const sameSite = 'Lax';
  const secure = 'Secure'; // Netlify serves HTTPS
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; ${secure}; SameSite=${sameSite}`;
}

function parseDemoUsers() {
  const raw = process.env.DEMO_USERS || '[]';
  try {
    // Must be valid JSON with double quotes
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    // Surface formatting issues clearly
    const msg = `invalid_DEMO_USERS_JSON`;
    const hint = `Ensure DEMO_USERS is valid JSON with double quotes: [{"email":"demo@docvai.com","password":"demo123"}]`;
    const err = new Error(`${msg}: ${e.message}`);
    err.statusCode = 400;
    err.hint = hint;
    throw err;
  }
}

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // 1) OPTIONS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: '',
    };
  }

  // 2) GET health check (avoid console 500s if something GETs this)
  if (method === 'GET') {
    return json(event, 200, { ok: true, message: 'login endpoint ready', method });
  }

  // 3) Only POST performs a login
  if (method !== 'POST') {
    return json(event, 405, { error: 'method_not_allowed' });
  }

  try {
    const { email, password } = JSON.parse(event.body || '{}');

    const emailNorm = (email || '').trim().toLowerCase();
    const passNorm  = (password || '').trim();

    if (!emailNorm || !passNorm) {
      return json(event, 400, { error: 'missing_credentials' });
    }

    if (DISABLE) {
      // Bypass path for setup
      const user = { email: emailNorm, name: 'Bypass User' };
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders(event),
          'Set-Cookie': makeCookie(`${user.email}|${SECRET}`)
        },
        body: JSON.stringify(user),
      };
    }

    // Parse demo users from ENV
    const demos = parseDemoUsers();

    // Case-insensitive email match, exact password match
    const found = demos.find(u =>
      ((u.email || '').trim().toLowerCase() === emailNorm) &&
      (String(u.password || '') === passNorm)
    );

    if (!found) {
      return json(event, 401, {
        error: 'invalid_credentials',
        reason: 'no_demo_user_match',
        hint: 'Check DEMO_USERS JSON, email/password case, whitespace'
      });
    }

    const user = { email: found.email, name: found.name || 'Demo User' };
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(event),
        'Set-Cookie': makeCookie(`${user.email}|${SECRET}`)
      },
      body: JSON.stringify(user),
    };
  } catch (e) {
    const status = e.statusCode || 500;
    const body = { error: e.message || 'login_failed' };
    if (e.hint) body.hint = e.hint;
    return json(event, status, body);
  }
};
