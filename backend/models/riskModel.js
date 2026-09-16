// ============================================================
// SMARTACADEMIC — Risk & Intervention Model
// ============================================================

'use strict';

const db = require('../config/db');

/* ==================== RISK ASSESSMENTS ==================== */
async function listRisk({
  category = null, departmentId = null, level = null, search = null,
  limit = 50, offset = 0,
} = {}) {
  const params = []; const where = [];

  if (category)     { params.push(category);     where.push(`ra.risk_category = $${params.length}`); }
  if (departmentId) { params.push(departmentId); where.push(`s.department_id = $${params.length}`); }
  if (level)        { params.push(level);        where.push(`s.level = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`);
  }

  params.push(limit, offset);

  const sql = `
    SELECT ra.id, ra.risk_score, ra.risk_category,
           ra.attendance_pct, ra.ca_avg, ra.exam_avg, ra.failed_courses,
           ra.gpa, ra.cgpa, ra.gpa_decline, ra.factors, ra.assessed_at,
           s.id AS student_id, s.matric_no, s.level,
           u.full_name, u.email,
           d.name AS department_name, d.id AS department_id
      FROM risk_assessments ra
      JOIN students s     ON s.id = ra.student_id
      JOIN users u        ON u.id = s.user_id
      JOIN departments d  ON d.id = s.department_id
     WHERE ra.assessed_at = (
       SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
     )
     ${where.length ? 'AND ' + where.join(' AND ') : ''}
     ORDER BY
       CASE ra.risk_category
         WHEN 'RED' THEN 1
         WHEN 'ORANGE' THEN 2
         WHEN 'YELLOW' THEN 3
         ELSE 4
       END,
       ra.risk_score DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const r = await db.query(sql, params);
  return r.rows;
}

async function countRisk(filters = {}) {
  const params = []; const where = [];
  if (filters.category)     { params.push(filters.category);     where.push(`ra.risk_category = $${params.length}`); }
  if (filters.departmentId) { params.push(filters.departmentId); where.push(`s.department_id = $${params.length}`); }
  if (filters.level)        { params.push(filters.level);        where.push(`s.level = $${params.length}`); }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`);
  }
  const r = await db.query(`
    SELECT COUNT(*)::int AS n
      FROM risk_assessments ra
      JOIN students s ON s.id = ra.student_id
      JOIN users u    ON u.id = s.user_id
     WHERE ra.assessed_at = (
       SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
     )
     ${where.length ? 'AND ' + where.join(' AND ') : ''}
  `, params);
  return r.rows[0].n;
}

async function getRiskSummary() {
  const r = await db.query(`
    SELECT ra.risk_category, COUNT(*)::int AS n
      FROM risk_assessments ra
     WHERE ra.assessed_at = (
       SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
     )
     GROUP BY ra.risk_category
  `);
  const summary = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
  r.rows.forEach(row => { summary[row.risk_category] = row.n; });
  return summary;
}

async function getRiskHistory(studentId) {
  const r = await db.query(`
    SELECT ra.id, ra.risk_score, ra.risk_category, ra.assessed_at,
           ra.attendance_pct, ra.ca_avg, ra.exam_avg, ra.failed_courses,
           ra.gpa, ra.cgpa, ra.factors
      FROM risk_assessments ra
     WHERE ra.student_id = $1
     ORDER BY ra.assessed_at DESC
     LIMIT 20
  `, [studentId]);
  return r.rows;
}

async function getRiskDetail(id) {
  const r = await db.query(`
    SELECT ra.*, s.matric_no, s.level,
           u.full_name, u.email,
           d.name AS department_name
      FROM risk_assessments ra
      JOIN students s     ON s.id = ra.student_id
      JOIN users u        ON u.id = s.user_id
      JOIN departments d  ON d.id = s.department_id
     WHERE ra.id = $1
  `, [id]);
  return r.rows[0] || null;
}

async function createRiskAssessment(data) {
  const r = await db.query(`
    INSERT INTO risk_assessments
      (student_id, session_id, semester_id, risk_score, risk_category,
       attendance_pct, ca_avg, exam_avg, failed_courses, gpa, cgpa, gpa_decline, factors)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id
  `, [data.student_id, data.session_id, data.semester_id,
      data.risk_score, data.risk_category,
      data.attendance_pct, data.ca_avg, data.exam_avg,
      data.failed_courses, data.gpa, data.cgpa, data.gpa_decline,
      data.factors || null]);
  return r.rows[0];
}

/* ==================== INTERVENTIONS ==================== */
async function listInterventions({
  status = null, type = null, priority = null,
  assignedTo = null, studentId = null,
  search = null, limit = 50, offset = 0,
} = {}) {
  const params = []; const where = [];

  if (status)     { params.push(status);     where.push(`i.status = $${params.length}`); }
  if (type)       { params.push(type);       where.push(`i.type = $${params.length}`); }
  if (priority)   { params.push(priority);   where.push(`i.priority = $${params.length}`); }
  if (assignedTo) { params.push(assignedTo); where.push(`i.assigned_to = $${params.length}`); }
  if (studentId)  { params.push(studentId);  where.push(`i.student_id = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(i.title) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length})`);
  }

  params.push(limit, offset);

  const r = await db.query(`
    SELECT i.id, i.type, i.title, i.description, i.priority, i.status,
           i.notes, i.due_date, i.completed_at, i.created_at, i.updated_at,
           i.student_id, i.assigned_to, i.risk_assessment_id,
           u.full_name AS student_name, s.matric_no,
           a.full_name AS assignee_name
      FROM interventions i
      JOIN students s     ON s.id = i.student_id
      JOIN users u        ON u.id = s.user_id
      LEFT JOIN users a   ON a.id = i.assigned_to
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY
       CASE i.priority
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         ELSE 4
       END,
       i.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return r.rows;
}

async function countInterventions(filters = {}) {
  const params = []; const where = [];
  if (filters.status)     { params.push(filters.status);     where.push(`i.status = $${params.length}`); }
  if (filters.type)       { params.push(filters.type);       where.push(`i.type = $${params.length}`); }
  if (filters.priority)   { params.push(filters.priority);   where.push(`i.priority = $${params.length}`); }
  if (filters.assignedTo) { params.push(filters.assignedTo); where.push(`i.assigned_to = $${params.length}`); }
  if (filters.studentId)  { params.push(filters.studentId);  where.push(`i.student_id = $${params.length}`); }
  const r = await db.query(`
    SELECT COUNT(*)::int AS n FROM interventions i
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `, params);
  return r.rows[0].n;
}

async function getIntervention(id) {
  const r = await db.query(`
    SELECT i.*,
           u.full_name AS student_name, s.matric_no,
           a.full_name AS assignee_name,
           ra.risk_category, ra.risk_score
      FROM interventions i
      JOIN students s    ON s.id = i.student_id
      JOIN users u       ON u.id = s.user_id
      LEFT JOIN users a  ON a.id = i.assigned_to
      LEFT JOIN risk_assessments ra ON ra.id = i.risk_assessment_id
     WHERE i.id = $1
  `, [id]);
  return r.rows[0] || null;
}

async function createIntervention(data) {
  const r = await db.query(`
    INSERT INTO interventions
      (student_id, risk_assessment_id, type, title, description, assigned_to,
       priority, status, notes, due_date, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id
  `, [data.student_id, data.risk_assessment_id || null,
      data.type, data.title, data.description || null,
      data.assigned_to || null, data.priority || 'medium',
      data.status || 'Pending', data.notes || null,
      data.due_date || null, data.created_by || null]);
  return r.rows[0];
}

async function updateIntervention(id, data) {
  await db.query(`
    UPDATE interventions SET
      type = COALESCE($2, type),
      title = COALESCE($3, title),
      description = COALESCE($4, description),
      assigned_to = $5,
      priority = COALESCE($6, priority),
      status = COALESCE($7, status),
      notes = COALESCE($8, notes),
      due_date = $9,
      completed_at = CASE WHEN $7 = 'Completed' AND completed_at IS NULL THEN NOW()
                          WHEN $7 <> 'Completed' THEN NULL
                          ELSE completed_at END
     WHERE id = $1
  `, [id, data.type, data.title, data.description,
      data.assigned_to === undefined ? null : data.assigned_to,
      data.priority, data.status, data.notes,
      data.due_date === undefined ? null : data.due_date]);
}

async function deleteIntervention(id) {
  await db.query('DELETE FROM interventions WHERE id = $1', [id]);
}

/* ==================== STAFF CANDIDATES ==================== */
async function listStaffCandidates() {
  const r = await db.query(`
    SELECT u.id, u.full_name, u.email, r.name AS role
      FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = TRUE AND r.name IN ('admin', 'hod', 'lecturer')
     ORDER BY u.full_name
  `);
  return r.rows;
}

/* ==================== STUDENT LOOKUP ==================== */
async function listStudentsForSelect() {
  const r = await db.query(`
    SELECT s.id, s.matric_no, s.level, u.full_name, d.name AS department_name
      FROM students s
      JOIN users u ON u.id = s.user_id
      JOIN departments d ON d.id = s.department_id
     WHERE s.is_active = TRUE
     ORDER BY u.full_name
  `);
  return r.rows;
}

module.exports = {
  listRisk, countRisk, getRiskSummary, getRiskHistory, getRiskDetail, createRiskAssessment,
  listInterventions, countInterventions, getIntervention, createIntervention, updateIntervention, deleteIntervention,
  listStaffCandidates, listStudentsForSelect,
};