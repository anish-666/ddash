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
    pool = new Pool({
      connectionString: url,
      max: 3,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

// Auto-create / migrate schema (adds transcript_text if missing)
async function ensureSchema() {
  const sql = `
  CREATE TABLE IF NOT EXISTS docvai_calls (
    id BIGSERIAL PRIMARY KEY,
    provider_call_id TEXT,
    agent_id TEXT,
    to_number TEXT,
    from_number TEXT,
    status TEXT,
    duration_sec INTEGER,
    recording_url TEXT,
    transcript_url TEXT,
    transcript_text TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  DO $$ BEGIN
    ALTER TABLE docvai_calls ADD COLUMN IF NOT EXISTS transcript_text TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS idx_docvai_calls_created_at ON docvai_calls(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_docvai_calls_provider_call_id ON docvai_calls(provider_call_id);
  `;
  await query(sql);
}

module.exports = { query, ensureSchema };
