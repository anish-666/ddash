// api/_lib/http.js (CJS)
async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text().catch(() => '');
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!res.ok) {
    const msg = (json && (json.error || json.message || json.detail)) || res.statusText;
    const err = new Error(msg || 'http_error');
    err.statusCode = res.status;
    err.body = json || text;
    throw err;
  }
  return json;
}
module.exports = { request };
