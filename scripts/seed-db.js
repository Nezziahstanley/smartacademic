// ============================================================
// SMARTACADEMIC — Database Seeder
// Inserts demo users, departments, programmes, courses,
// registrations, attendance, assessments, scores, and results
// for Students A, B, C, D (GREEN/YELLOW/ORANGE/RED).
// Usage: npm run seed-db
// ============================================================

'use strict';

const path    = require('path');
const bcrypt  = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smartacademic',
});

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

// ---------- Helpers ----------
const hash = (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const isoDate = (d) => d.toISOString().slice(0, 10);

// ---------- Main ----------
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('[seed] Clearing existing data ...');
    // Order matters (children first)
    await client.query(`
      TRUNCATE TABLE
        audit_logs, notifications, interventions, risk_assessments,
        results, scores, assessments, attendance, class_sessions,
        course_registrations, courses, semesters, sessions,
        settings, students, lecturers, programmes, departments,
        users, roles
      RESTART IDENTITY CASCADE;
    `);

    // ============================================================
    // 1. ROLES
    // ============================================================
    console.log('[seed] Inserting roles ...');
    await client.query(`
      INSERT INTO roles (name, description) VALUES
        ('admin',    'System administrator'),
        ('hod',      'Head of Department'),
        ('lecturer', 'Lecturer'),
        ('student',  'Student');
    `);
    const roleRows = await client.query('SELECT id, name FROM roles');
    const roleId = Object.fromEntries(roleRows.rows.map(r => [r.name, r.id]));

    // ============================================================
    // 2. DEPARTMENTS (initially without HOD)
    // ============================================================
    console.log('[seed] Inserting departments ...');
    const deptRows = await client.query(`
      INSERT INTO departments (name, code) VALUES
        ('Computer Science',       'CSC'),
        ('Mathematics',            'MTH'),
        ('Physics',                'PHY'),
        ('Electrical Engineering', 'EEE')
      RETURNING id, code;
    `);
    const deptId = Object.fromEntries(deptRows.rows.map(r => [r.code, r.id]));

    // ============================================================
    // 3. PROGRAMMES
    // ============================================================
    console.log('[seed] Inserting programmes ...');
    const progRows = await client.query(`
      INSERT INTO programmes (name, code, department_id, duration_years) VALUES
        ('B.Sc. Computer Science',        'CSC-BSC', $1, 4),
        ('B.Sc. Software Engineering',    'CSC-SWE', $1, 4),
        ('B.Sc. Mathematics',             'MTH-BSC', $2, 4),
        ('B.Sc. Physics',                 'PHY-BSC', $3, 4),
        ('B.Eng. Electrical Engineering', 'EEE-BENG',$4, 5)
      RETURNING id, code;
    `, [deptId.CSC, deptId.MTH, deptId.PHY, deptId.EEE]);
    const progId = Object.fromEntries(progRows.rows.map(r => [r.code, r.id]));

    // ============================================================
    // 4. USERS
    // ============================================================
    console.log('[seed] Hashing passwords ...');
    const [adminPw, hodPw, lectPw, studPw] = await Promise.all([
      hash('Admin@123'),
      hash('Hod@123'),
      hash('Lect@123'),
      hash('Student@123'),
    ]);

    console.log('[seed] Inserting admin & HOD users ...');
    const adminRow = await client.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role_id)
      VALUES ('System Administrator', 'admin@smartacademic.edu',
              '+2348000000001', $1, $2)
      RETURNING id;
    `, [adminPw, roleId.admin]);
    const adminId = adminRow.rows[0].id;

    const hodRow = await client.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role_id)
      VALUES ('Dr. Adebayo Okonkwo', 'hod.csc@smartacademic.edu',
              '+2348000000002', $1, $2)
      RETURNING id;
    `, [hodPw, roleId.hod]);
    const hodUserId = hodRow.rows[0].id;

    // Assign HOD to department
    await client.query(
      'UPDATE departments SET hod_id = $1 WHERE id = $2',
      [hodUserId, deptId.CSC]
    );

    console.log('[seed] Inserting lecturers ...');
    const lecturerUsers = [
      { name: 'Dr. Chidinma Eze',   email: 'lecturer.csc1@smartacademic.edu', staff: 'CSC-L001' },
      { name: 'Prof. Ibrahim Musa', email: 'lecturer.csc2@smartacademic.edu', staff: 'CSC-L002' },
      { name: 'Dr. Funke Adeyemi',  email: 'lecturer.csc3@smartacademic.edu', staff: 'CSC-L003' },
    ];
    const lecturerIds = {};
    for (const l of lecturerUsers) {
      const u = await client.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id)
        VALUES ($1, $2, '+2348000000010', $3, $4)
        RETURNING id;
      `, [l.name, l.email, lectPw, roleId.lecturer]);
      const userId = u.rows[0].id;

      const lec = await client.query(`
        INSERT INTO lecturers (user_id, staff_id, department_id, title)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `, [userId, l.staff, deptId.CSC, l.name.split(' ')[0]]);
      lecturerIds[l.staff] = lec.rows[0].id;
    }

    console.log('[seed] Inserting demo students ...');
    const studentUsers = [
      { name: 'Student A (Good)',      email: 'student.a@smartacademic.edu', matric: '2021/CSC/001' },
      { name: 'Student B (Attention)', email: 'student.b@smartacademic.edu', matric: '2021/CSC/002' },
      { name: 'Student C (High Risk)', email: 'student.c@smartacademic.edu', matric: '2021/CSC/003' },
      { name: 'Student D (Critical)',  email: 'student.d@smartacademic.edu', matric: '2021/CSC/004' },
    ];
    const studentIds = {};
    for (const s of studentUsers) {
      const u = await client.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id)
        VALUES ($1, $2, '+2348000000020', $3, $4)
        RETURNING id;
      `, [s.name, s.email, studPw, roleId.student]);
      const userId = u.rows[0].id;

      const st = await client.query(`
        INSERT INTO students (user_id, matric_no, department_id, programme_id,
                              level, admission_year)
        VALUES ($1, $2, $3, $4, 300, 2021)
        RETURNING id;
      `, [userId, s.matric, deptId.CSC, progId['CSC-BSC']]);
      studentIds[s.matric] = st.rows[0].id;
    }

    // ============================================================
    // 5. SESSIONS & SEMESTERS
    // ============================================================
    console.log('[seed] Inserting sessions & semesters ...');
    const sessOld = await client.query(`
      INSERT INTO sessions (name, start_date, end_date, is_active)
      VALUES ('2023/2024', '2023-09-01', '2024-07-31', FALSE)
      RETURNING id;
    `);
    const sessCurrent = await client.query(`
      INSERT INTO sessions (name, start_date, end_date, is_active)
      VALUES ('2024/2025', '2024-09-01', '2025-07-31', TRUE)
      RETURNING id;
    `);
    const sessionId     = sessCurrent.rows[0].id;
    const oldSessionId  = sessOld.rows[0].id;

    const semFirst = await client.query(`
      INSERT INTO semesters (session_id, name, start_date, end_date, is_active)
      VALUES ($1, 'First', '2024-09-01', '2025-01-31', TRUE)
      RETURNING id;
    `, [sessionId]);
    const semesterId = semFirst.rows[0].id;

    const semFirstOld = await client.query(`
      INSERT INTO semesters (session_id, name, start_date, end_date, is_active)
      VALUES ($1, 'First', '2023-09-01', '2024-01-31', FALSE)
      RETURNING id;
    `, [oldSessionId]);
    const oldSemesterId = semFirstOld.rows[0].id;

    // Update settings to point to active session/semester
    await client.query(
      `UPDATE settings SET value = $1 WHERE key = 'current_session_id'`,
      [String(sessionId)]
    );
    await client.query(
      `UPDATE settings SET value = $1 WHERE key = 'current_semester_id'`,
      [String(semesterId)]
    );

    // ============================================================
    // 6. COURSES (CSC 300 Level, First Semester)
    // ============================================================
    console.log('[seed] Inserting courses ...');
    const courseDefs = [
      { code: 'CSC301', title: 'Data Structures & Algorithms',   units: 3, lecturer: 'CSC-L001' },
      { code: 'CSC303', title: 'Operating Systems',              units: 3, lecturer: 'CSC-L002' },
      { code: 'CSC305', title: 'Database Management Systems',    units: 3, lecturer: 'CSC-L001' },
      { code: 'CSC307', title: 'Software Engineering',           units: 3, lecturer: 'CSC-L003' },
      { code: 'CSC309', title: 'Computer Networks',              units: 3, lecturer: 'CSC-L002' },
    ];
    const courseIds = {};
    for (const c of courseDefs) {
      const r = await client.query(`
        INSERT INTO courses
          (code, title, units, department_id, programme_id, level,
           semester_name, lecturer_id)
        VALUES ($1, $2, $3, $4, $5, 300, 'First', $6)
        RETURNING id;
      `, [c.code, c.title, c.units, deptId.CSC, progId['CSC-BSC'], lecturerIds[c.lecturer]]);
      courseIds[c.code] = r.rows[0].id;
    }

    // ============================================================
    // 7. COURSE REGISTRATIONS (all 4 students register all 5 courses)
    // ============================================================
    console.log('[seed] Inserting course registrations ...');
    for (const matric of Object.keys(studentIds)) {
      for (const code of Object.keys(courseIds)) {
        await client.query(`
          INSERT INTO course_registrations
            (student_id, course_id, session_id, semester_id, status)
          VALUES ($1, $2, $3, $4, 'approved');
        `, [studentIds[matric], courseIds[code], sessionId, semesterId]);
      }
    }

    // ============================================================
    // 8. CLASS SESSIONS + ATTENDANCE
    //    Attendance profile per student:
    //      A: ~92%   B: ~74%   C: ~58%   D: ~41%
    // ============================================================
    console.log('[seed] Inserting class sessions & attendance ...');
    // For each course, create 12 past class sessions (weekly)
    const attendanceProfile = {
      '2021/CSC/001': 0.92, // Student A
      '2021/CSC/002': 0.74, // Student B
      '2021/CSC/003': 0.58, // Student C
      '2021/CSC/004': 0.41, // Student D
    };

    for (const code of Object.keys(courseIds)) {
      const courseId = courseIds[code];
      for (let i = 0; i < 12; i++) {
        const date = isoDate(daysAgo(7 * (12 - i)));

        const cs = await client.query(`
          INSERT INTO class_sessions (course_id, session_date, start_time, end_time, topic, created_by)
          VALUES ($1, $2, '09:00', '11:00', $3, $4)
          RETURNING id;
        `, [courseId, date, `${code} — Topic ${i + 1}`, adminId]);
        const csId = cs.rows[0].id;

        for (const matric of Object.keys(studentIds)) {
          const rate = attendanceProfile[matric];
          // Deterministic pseudo-random based on index
          const r = ((i * 7 + matric.charCodeAt(matric.length - 1)) % 100) / 100;
          const status = r < rate ? 'present' : (r < rate + 0.05 ? 'excused' : 'absent');

          await client.query(`
            INSERT INTO attendance
              (class_session_id, student_id, status, recorded_by)
            VALUES ($1, $2, $3, $4);
          `, [csId, studentIds[matric], status, adminId]);
        }
      }
    }

    // ============================================================
    // 9. ASSESSMENTS + SCORES
    //    Score profile per student (CA avg / Exam avg):
    //      A: 78 / 75   B: 58 / 55   C: 45 / 42   D: 30 / 28
    // ============================================================
    console.log('[seed] Inserting assessments & scores ...');
    const scoreProfile = {
      '2021/CSC/001': { ca: 78, exam: 75 },
      '2021/CSC/002': { ca: 58, exam: 55 },
      '2021/CSC/003': { ca: 45, exam: 42 },
      '2021/CSC/004': { ca: 30, exam: 28 },
    };

    for (const code of Object.keys(courseIds)) {
      const courseId = courseIds[code];

      // Create 2 CAs (out of 30 each) + 1 Exam (out of 70)
      const assessments = [
        { type: 'test', title: `${code} — CA 1`, max: 30, weight: 15 },
        { type: 'test', title: `${code} — CA 2`, max: 30, weight: 15 },
        { type: 'exam', title: `${code} — Exam`, max: 70, weight: 70 },
      ];

      for (const a of assessments) {
        const asRow = await client.query(`
          INSERT INTO assessments
            (course_id, session_id, semester_id, type, title, max_score, weight, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id;
        `, [courseId, sessionId, semesterId, a.type, a.title, a.max, a.weight, adminId]);
        const assessId = asRow.rows[0].id;

        for (const matric of Object.keys(studentIds)) {
          const profile = scoreProfile[matric];
          const basePct = a.type === 'exam' ? profile.exam : profile.ca;
          // Small variation between CA1 and CA2
          const variation = a.title.includes('CA 2') ? -3 : 2;
          const pct = Math.max(0, Math.min(100, basePct + variation));
          const score = +((pct / 100) * a.max).toFixed(2);

          await client.query(`
            INSERT INTO scores (assessment_id, student_id, score, entered_by)
            VALUES ($1, $2, $3, $4);
          `, [assessId, studentIds[matric], score, adminId]);
        }
      }
    }

    // ============================================================
    // 10. RESULTS (pre-computed for demo)
    // ============================================================
    console.log('[seed] Inserting results ...');
    // Total = CA_avg + Exam, grade by standard scale
    function computeGrade(total) {
      if (total >= 70) return { grade: 'A', gp: 5.0 };
      if (total >= 60) return { grade: 'B', gp: 4.0 };
      if (total >= 50) return { grade: 'C', gp: 3.0 };
      if (total >= 45) return { grade: 'D', gp: 2.0 };
      if (total >= 40) return { grade: 'E', gp: 1.0 };
      return { grade: 'F', gp: 0.0 };
    }

    for (const code of Object.keys(courseIds)) {
      const courseId = courseIds[code];

      for (const matric of Object.keys(studentIds)) {
        const profile = scoreProfile[matric];
        const ca = profile.ca;              // already an average
        const exam = profile.exam;
        const total = +((ca * 0.3 + exam * 0.7)).toFixed(2); // 30% CA + 70% Exam
        const { grade, gp } = computeGrade(total);

        await client.query(`
          INSERT INTO results
            (student_id, course_id, session_id, semester_id,
             ca_score, exam_score, total_score, grade, grade_point, is_published)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE);
        `, [studentIds[matric], courseId, sessionId, semesterId, ca, exam, total, grade, gp]);
      }
    }

    // ============================================================
    // 11. WELCOME NOTIFICATIONS
    // ============================================================
    console.log('[seed] Inserting notifications ...');
    for (const matric of Object.keys(studentIds)) {
      const st = await client.query('SELECT user_id FROM students WHERE id = $1', [studentIds[matric]]);
      const userId = st.rows[0].user_id;
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'Welcome to SMARTACADEMIC',
                'Your academic dashboard is ready. Check your attendance and results regularly.',
                'system');
      `, [userId]);
    }

    await client.query('COMMIT');
    console.log('[seed] ✅ Seed complete.');
    console.log('');
    console.log('Demo accounts (email / password):');
    console.log('  admin@smartacademic.edu          / Admin@123');
    console.log('  hod.csc@smartacademic.edu        / Hod@123');
    console.log('  lecturer.csc1@smartacademic.edu  / Lect@123');
    console.log('  student.a@smartacademic.edu      / Student@123  (GREEN)');
    console.log('  student.b@smartacademic.edu      / Student@123  (YELLOW)');
    console.log('  student.c@smartacademic.edu      / Student@123  (ORANGE)');
    console.log('  student.d@smartacademic.edu      / Student@123  (RED)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] ❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});