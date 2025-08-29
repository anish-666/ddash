// api/_lib/db.js (CJS)
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      const e = new Error('DATABASE_URL not set');
      e.statusCode = 500;
      throw e;
    }
    pool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  const res = await p.query(text, params);
  return res;
}

module.exports = { query };
