// ============================================================
// Create hod_submissions table if it doesn't exist
// Usage: node scripts/create-hod-submissions-table.js
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
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      useSSL ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    console.log('\n=== Creating hod_submissions table ===\n');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hod_submissions (
        id              SERIAL PRIMARY KEY,
        hod_user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department_id   INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        type            VARCHAR(20) NOT NULL
                        CHECK (type IN ('student', 'lecturer', 'course')),
        status          VARCHAR(15) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
        payload         JSONB NOT NULL,
        admin_notes     TEXT,
        reviewed_by     INT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('   ✅ Table created (or already existed)');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_hod_submissions_status ON hod_submissions(status);
      CREATE INDEX IF NOT EXISTS idx_hod_submissions_type   ON hod_submissions(type);
      CREATE INDEX IF NOT EXISTS idx_hod_submissions_hod    ON hod_submissions(hod_user_id);
    `);
    console.log('   ✅ Indexes created');

    // Verify
    const r = await pool.query(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'hod_submissions'
    `);
    console.log('\n📋 Table exists:', r.rows.length > 0);
    console.log('\n🎉 Done.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();