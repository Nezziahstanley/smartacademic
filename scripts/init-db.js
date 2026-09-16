// ============================================================
// SMARTACADEMIC — Database Initializer
// Creates the database if missing, then runs schema.sql.
// Usage: npm run init-db
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'smartacademic';

// Detect SSL requirement (Neon, Supabase, etc.)
const useSSL =
  process.env.NODE_ENV === 'production' ||
  (process.env.DB_HOST && process.env.DB_HOST.includes('neon.tech')) ||
  process.env.DB_SSL === 'true';

const sslConfig = useSSL ? { rejectUnauthorized: false } : false;

// Connection to the default "postgres" DB (needed to CREATE DATABASE)
const adminConfig = {
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  ssl:      sslConfig,
};

// Connection to the target DB (needed to run schema.sql)
const targetConfig = {
  ...adminConfig,
  database: DB_NAME,
};

async function createDatabaseIfMissing() {
  const client = new Client(adminConfig);
  await client.connect();

  const { rows } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [DB_NAME]
  );

  if (rows.length === 0) {
    console.log(`[init-db] Creating database "${DB_NAME}" ...`);
    // Safe: DB_NAME comes from .env, not user input. Quote it anyway.
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`[init-db] Database "${DB_NAME}" created.`);
  } else {
    console.log(`[init-db] Database "${DB_NAME}" already exists.`);
  }

  await client.end();
}

async function runSchema() {
  const schemaPath = path.resolve(__dirname, '../backend/database/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`[init-db] schema.sql not found at ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client(targetConfig);
  await client.connect();

  console.log('[init-db] Running schema.sql ...');
  try {
    await client.query(sql);
    console.log('[init-db] ✅ Schema applied successfully.');
  } catch (err) {
    console.error('[init-db] ❌ Schema error:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    console.log('[init-db] Starting ...');
    await createDatabaseIfMissing();
    await runSchema();
    console.log('[init-db] ✅ Done. Next: npm run seed-db');
  } catch (err) {
    console.error('[init-db] Failed:', err.message);
    process.exit(1);
  }
}

main();