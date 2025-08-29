// Small wrapper around node-fetch to simplify
// performing HTTP requests from Netlify functions.  We
// always parse JSON when possible and throw errors on
// non‑successful responses.

const fetch = require('node-fetch');

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    const message = text || res.statusText;
    const err = new Error(message);
    err.statusCode = res.status;
    throw err;
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

module.exports = { request };