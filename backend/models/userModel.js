// ============================================================
// SMARTACADEMIC — User Model
// All SQL for the `users`, `roles`, `students`, `lecturers`,
// and `departments` tables related to account management.
// ============================================================

'use strict';

const db = require('../config/db');

/**
 * Find a user by email (case-insensitive), joined with role name.
 */
async function findByEmail(email) {
  const result = await db.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.password_hash,
            u.is_active, u.must_change_pw, u.role_id,
            r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find a user by id (joined with role name).
 */
async function findById(id) {
  const result = await db.query(
    `SELECT u.id, u.full_name, u.email, u.phone,
            u.is_active, u.must_change_pw, u.role_id,
            r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
      LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a new user account.
 * @returns {Promise<{id:number}>} the new user id
 */
async function createUser({ full_name, email, phone, password_hash, role_id }) {
  const result = await db.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [full_name, email.toLowerCase(), phone || null, password_hash, role_id]
  );
  return result.rows[0];
}

/**
 * Get role id by name (e.g., 'student', 'lecturer', 'admin', 'hod').
 */
async function getRoleIdByName(name) {
  const result = await db.query(
    'SELECT id FROM roles WHERE name = $1',
    [name]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

/**
 * Update password hash for a user.
 */
async function updatePassword(userId, passwordHash) {
  await db.query(
    'UPDATE users SET password_hash = $1, must_change_pw = FALSE WHERE id = $2',
    [passwordHash, userId]
  );
}

/**
 * Update last login timestamp.
 */
async function touchLastLogin(userId) {
  await db.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [userId]
  );
}

/**
 * List students (with user + department + programme info).
 * Used by admin user management.
 */
async function listStudents({ departmentId = null, search = null, limit = 100, offset = 0 } = {}) {
  const params = [];
  const where = ['u.is_active = TRUE'];

  if (departmentId) {
    params.push(departmentId);
    where.push(`s.department_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`);
  }

  params.push(limit, offset);
  const sql = `
    SELECT s.id, s.matric_no, s.level, s.admission_year,
           u.id AS user_id, u.full_name, u.email, u.phone, u.is_active,
           d.id AS department_id, d.name AS department_name,
           p.id AS programme_id, p.name AS programme_name
      FROM students s
      JOIN users u        ON u.id = s.user_id
      JOIN departments d  ON d.id = s.department_id
      JOIN programmes p   ON p.id = s.programme_id
     WHERE ${where.join(' AND ')}
     ORDER BY u.full_name
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await db.query(sql, params);
  return result.rows;
}

/**
 * Create a student profile linked to a user.
 */
async function createStudentProfile({ user_id, matric_no, department_id, programme_id, level, admission_year }) {
  const result = await db.query(
    `INSERT INTO students
       (user_id, matric_no, department_id, programme_id, level, admission_year)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [user_id, matric_no, department_id, programme_id, level, admission_year]
  );
  return result.rows[0];
}

/**
 * Create a lecturer profile linked to a user.
 */
async function createLecturerProfile({ user_id, staff_id, department_id, title }) {
  const result = await db.query(
    `INSERT INTO lecturers (user_id, staff_id, department_id, title)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [user_id, staff_id, department_id, title || null]
  );
  return result.rows[0];
}

/**
 * Check if department exists.
 */
async function departmentExists(id) {
  const result = await db.query('SELECT 1 FROM departments WHERE id = $1', [id]);
  return result.rows.length > 0;
}

/**
 * Check if programme exists.
 */
async function programmeExists(id) {
  const result = await db.query('SELECT 1 FROM programmes WHERE id = $1', [id]);
  return result.rows.length > 0;
}

/**
 * Check if matric number or staff id is already taken.
 */
async function matricExists(matric_no) {
  const r = await db.query('SELECT 1 FROM students WHERE matric_no = $1', [matric_no]);
  return r.rows.length > 0;
}

async function staffIdExists(staff_id) {
  const r = await db.query('SELECT 1 FROM lecturers WHERE staff_id = $1', [staff_id]);
  return r.rows.length > 0;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  getRoleIdByName,
  updatePassword,
  touchLastLogin,
  listStudents,
  createStudentProfile,
  createLecturerProfile,
  departmentExists,
  programmeExists,
  matricExists,
  staffIdExists,
};