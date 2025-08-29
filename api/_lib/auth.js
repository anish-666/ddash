// api/_lib/auth.js (CJS)
const COOKIE_NAME = 'docvai_auth';
const SECRET = process.env.JWT_SECRET || 'supersecret';
const BYPASS = process.env.DISABLE_AUTH === '1';


function httpError(statusCode, message) {
const err = new Error(message || 'unauthorized');
err.statusCode = statusCode;
return err;
}


function parseCookies(header) {
const out = {};
if (!header) return out;
header.split(';').forEach((kv) => {
const idx = kv.indexOf('=');
const k = idx >= 0 ? kv.slice(0, idx) : kv;
const v = idx >= 0 ? kv.slice(idx + 1) : '';
if (k) out[k.trim()] = (v || '').trim();
});
return out;
}


function requireAuth(event) {
if (BYPASS) {
return { email: 'bypass@docvai.com', name: 'Bypass User' };
}


const headers = event.headers || {};
const adminKey = headers['x-admin-key'] || headers['X-Admin-Key'] || headers['x-Admin-key'];
if (adminKey && adminKey === SECRET) {
return { email: 'admin@docvai.com', name: 'Admin (Header)' };
}


const cookieHeader = headers.cookie || headers.Cookie || '';
const cookies = parseCookies(cookieHeader);
const raw = cookies[COOKIE_NAME];
if (!raw) throw httpError(401, 'missing_cookie');


const parts = decodeURIComponent(raw).split('|');
const email = (parts[0] || '').trim().toLowerCase();
const sig = parts[1];
if (!email) throw httpError(401, 'invalid_cookie');
if (sig && sig !== SECRET) throw httpError(401, 'bad_signature');


return { email, name: 'Docvai User' };
}


function corsHeaders(event) {
const headers = event && event.headers ? event.headers : {};
const origin = headers.origin || headers.Origin || '*';
const siteOrigin = process.env.PUBLIC_SITE_URL || origin;
return {
'Access-Control-Allow-Origin': siteOrigin,
'Access-Control-Allow-Credentials': 'true',
'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
'Content-Type': 'application/json'
};
}


module.exports = { requireAuth, corsHeaders };
