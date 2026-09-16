// ============================================================
// SMARTACADEMIC — Admin Model
// Aggregated stats + user management queries.
// ============================================================

'use strict';

const db = require('../config/db');

/* ============================================================
   DASHBOARD STATS
   ============================================================ */
async function getDashboardStats() {
  const [
    students, lecturers, departments, programmes, courses,
    riskDist, gpaAvg, attendanceAvg,
  ] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS n FROM students WHERE is_active = TRUE`),
    db.query(`SELECT COUNT(*)::int AS n FROM lecturers WHERE is_active = TRUE`),
    db.query(`SELECT COUNT(*)::int AS n FROM departments WHERE is_active = TRUE`),
    db.query(`SELECT COUNT(*)::int AS n FROM programmes WHERE is_active = TRUE`),
    db.query(`SELECT COUNT(*)::int AS n FROM courses WHERE is_active = TRUE`),

    db.query(`
      SELECT risk_category, COUNT(*)::int AS n
        FROM risk_assessments ra
       WHERE assessed_at = (
         SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
       )
       GROUP BY risk_category
    `),

    db.query(`
      SELECT ROUND(AVG(grade_point)::numeric, 2) AS gpa_avg
        FROM results
    `),

    db.query(`
      SELECT ROUND(
        (SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::numeric
         / NULLIF(COUNT(*), 0)) * 100, 2
      ) AS attendance_pct
        FROM attendance
    `),
  ]);

  const risk = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
  riskDist.rows.forEach(r => { risk[r.risk_category] = r.n; });

  const totalRisk = risk.GREEN + risk.YELLOW + risk.ORANGE + risk.RED;

  return {
    students:     students.rows[0].n,
    lecturers:    lecturers.rows[0].n,
    departments:  departments.rows[0].n,
    programmes:   programmes.rows[0].n,
    courses:      courses.rows[0].n,
    risk,
    riskTotal:    totalRisk,
    gpaAverage:   parseFloat(gpaAvg.rows[0].gpa_avg || 0),
    attendanceAverage: parseFloat(attendanceAvg.rows[0].attendance_pct || 0),
  };
}

/* ============================================================
   RECENT ACTIVITY
   ============================================================ */
async function getRecentActivity(limit = 8) {
  const result = await db.query(`
    SELECT al.id, al.action, al.module, al.created_at,
           u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT $1
  `, [limit]);
  return result.rows;
}

/* ============================================================
   RECENT HIGH-RISK STUDENTS
   ============================================================ */
async function getRecentHighRisk(limit = 6) {
  const result = await db.query(`
    SELECT s.id, s.matric_no, s.level,
           u.full_name, u.email,
           ra.risk_score, ra.risk_category, ra.assessed_at,
           d.name AS department_name
      FROM risk_assessments ra
      JOIN students s     ON s.id = ra.student_id
      JOIN users u        ON u.id = s.user_id
      JOIN departments d  ON d.id = s.department_id
     WHERE ra.risk_category IN ('ORANGE', 'RED')
       AND ra.assessed_at = (
         SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
       )
     ORDER BY ra.risk_score DESC
     LIMIT $1
  `, [limit]);
  return result.rows;
}

/* ============================================================
   WEEKLY ATTENDANCE TREND (last 8 weeks)
   ============================================================ */
async function getAttendanceTrend() {
  const result = await db.query(`
    SELECT
      TO_CHAR(DATE_TRUNC('week', cs.session_date), 'YYYY-MM-DD') AS week,
      ROUND(
        (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::numeric
         / NULLIF(COUNT(*), 0)) * 100, 2
      ) AS pct
      FROM attendance a
      JOIN class_sessions cs ON cs.id = a.class_session_id
     WHERE cs.session_date >= NOW() - INTERVAL '8 weeks'
     GROUP BY week
     ORDER BY week
  `);
  return result.rows;
}

/* ============================================================
   USERS CRUD
   ============================================================ */

async function listUsers({ role = null, search = null, isActive = null, limit = 50, offset = 0 } = {}) {
  const params = [];
  const where = [];

  if (role) {
    params.push(role);
    where.push(`r.name = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }
  if (isActive !== null) {
    params.push(isActive);
    where.push(`u.is_active = $${params.length}`);
  }

  params.push(limit, offset);

  const sql = `
    SELECT u.id, u.full_name, u.email, u.phone,
           u.is_active, u.must_change_pw,
           u.last_login_at, u.created_at,
           u.role_id, r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await db.query(sql, params);
  return result.rows;
}

async function countUsers(filters = {}) {
  const params = [];
  const where = [];

  if (filters.role) {
    params.push(filters.role);
    where.push(`r.name = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }
  if (filters.isActive !== null && filters.isActive !== undefined) {
    params.push(filters.isActive);
    where.push(`u.is_active = $${params.length}`);
  }

  const sql = `
    SELECT COUNT(*)::int AS n
      FROM users u
      JOIN roles r ON r.id = u.role_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `;
  const result = await db.query(sql, params);
  return result.rows[0].n;
}

async function getUserById(id) {
  const result = await db.query(`
    SELECT u.id, u.full_name, u.email, u.phone,
           u.is_active, u.must_change_pw, u.last_login_at, u.created_at,
           u.role_id, r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1
  `, [id]);
  return result.rows[0] || null;
}

async function updateUser(id, { full_name, email, phone, role_id, is_active }) {
  const result = await db.query(`
    UPDATE users
       SET full_name = COALESCE($2, full_name),
           email     = COALESCE($3, email),
           phone     = COALESCE($4, phone),
           role_id   = COALESCE($5, role_id),
           is_active = COALESCE($6, is_active)
     WHERE id = $1
     RETURNING id
  `, [id, full_name, email ? email.toLowerCase() : null, phone, role_id, is_active]);
  return result.rows[0] || null;
}

async function deleteUser(id) {
  // Hard delete cascades to profile tables
  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

async function setActive(id, isActive) {
  const result = await db.query(
    'UPDATE users SET is_active = $2 WHERE id = $1 RETURNING id, is_active',
    [id, isActive]
  );
  return result.rows[0] || null;
}

async function getRoleByName(name) {
  const result = await db.query('SELECT id, name FROM roles WHERE name = $1', [name]);
  return result.rows[0] || null;
}

async function listRoles() {
  const result = await db.query('SELECT id, name, description FROM roles ORDER BY id');
  return result.rows;
}

async function emailExists(email, excludeId = null) {
  const result = await db.query(
    `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) ${excludeId ? 'AND id <> $2' : ''}`,
    excludeId ? [email, excludeId] : [email]
  );
  return result.rows.length > 0;
}

/* ============================================================
   AUDIT LOG HELPER
   ============================================================ */
async function writeAudit({ user_id, action, module, affected_record = null, details = null, ip_address = null }) {
  try {
    await db.query(`
      INSERT INTO audit_logs (user_id, action, module, affected_record, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [user_id, action, module, affected_record, details ? JSON.stringify(details) : null, ip_address]);
  } catch (err) {
    console.error('[audit] Failed to write log:', err.message);
  }
}

module.exports = {
  getDashboardStats,
  getRecentActivity,
  getRecentHighRisk,
  getAttendanceTrend,
  listUsers,
  countUsers,
  getUserById,
  updateUser,
  deleteUser,
  setActive,
  getRoleByName,
  listRoles,
  emailExists,
  writeAudit,
};