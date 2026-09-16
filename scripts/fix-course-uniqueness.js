// ============================================================
// Fix: Drop UNIQUE constraint on courses.code
// Allows multiple programmes to offer the same course code
// (e.g., MTH 111 is offered by CEN, CIV, EEE, CSC, STA all at once).
//
// Usage: node scripts/fix-course-uniqueness.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n=== Fixing courses table constraints ===\n');

    // 1. Find the constraint name
    const c = await db.query(`
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'courses'::regclass
         AND contype = 'u'
         AND pg_get_constraintdef(oid) LIKE '%(code)%'
    `);

    if (c.rows.length) {
      for (const row of c.rows) {
        console.log(`Dropping constraint: ${row.conname}`);
        await db.query(`ALTER TABLE courses DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }
      console.log('✅ UNIQUE constraint on courses.code removed');
    } else {
      console.log('ℹ️  No UNIQUE constraint found on courses.code');
    }

    // 2. Add a NON-unique index for fast lookups
    console.log('\nAdding non-unique index on courses.code...');
    await db.query(`CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code)`);
    console.log('✅ Index created');

    // 3. Verify
    const after = await db.query(`
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'courses'::regclass
         AND contype = 'u'
    `);
    console.log('\nRemaining UNIQUE constraints on courses:');
    if (after.rows.length) {
      after.rows.forEach(r => console.log('  -', r.conname));
    } else {
      console.log('  (none)');
    }

    console.log('\n🎉 Done. You can now re-run the seed.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();