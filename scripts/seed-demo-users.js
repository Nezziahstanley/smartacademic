// ============================================================
// Seed ONLY demo users (admin, HOD, lecturer, 4 students)
// Does NOT touch courses, departments, or programmes.
// Usage: node scripts/seed-demo-users.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
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
});

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Roles
    const roles = await client.query('SELECT id, name FROM roles');
    if (roles.rows.length === 0) {
      console.log('Seeding roles...');
      await client.query(`
        INSERT INTO roles (name, description) VALUES
          ('admin', 'System administrator'),
          ('hod', 'Head of Department'),
          ('lecturer', 'Lecturer'),
          ('student', 'Student')
      `);
    }
    const roleRows = await client.query('SELECT id, name FROM roles');
    const roleId = Object.fromEntries(roleRows.rows.map(r => [r.name, r.id]));

    // 2. Ensure CSC department exists
    let csDept = await client.query("SELECT id FROM departments WHERE code = 'CSC' LIMIT 1");
    let csDeptId;
    if (csDept.rows.length === 0) {
      console.log('Creating CSC department...');
      const d = await client.query(
        "INSERT INTO departments (name, code) VALUES ('Computer Science', 'CSC') RETURNING id"
      );
      csDeptId = d.rows[0].id;
    } else {
      csDeptId = csDept.rows[0].id;
    }

    // 3. Ensure CSC-ND programme exists
    let csProg = await client.query("SELECT id FROM programmes WHERE code = 'CSC-ND' LIMIT 1");
    let csProgId;
    if (csProg.rows.length === 0) {
      console.log('Creating CSC-ND programme...');
      const p = await client.query(
        "INSERT INTO programmes (name, code, department_id, duration_years) VALUES ('ND Computer Science', 'CSC-ND', $1, 2) RETURNING id",
        [csDeptId]
      );
      csProgId = p.rows[0].id;
    } else {
      csProgId = csProg.rows[0].id;
    }

    // 4. Hash passwords
    const adminPw = await bcrypt.hash('Admin@123', BCRYPT_ROUNDS);
    const hodPw   = await bcrypt.hash('Hod@123', BCRYPT_ROUNDS);
    const lectPw  = await bcrypt.hash('Lect@123', BCRYPT_ROUNDS);
    const studPw  = await bcrypt.hash('Student@123', BCRYPT_ROUNDS);

    // 5. Admin
    const adminExists = await client.query("SELECT id FROM users WHERE email = 'admin@smartacademic.edu'");
    if (adminExists.rows.length === 0) {
      await client.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id)
        VALUES ('System Administrator', 'admin@smartacademic.edu', '+2348000000001', $1, $2)
      `, [adminPw, roleId.admin]);
      console.log('✅ Admin: admin@smartacademic.edu / Admin@123');
    } else {
      console.log('ℹ️  Admin already exists');
    }

    // 6. HOD
    const hodExists = await client.query("SELECT id FROM users WHERE email = 'hod.csc@smartacademic.edu'");
    let hodUserId;
    if (hodExists.rows.length === 0) {
      const h = await client.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id)
        VALUES ('Dr. Adebayo Okonkwo', 'hod.csc@smartacademic.edu', '+2348000000002', $1, $2)
        RETURNING id
      `, [hodPw, roleId.hod]);
      hodUserId = h.rows[0].id;
      console.log('✅ HOD: hod.csc@smartacademic.edu / Hod@123');
    } else {
      hodUserId = hodExists.rows[0].id;
    }
    await client.query('UPDATE departments SET hod_id = $1 WHERE id = $2', [hodUserId, csDeptId]);

    // 7. Lecturer
    const lectExists = await client.query("SELECT id FROM users WHERE email = 'lecturer.csc1@smartacademic.edu'");
    if (lectExists.rows.length === 0) {
      const l = await client.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id)
        VALUES ('Dr. Chidinma Eze', 'lecturer.csc1@smartacademic.edu', '+2348000000010', $1, $2)
        RETURNING id
      `, [lectPw, roleId.lecturer]);
      await client.query(`
        INSERT INTO lecturers (user_id, staff_id, department_id, title)
        VALUES ($1, 'FPU/CSC/L001', $2, 'Dr.')
      `, [l.rows[0].id, csDeptId]);
      console.log('✅ Lecturer: lecturer.csc1@smartacademic.edu / Lect@123');
    } else {
      console.log('ℹ️  Lecturer already exists');
    }

    // 8. Students
    const students = [
      { name: 'Student A (Good)',      email: 'student.a@smartacademic.edu', matric: 'FPU/CSC/ND/24/001' },
      { name: 'Student B (Attention)', email: 'student.b@smartacademic.edu', matric: 'FPU/CSC/ND/24/002' },
      { name: 'Student C (High Risk)', email: 'student.c@smartacademic.edu', matric: 'FPU/CSC/ND/24/003' },
      { name: 'Student D (Critical)',  email: 'student.d@smartacademic.edu', matric: 'FPU/CSC/ND/24/004' },
    ];

    for (const s of students) {
      const exists = await client.query('SELECT id FROM users WHERE email = $1', [s.email]);
      if (exists.rows.length > 0) {
        console.log(`ℹ️  ${s.email} already exists`);
        continue;
      }
      const u = await client.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id)
        VALUES ($1, $2, '+2348000000020', $3, $4)
        RETURNING id
      `, [s.name, s.email, studPw, roleId.student]);
      await client.query(`
        INSERT INTO students (user_id, matric_no, department_id, programme_id, level, admission_year)
        VALUES ($1, $2, $3, $4, 100, 2024)
      `, [u.rows[0].id, s.matric, csDeptId, csProgId]);
      console.log(`✅ ${s.email} / Student@123`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Demo users seeded successfully.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
})();