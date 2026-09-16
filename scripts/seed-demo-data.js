// ============================================================
// Seed complete demo data for a fresh SMARTACADEMIC install
// - Active session + semester
// - Course registrations for all students
// - Risk assessments for all students
// - Sample audit logs
//
// Does NOT touch users, courses, departments, programmes.
//
// Usage: node scripts/seed-demo-data.js
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
       1. SESSION & SEMESTER
       ============================================================ */
    console.log('\n1. Session & Semester...');

    // Ensure no session is active (to avoid unique index violation)
    await client.query('UPDATE sessions SET is_active = FALSE');
    await client.query('UPDATE semesters SET is_active = FALSE');

    // Upsert 2024/2025 session
    const sessRes = await client.query(`
      INSERT INTO sessions (name, start_date, end_date, is_active)
      VALUES ('2024/2025', '2024-09-01', '2025-07-31', TRUE)
      ON CONFLICT (name) DO UPDATE SET is_active = TRUE
      RETURNING id
    `);
    const sessionId = sessRes.rows[0].id;
    console.log('   ✅ Session:', sessionId);

    // Upsert First semester
    const semRes = await client.query(`
      INSERT INTO semesters (session_id, name, start_date, end_date, is_active)
      VALUES ($1, 'First', '2024-09-01', '2025-01-31', TRUE)
      ON CONFLICT (session_id, name) DO UPDATE SET is_active = TRUE
      RETURNING id
    `, [sessionId]);
    const semesterId = semRes.rows[0].id;
    console.log('   ✅ Semester:', semesterId);

    // Update settings
    await client.query("UPDATE settings SET value = $1 WHERE key = 'current_session_id'", [String(sessionId)]);
    await client.query("UPDATE settings SET value = $1 WHERE key = 'current_semester_id'", [String(semesterId)]);
    console.log('   ✅ Settings updated');

    /* ============================================================
       2. COURSE REGISTRATIONS
       ============================================================ */
    console.log('\n2. Course registrations...');

    const students = await client.query('SELECT id FROM students ORDER BY id');
    if (students.rows.length === 0) {
      console.log('   ⚠️  No students found — skipping registrations');
    } else {
      // Get CSC-ND courses at level 100, First semester
      const courses = await client.query(`
        SELECT c.id, c.units FROM courses c
        WHERE c.programme_id = (SELECT id FROM programmes WHERE code = 'CSC-ND' LIMIT 1)
          AND c.level = 100
          AND c.semester_name = 'First'
          AND c.is_active = TRUE
        LIMIT 8
      `);

      if (courses.rows.length === 0) {
        console.log('   ⚠️  No CSC-ND level 100 First-semester courses found');
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

    /* ============================================================
       3. RISK ASSESSMENTS
       ============================================================ */
    console.log('\n3. Risk assessments...');

    const profiles = [
      { cat: 'GREEN',  score: 10, att: 92, gpa: 4.2, failed: 0 },
      { cat: 'YELLOW', score: 35, att: 74, gpa: 3.1, failed: 0 },
      { cat: 'ORANGE', score: 62, att: 58, gpa: 2.0, failed: 2 },
      { cat: 'RED',    score: 85, att: 41, gpa: 1.1, failed: 4 },
    ];

    for (let i = 0; i < students.rows.length; i++) {
      const p = profiles[i % 4];
      await client.query(`
        INSERT INTO risk_assessments
          (student_id, session_id, semester_id, risk_score, risk_category,
           attendance_pct, ca_avg, exam_avg, failed_courses, gpa, cgpa, factors)
        VALUES ($1, $2, $3, $4, $5, $6, 60, 60, $7, $8, $8, 'Demo data')
      `, [students.rows[i].id, sessionId, semesterId,
          p.score, p.cat, p.att, p.failed, p.gpa]);
    }
    console.log(`   ✅ Seeded ${students.rows.length} risk assessments`);

    /* ============================================================
       4. AUDIT LOGS
       ============================================================ */
    console.log('\n4. Audit logs...');

    const admin = await client.query("SELECT id FROM users WHERE email = 'admin@smartacademic.edu' LIMIT 1");
    if (admin.rows.length > 0) {
      const adminId = admin.rows[0].id;
      const actions = [
        ['create_user',         'users',         'user:4'],
        ['update_setting',      'settings',      'setting:institution_name'],
        ['approve_registration','registrations', 'registration:1'],
        ['create_course',       'courses',       'course:CSC101'],
        ['mark_fees_paid',      'students',      'student:1'],
      ];
      for (const [action, module, record] of actions) {
        await client.query(`
          INSERT INTO audit_logs (user_id, action, module, affected_record, created_at)
          VALUES ($1, $2, $3, $4, NOW() - (random() * interval '2 hours'))
        `, [adminId, action, module, record]);
      }
      console.log(`   ✅ Seeded ${actions.length} audit logs`);
    } else {
      console.log('   ⚠️  Admin user not found — skipping audit logs');
    }

    /* ============================================================
       5. NOTIFICATIONS FOR STUDENTS
       ============================================================ */
    console.log('\n5. Welcome notifications...');
    const stuUsers = await client.query(`
      SELECT u.id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'student'
    `);
    for (const u of stuUsers.rows) {
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'Welcome to SMARTACADEMIC',
                'Your academic dashboard is ready. Check your attendance and results regularly.',
                'system')
      `, [u.id]);
    }
    console.log(`   ✅ Sent ${stuUsers.rows.length} welcome notifications`);

    await client.query('COMMIT');

    /* ============================================================
       FINAL SUMMARY
       ============================================================ */
    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ DEMO DATA SEEDED SUCCESSFULLY');
    console.log('══════════════════════════════════════════════════\n');

    const tables = [
      'users', 'students', 'departments', 'programmes', 'courses',
      'course_registrations', 'risk_assessments', 'audit_logs', 'notifications',
    ];
    for (const t of tables) {
      const r = await client.query('SELECT COUNT(*)::int AS n FROM ' + t);
      console.log('   ' + t.padEnd(25) + r.rows[0].n);
    }

    console.log('\n🎉 Refresh the browser and explore the system.\n');
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