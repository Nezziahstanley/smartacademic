// ============================================================
// SMARTACADEMIC — Attendance Engine
// Aggregates attendance and computes per-course percentages.
// ============================================================

'use strict';

const db = require('../config/db');

async function getAttendanceSummary(studentId, courseId = null) {
  const params = [studentId];
  const where = ['a.student_id = $1'];
  if (courseId) { params.push(courseId); where.push('cs.course_id = $2'); }

  const r = await db.query(`
    SELECT COUNT(*)::int AS total,
           SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
           SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END)::int AS absent,
           SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END)::int AS excused,
           ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
      FROM attendance a
      JOIN class_sessions cs ON cs.id = a.class_session_id
     WHERE ${where.join(' AND ')}
  `, params);
  return r.rows[0];
}

async function getAttendanceByCourse(studentId) {
  const r = await db.query(`
    SELECT c.id AS course_id, c.code, c.title,
           COUNT(*)::int AS total,
           SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
           ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
      FROM attendance a
      JOIN class_sessions cs ON cs.id = a.class_session_id
      JOIN courses c ON c.id = cs.course_id
     WHERE a.student_id = $1
     GROUP BY c.id, c.code, c.title
     ORDER BY c.code
  `, [studentId]);
  return r.rows;
}

async function getLowAttendanceStudents({ threshold = 75, departmentId = null } = {}) {
  const params = [threshold]; const where = [];
  if (departmentId) { params.push(departmentId); where.push(`s.department_id = $${params.length}`); }

  const r = await db.query(`
    SELECT s.id, s.matric_no, u.full_name,
           COUNT(*)::int AS total,
           SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
           ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      JOIN users u ON u.id = s.user_id
     WHERE 1=1 ${where.length ? 'AND ' + where.join(' AND ') : ''}
     GROUP BY s.id, s.matric_no, u.full_name
    HAVING (SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100 < $1
     ORDER BY pct ASC
  `, params);
  return r.rows;
}

module.exports = { getAttendanceSummary, getAttendanceByCourse, getLowAttendanceStudents };