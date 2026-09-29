// ============================================================
// Delete ALL courses and their dependent records.
// Usage: node scripts/clear-courses.js
// ⚠️ DESTRUCTIVE — students' registrations, results, attendance,
//    scores, assessments, and risk assessments tied to courses
//    will also be removed.
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n=== Clearing all courses ===\n');

    // Count before
    const before = await db.query(`SELECT COUNT(*)::int AS n FROM courses`);
    console.log(`Courses before: ${before.rows[0].n}`);

    // Order matters — children first.
    // Most have ON DELETE CASCADE, but we're explicit for clarity.
    console.log('\nDeleting dependent records…');

    const t1 = await db.query('DELETE FROM risk_assessments');
    console.log(`  risk_assessments:    ${t1.rowCount}`);

    const t2 = await db.query('DELETE FROM results');
    console.log(`  results:             ${t2.rowCount}`);

    const t3 = await db.query('DELETE FROM scores');
    console.log(`  scores:              ${t3.rowCount}`);

    const t4 = await db.query('DELETE FROM assessments');
    console.log(`  assessments:         ${t4.rowCount}`);

    const t5 = await db.query('DELETE FROM attendance');
    console.log(`  attendance:          ${t5.rowCount}`);

    const t6 = await db.query('DELETE FROM class_sessions');
    console.log(`  class_sessions:      ${t6.rowCount}`);

    const t7 = await db.query('DELETE FROM course_registrations');
    console.log(`  course_registrations:${t7.rowCount}`);

    const t8 = await db.query('DELETE FROM interventions');
    console.log(`  interventions:       ${t8.rowCount}`);

    // Finally — the courses themselves
    const t9 = await db.query('DELETE FROM courses');
    console.log(`  courses:             ${t9.rowCount}`);

    // Reset sequences so new inserts start at 1
    await db.query(`
      ALTER SEQUENCE courses_id_seq RESTART WITH 1;
      ALTER SEQUENCE course_registrations_id_seq RESTART WITH 1;
      ALTER SEQUENCE attendance_id_seq RESTART WITH 1;
      ALTER SEQUENCE class_sessions_id_seq RESTART WITH 1;
      ALTER SEQUENCE assessments_id_seq RESTART WITH 1;
      ALTER SEQUENCE scores_id_seq RESTART WITH 1;
      ALTER SEQUENCE results_id_seq RESTART WITH 1;
      ALTER SEQUENCE risk_assessments_id_seq RESTART WITH 1;
      ALTER SEQUENCE interventions_id_seq RESTART WITH 1;
    `);
    console.log('\n✅ Sequences reset');

    // Verify
    const after = await db.query(`SELECT COUNT(*)::int AS n FROM courses`);
    console.log(`\nCourses after:  ${after.rows[0].n}`);
    console.log('\n🎉 Done. Departments, programmes, students, users, and sessions are untouched.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();