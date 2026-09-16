// ============================================================
// Verify FPU data in the database
// Usage: node scripts/check-fpu-data.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n══════════════════════════════════════════════════');
    console.log('  Federal Polytechnic, Ugep — Data Verification');
    console.log('══════════════════════════════════════════════════\n');

    // 1. Totals
    const totals = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM departments) AS departments,
        (SELECT COUNT(*)::int FROM programmes)  AS programmes,
        (SELECT COUNT(*)::int FROM courses WHERE is_active = TRUE) AS courses,
        (SELECT COUNT(*)::int FROM students) AS students,
        (SELECT COUNT(*)::int FROM users) AS users
    `);
    console.log('📊 Totals:');
    console.table(totals.rows);

    // 2. Departments
    const depts = await db.query(`
      SELECT code, name FROM departments ORDER BY code
    `);
    console.log('\n🏫 Departments (' + depts.rows.length + '):');
    console.table(depts.rows);

    // 3. Programmes
    const progs = await db.query(`
      SELECT p.code, p.name, d.code AS dept
        FROM programmes p
        JOIN departments d ON d.id = p.department_id
       ORDER BY p.code
    `);
    console.log('\n🎓 Programmes (' + progs.rows.length + '):');
    console.table(progs.rows);

    // 4. Courses per programme
    const courseSummary = await db.query(`
      SELECT p.code AS programme, c.level, c.semester_name,
             COUNT(*)::int AS courses, SUM(c.units)::int AS units
        FROM courses c
        JOIN programmes p ON p.id = c.programme_id
       WHERE c.is_active = TRUE
       GROUP BY p.code, c.level, c.semester_name
       ORDER BY p.code, c.level, c.semester_name
    `);
    console.log('\n📚 Courses by Programme/Level/Semester:');
    console.table(courseSummary.rows);

    // 5. CSC courses specifically
    const cscCourses = await db.query(`
      SELECT c.code, c.title, c.units, c.level, c.semester_name
        FROM courses c
        JOIN programmes p ON p.id = c.programme_id
       WHERE p.code = 'CSC-ND'
       ORDER BY c.level, c.semester_name, c.code
    `);
    console.log('\n💻 CSC-ND Courses (' + cscCourses.rows.length + '):');
    console.table(cscCourses.rows);

    // 6. COM courses
    const comCourses = await db.query(`
      SELECT code, title, units, level, semester_name
        FROM courses
       WHERE code LIKE 'COM%'
       ORDER BY level, code
    `);
    console.log('\n🔤 COM-prefix courses (' + comCourses.rows.length + '):');
    console.table(comCourses.rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await db.close();
    process.exit(0);
  }
})();