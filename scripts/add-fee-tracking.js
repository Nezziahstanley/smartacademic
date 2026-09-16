// ============================================================
// Add fee tracking columns for students
// Usage: node scripts/add-fee-tracking.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n=== Adding fee tracking columns ===\n');

    // Add fee columns to students table
    await db.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS school_fees_paid BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS school_fees_paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS school_fees_amount NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS school_fees_receipt_no VARCHAR(50)
    `);
    console.log('   ✅ Added: school_fees_paid, school_fees_paid_at, school_fees_amount, school_fees_receipt_no');

    // Add fee columns to course_registrations for audit
    await db.query(`
      ALTER TABLE course_registrations
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS dropped_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS dropped_by INT REFERENCES users(id)
    `);
    console.log('   ✅ Added: approved_at, approved_by, dropped_at, dropped_by');

    // Verify
    const cols = await db.query(`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_name IN ('students', 'course_registrations')
         AND column_name IN ('school_fees_paid','approved_at','approved_by','dropped_at','dropped_by')
       ORDER BY table_name, column_name
    `);
    console.log('\n📋 New columns:');
    console.table(cols.rows);

    console.log('\n🎉 Done.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();