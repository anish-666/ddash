// Authentication helper used by Netlify functions.  It
// supports an optional bypass via the DISABLE_AUTH
// environment variable and simple API key based auth.

const SECRET = process.env.JWT_SECRET || 'supersecret';

/**
 * Require the user to be authenticated.  When
 * DISABLE_AUTH=1 any request will pass through and
 * return a dummy user.  Otherwise an X-Admin-Key
 * header equal to JWT_SECRET is expected.  If neither
 * are satisfied this function throws an error with a
 * 401 statusCode which is handled by the caller.
 *
 * @param {Object} event The Netlify function event
 * @returns {Object} A user object if authenticated
 */
function requireAuth(event) {
  const bypass = process.env.DISABLE_AUTH === '1';
  if (bypass) {
    return { email: 'bypass@docvai.com', name: 'Bypass User' };
  }
  const headers = event.headers || {};
  // Netlify converts header names to lower case by default
  const adminKey = headers['x-admin-key'];
  if (adminKey && adminKey === SECRET) {
    return { email: 'admin@docvai.com', name: 'Admin' };
  }
  throw { statusCode: 401, message: 'unauthorized' };
}

module.exports = { requireAuth };