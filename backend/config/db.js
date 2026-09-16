// ============================================================
// SMARTACADEMIC — PostgreSQL Connection Pool
// Uses `pg` with a shared Pool. SSL enabled for Neon.
// Exposes query(), withTransaction(), and healthCheck().
// All queries MUST be parameterized ($1, $2) — never string-concat.
// ============================================================

'use strict';

const { Pool } = require('pg');
const env = require('./env');

// ============================================================
// POOL CONFIGURATION
// ============================================================
// SSL is required for Neon (cloud PostgreSQL).
// Local PostgreSQL usually runs without SSL, so we auto-detect.
// ============================================================
const useSSL =
  env.NODE_ENV === 'production' ||
  (env.DB.host && env.DB.host.includes('neon.tech')) ||
  process.env.DB_SSL === 'true';

const pool = new Pool({
  host:     env.DB.host,
  port:     env.DB.port,
  user:     env.DB.user,
  password: env.DB.password,
  database: env.DB.name,
  ssl:      useSSL ? { rejectUnauthorized: false } : false,
  max: 20,                        // max clients in pool
  idleTimeoutMillis: 30000,       // close idle clients after 30s
  connectionTimeoutMillis: 10000, // fail fast if DB unreachable (10s)
});

// ============================================================
// POOL EVENT LOGGING
// ============================================================
pool.on('connect', () => {
  if (env.isDevelopment) {
    console.log('[db] New client connected to PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
  // Do not exit — pool will recover
});

// ============================================================
// CORE QUERY HELPER (parameterized)
// ============================================================
/**
 * Run a parameterized SQL query.
 * @param {string} text   SQL string, e.g. "SELECT * FROM users WHERE id = $1"
 * @param {Array}  params Values matching $1, $2, ...
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (env.isDevelopment && duration > 500) {
      console.warn(`[db] Slow query (${duration}ms):`, text.slice(0, 120));
    }
    return result;
  } catch (err) {
    console.error('[db] Query error:', err.message);
    console.error('[db] SQL:', text.slice(0, 200));
    throw err;
  }
}

// ============================================================
// TRANSACTION HELPER
// ============================================================
/**
 * Run a callback inside a transaction.
 * Automatically BEGIN / COMMIT / ROLLBACK.
 *
 * Usage:
 *   await withTransaction(async (client) => {
 *     await client.query('INSERT ...', [...]);
 *     await client.query('UPDATE ...', [...]);
 *   });
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] Rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================
async function healthCheck() {
  try {
    const result = await pool.query('SELECT NOW() AS now, current_database() AS db');
    return {
      ok: true,
      now: result.rows[0].now,
      database: result.rows[0].db,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
async function close() {
  await pool.end();
  console.log('[db] Connection pool closed');
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  pool,
  query,
  withTransaction,
  healthCheck,
  close,
};