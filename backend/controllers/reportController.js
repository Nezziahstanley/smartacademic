'use strict';
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function studentReport(req, res, next) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [info, results, attendance, risk, interventions] = await Promise.all([
      db.query(`
        SELECT s.id, s.matric_no, s.level, s.admission_year,
               u.full_name, u.email, u.phone,
               d.name AS department_name, p.name AS programme_name
          FROM students s
          JOIN users u ON u.id = s.user_id
          JOIN departments d ON d.id = s.department_id
          JOIN programmes p ON p.id = s.programme_id
         WHERE s.id = $1
      `, [studentId]),
      db.query(`
        SELECT r.*, c.code, c.title, c.units, sess.name AS session_name, sem.name AS semester_name
          FROM results r
          JOIN courses c ON c.id = r.course_id
          JOIN sessions sess ON sess.id = r.session_id
          JOIN semesters sem ON sem.id = r.semester_id
         WHERE r.student_id = $1
         ORDER BY r.computed_at DESC
      `, [studentId]),
      db.query(`
        SELECT COUNT(*)::int AS total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::int AS present,
               ROUND((SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
          FROM attendance WHERE student_id = $1
      `, [studentId]),
      db.query(`
        SELECT * FROM risk_assessments WHERE student_id = $1 ORDER BY assessed_at DESC LIMIT 5
      `, [studentId]),
      db.query(`
        SELECT i.*, u.full_name AS assignee_name
          FROM interventions i
          LEFT JOIN users u ON u.id = i.assigned_to
         WHERE i.student_id = $1
         ORDER BY i.created_at DESC
      `, [studentId]),
    ]);

    if (!info.rows[0]) throw new AppError('Student not found.', 404);

    res.json({
      success: true,
      data: {
        student: info.rows[0],
        results: results.rows,
        attendance: attendance.rows[0],
        risk: risk.rows,
        interventions: interventions.rows,
      },
    });
  } catch (err) { next(err); }
}

async function attendanceReport(req, res, next) {
  try {
    const { course_id } = req.query;
    const params = []; const where = [];
    if (course_id) { params.push(parseInt(course_id, 10)); where.push(`cs.course_id = $${params.length}`); }
    const r = await db.query(`
      SELECT u.full_name, s.matric_no, c.code, c.title,
             COUNT(*)::int AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
        JOIN courses c ON c.id = cs.course_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY u.full_name, s.matric_no, c.code, c.title
       ORDER BY pct ASC NULLS LAST
       LIMIT 500
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function riskReport(req, res, next) {
  try {
    const r = await db.query(`
      SELECT ra.risk_category, COUNT(*)::int AS n
        FROM risk_assessments ra
       WHERE ra.assessed_at = (
         SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
       )
       GROUP BY ra.risk_category
       ORDER BY ra.risk_category
    `);
    const byDept = await db.query(`
      SELECT d.name AS department_name, ra.risk_category, COUNT(*)::int AS n
        FROM risk_assessments ra
        JOIN students s ON s.id = ra.student_id
        JOIN departments d ON d.id = s.department_id
       WHERE ra.assessed_at = (
         SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
       )
       GROUP BY d.name, ra.risk_category
       ORDER BY d.name, ra.risk_category
    `);
    res.json({ success: true, data: { summary: r.rows, byDepartment: byDept.rows } });
  } catch (err) { next(err); }
}

async function performanceReport(req, res, next) {
  try {
    const r = await db.query(`
      SELECT d.name AS department_name, s.level,
             COUNT(DISTINCT s.id)::int AS student_count,
             ROUND(AVG(r.grade_point)::numeric, 2) AS avg_gpa
        FROM students s
        JOIN departments d ON d.id = s.department_id
        LEFT JOIN results r ON r.student_id = s.id
       GROUP BY d.name, s.level
       ORDER BY d.name, s.level
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

module.exports = { studentReport, attendanceReport, riskReport, performanceReport };