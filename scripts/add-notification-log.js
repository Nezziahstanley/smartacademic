// ============================================================
// Add notification_log table
// Usage: node scripts/add-notification-log.js
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
    console.log('\n=== Adding notification_log table ===\n');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id              SERIAL PRIMARY KEY,
        user_id         INT REFERENCES users(id) ON DELETE SET NULL,
        channel         VARCHAR(10) NOT NULL CHECK (channel IN ('email','sms','inapp')),
        recipient       VARCHAR(150) NOT NULL,
        subject         VARCHAR(200),
        status          VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','skipped')),
        error           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('   ✅ Table created (or already existed)');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notif_log_user    ON notification_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_notif_log_channel ON notification_log(channel);
      CREATE INDEX IF NOT EXISTS idx_notif_log_status  ON notification_log(status);
      CREATE INDEX IF NOT EXISTS idx_notif_log_date    ON notification_log(created_at DESC);
    `);
    console.log('   ✅ Indexes created');

    // Verify
    const r = await pool.query(`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_name = 'notification_log'
       ORDER BY ordinal_position
    `);
    console.log('\n📋 Columns:');
    console.table(r.rows);

    console.log('\n🎉 Done.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();