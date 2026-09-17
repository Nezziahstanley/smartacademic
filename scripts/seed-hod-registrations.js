// ============================================================
// Seed demo HOD submissions + course registrations
// Usage: node scripts/seed-hod-registrations.js
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
  connectionTimeoutMillis: 15000,
});

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* ============================================================
       1. HOD SUBMISSIONS
       ============================================================ */
    console.log('\n1. HOD Submissions...');

    // Find CSC HOD
    const hod = await client.query(`
      SELECT u.id, d.id AS dept_id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        JOIN departments d ON d.hod_id = u.id
        WHERE r.name = 'hod' LIMIT 1
    `);

    if (hod.rows.length === 0) {
      console.log('   ⚠️  No HOD found — skipping submissions');
    } else {
      const hodUserId = hod.rows[0].id;
      const deptId = hod.rows[0].dept_id;

      const submissions = [
        {
          type: 'student',
          payload: {
            full_name: 'Test Student One',
            email: 'test.student1@fpugep.edu.ng',
            phone: '+2348011111111',
            matric_no: 'FPU/CSC/ND/24/101',
            level: 100,
            admission_year: 2024,
          },
        },
        {
          type: 'student',
          payload: {
            full_name: 'Test Student Two',
            email: 'test.student2@fpugep.edu.ng',
            phone: '+2348011111112',
            matric_no: 'FPU/CSC/ND/24/102',
            level: 100,
            admission_year: 2024,
          },
        },
        {
          type: 'course',
          payload: {
            code: 'CSC199',
            title: 'Special Topics in Computing',
            units: 2,
            level: 100,
            semester_name: 'First',
          },
        },
        {
          type: 'lecturer',
          payload: {
            full_name: 'Mr. Test Lecturer',
            email: 'test.lecturer@fpugep.edu.ng',
            phone: '+2348022222222',
            staff_id: 'FPU/CSC/L999',
            title: 'Mr.',
          },
        },
      ];

      let added = 0;
      for (const s of submissions) {
        // Check if exists already (to keep idempotent)
        const exists = await client.query(
          `SELECT 1 FROM hod_submissions
            WHERE hod_user_id = $1 AND type = $2 AND payload->>'email' = $3`,
          [hodUserId, s.type, s.payload.email || s.payload.code || '']
        );
        if (exists.rows.length > 0) continue;

        await client.query(`
          INSERT INTO hod_submissions (hod_user_id, department_id, type, payload, status)
          VALUES ($1, $2, $3, $4, 'pending')
        `, [hodUserId, deptId, s.type, JSON.stringify(s.payload)]);
        added++;
      }
      console.log(`   ✅ Added ${added} HOD submissions`);
    }

    /* ============================================================
       2. COURSE REGISTRATIONS
       ============================================================ */
    console.log('\n2. Course registrations...');

    // Active session + semester
    const sess = await client.query('SELECT id FROM sessions WHERE is_active = TRUE LIMIT 1');
    const sem = await client.query('SELECT id FROM semesters WHERE is_active = TRUE LIMIT 1');

    if (sess.rows.length === 0 || sem.rows.length === 0) {
      console.log('   ⚠️  No active session/semester — skipping');
    } else {
      const sessionId = sess.rows[0].id;
      const semesterId = sem.rows[0].id;

      const students = await client.query('SELECT id FROM students ORDER BY id');

      // Find some CSC-ND Level 100 First semester courses
      const courses = await client.query(`
        SELECT c.id, c.units
          FROM courses c
          JOIN programmes p ON p.id = c.programme_id
         WHERE p.code = 'CSC-ND'
           AND c.level = 100
           AND c.semester_name = 'First'
           AND c.is_active = TRUE
         LIMIT 6
      `);

      if (students.rows.length === 0 || courses.rows.length === 0) {
        console.log('   ⚠️  No students or no CSC-ND courses — skipping');
      } else {
        let total = 0;
        for (const st of students.rows) {
          for (const c of courses.rows) {
            const r = await client.query(`
              INSERT INTO course_registrations
                (student_id, course_id, session_id, semester_id, status)
              VALUES ($1, $2, $3, $4, 'registered')
              ON CONFLICT DO NOTHING
              RETURNING id
            `, [st.id, c.id, sessionId, semesterId]);
            if (r.rows.length > 0) total++;
          }
        }
        console.log(`   ✅ Registered ${total} courses across ${students.rows.length} students`);
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 Seed complete. Refresh the browser.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();