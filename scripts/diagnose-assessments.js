// ============================================================
// Diagnose assessments table
// Usage: node scripts/diagnose-assessments.js
// ============================================================

'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n=== Assessment Diagnostics ===\n');

    const total = await db.query('SELECT COUNT(*)::int AS n FROM assessments');
    console.log('Total assessments:', total.rows[0].n);

    const breakdown = await db.query(`
      SELECT
        CASE WHEN session_id IS NULL THEN 'NULL' ELSE 'set' END AS session_status,
        CASE WHEN semester_id IS NULL THEN 'NULL' ELSE 'set' END AS semester_status,
        COUNT(*)::int AS n
        FROM assessments
       GROUP BY 1, 2
    `);
    console.log('\nBreakdown:');
    console.table(breakdown.rows);

    const sample = await db.query(`
      SELECT id, course_id, session_id, semester_id, type, title
        FROM assessments
       ORDER BY id
       LIMIT 10
    `);
    console.log('\nSample rows:');
    console.table(sample.rows);
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await db.close();
  }
})();