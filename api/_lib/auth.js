// api/_lib/auth.js (CJS)
function corsHeaders(event) {
  const origin = (event?.headers?.origin || event?.headers?.Origin || '').trim();
  const allowed = process.env.PUBLIC_SITE_URL || origin || '';
  const h = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
  if (allowed) { h['Access-Control-Allow-Origin'] = allowed; h['Vary'] = 'Origin'; }
  return h;
}

function parseCookie(str) {
  const out = {};
  (str || '').split(/;\s*/).forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}

function tryDecodeSess(b64) {
  try {
    const txt = Buffer.from(b64, 'base64').toString('utf8');
    const obj = JSON.parse(txt);
    if (obj && obj.email) return obj;
  } catch {}
  return null;
}

function requireAuth(event) {
  // Bypass for setup
  if (process.env.DISABLE_AUTH === '1') {
    return { email: 'bypass@docvai.com', name: 'Bypass User' };
  }

  const hdrs = event.headers || {};

  // Admin header escape hatch
  const adminKey = hdrs['x-admin-key'] || hdrs['X-Admin-Key'];
  if (adminKey && process.env.JWT_SECRET && adminKey === process.env.JWT_SECRET) {
    return { email: 'admin@docvai.com', name: 'Admin Header' };
  }

  // Cookies (support both new and legacy)
  const cookies = parseCookie(hdrs.cookie || hdrs.Cookie || '');

  // New cookie: base64 JSON
  const sessRaw = cookies['docvai_sess'];
  const sessObj = sessRaw ? tryDecodeSess(sessRaw) : null;
  if (sessObj) return sessObj;

  // Legacy cookie: "email|secret"
  const legacy = cookies['docvai_auth'];
  if (legacy) {
    const [email, secret] = legacy.split('|');
    if (email && secret && (!process.env.JWT_SECRET || secret === process.env.JWT_SECRET)) {
      return { email: decodeURIComponent(email), name: 'Legacy User' };
    }
  }

  const err = new Error('unauthorized');
  err.statusCode = 401;
  throw err;
}

module.exports = { requireAuth, corsHeaders };
