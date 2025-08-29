// api/_lib/auth.js (CJS)
const corsHeaders = (_event) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
});

function parseCookie(str) {
  const out = {};
  (str || '').split(/;\s*/).forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}

function requireAuth(event) {
  // 1) bypass for setup/debug
  if (process.env.DISABLE_AUTH === '1') {
    return { email: 'bypass@docvai.com', name: 'Bypass User' };
  }
  // 2) admin header escape hatch
  const hdrs = event.headers || {};
  const adminKey = hdrs['x-admin-key'] || hdrs['X-Admin-Key'];
  if (adminKey && process.env.JWT_SECRET && adminKey === process.env.JWT_SECRET) {
    return { email: 'admin@docvai.com', name: 'Admin Header' };
  }
  // 3) cookie
  const cookies = parseCookie(hdrs.cookie || hdrs.Cookie || '');
  const sess = cookies['docvai_sess'];
  if (sess) {
    try {
      const obj = JSON.parse(Buffer.from(sess, 'base64').toString('utf8'));
      if (obj && obj.email) return obj;
    } catch {}
  }
  const err = new Error('unauthorized');
  err.statusCode = 401;
  throw err;
}

module.exports = { requireAuth, corsHeaders };
