// ============================================================
// Check students + courses in the database
// Usage: node scripts/check-courses.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n=== STUDENTS ===');
    const s = await db.query(`
      SELECT id, matric_no, level, department_id, programme_id
        FROM students
       ORDER BY id
       LIMIT 10
    `);
    console.table(s.rows);

    console.log('\n=== COURSES ===');
    const c = await db.query(`
      SELECT id, code, title, units, level, department_id, semester_name
        FROM courses
       ORDER BY code
    `);
    console.table(c.rows);

    console.log('\n=== DEPARTMENTS ===');
    const d = await db.query('SELECT id, code, name FROM departments ORDER BY id');
    console.table(d.rows);

    console.log('\n=== PROGRAMMES ===');
    const p = await db.query('SELECT id, code, name, department_id FROM programmes ORDER BY id');
    console.table(p.rows);

    console.log('\n=== ACTIVE SESSION ===');
    const sess = await db.query('SELECT id, name, is_active FROM sessions ORDER BY id');
    console.table(sess.rows);

    console.log('\n=== ACTIVE SEMESTER ===');
    const sem = await db.query('SELECT id, name, session_id, is_active FROM semesters ORDER BY id');
    console.table(sem.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await db.close();
    process.exit(0);
  }
})();