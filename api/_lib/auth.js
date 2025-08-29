// api/_lib/auth.js (CJS)
const COOKIE_NAME = 'docvai_auth';
const SECRET = process.env.JWT_SECRET || 'supersecret';
const BYPASS = process.env.DISABLE_AUTH === '1';

// Minimal error helper
function httpError(statusCode, message) {
  const err = new Error(message || 'unauthorized');
  err.statusCode = statusCode;
  return err;
}

// Very simple cookie parser
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(kv => {
    const [k, v] = kv.split('=');
    if (k) out[k.trim()] = (v || '').trim();
  });
  return out;
}

/**
 * Accepts three modes:
 * 1) BYPASS via DISABLE_AUTH=1 -> returns dummy user
 * 2) X-Admin-Key header equals JWT_SECRET -> admin user
 * 3) Cookie "docvai_auth" of form "email|SECRET" OR just "email"
 *    - If the suffix SECRET is present, we verify it.
 *    - If only email is present, we still accept (tolerant during setup).
 */
function requireAuth(event) {
  if (BYPASS) {
    return { email: 'bypass@docvai.com', name: 'Bypass User
