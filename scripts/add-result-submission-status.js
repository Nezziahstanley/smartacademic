// ============================================================
// Add submission_status column to results table
// Usage: node scripts/add-result-submission-status.js
// ============================================================

'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const useSSL =
  process.env.NODE_ENV === 'production' ||
  (process.env.DB_HOST && process.env.DB_HOST.includes('neon.tech')) ||
  process.env.DB_SSL === 'true';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    console.log('\n=== Adding submission_status to results ===\n');

    await pool.query(`
      ALTER TABLE results
        ADD COLUMN IF NOT EXISTS submission_status VARCHAR(15) NOT NULL DEFAULT 'draft'
          CHECK (submission_status IN ('draft', 'submitted', 'approved', 'returned')),
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS submitted_by INT REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS return_reason TEXT
    `);
    console.log('   ✅ Columns added');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_results_submission_status ON results(submission_status);
    `);
    console.log('   ✅ Index created');

    console.log('\n🎉 Done.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();