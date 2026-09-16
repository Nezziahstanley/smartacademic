// ============================================================
// SMARTACADEMIC — Database Reset
// Drops the entire database, recreates it, runs schema, seeds.
// Usage: npm run reset-db
// ⚠️ DESTRUCTIVE — do not run against production.
// ============================================================

'use strict';

const path = require('path');
const { Client } = require('pg');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'smartacademic';

const adminConfig = {
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
};

async function dropDatabase() {
  const client = new Client(adminConfig);
  await client.connect();

  // Terminate existing connections
  await client.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1 AND pid <> pg_backend_pid();
  `, [DB_NAME]);

  console.log(`[reset-db] Dropping database "${DB_NAME}" ...`);
  await client.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
  await client.end();
}

function runNode(script) {
  const scriptPath = path.resolve(__dirname, script);
  console.log(`[reset-db] Running ${script} ...`);
  const result = spawnSync('node', [scriptPath], { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`[reset-db] ${script} failed with exit code ${result.status}`);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[reset-db] ❌ Refusing to run in production.');
    process.exit(1);
  }

  try {
    await dropDatabase();
    runNode('init-db.js');
    runNode('seed-db.js');
    console.log('[reset-db] ✅ Database reset complete.');
  } catch (err) {
    console.error('[reset-db] Failed:', err.message);
    process.exit(1);
  }
}

main();