// ============================================================
// SMARTACADEMIC — Performance Engine
// Trend analysis + academic decline detection.
// ============================================================

'use strict';

const { computeStudentPerformance } = require('./academicEngine');

async function getPerformanceSnapshot(studentId) {
  return computeStudentPerformance(studentId);
}

async function getCohortPerformance({ departmentId = null, level = null } = {}) {
  const db = require('../config/db');
  const params = []; const where = [];
  if (departmentId) { params.push(departmentId); where.push(`s.department_id = $${params.length}`); }
  if (level)        { params.push(level);        where.push(`s.level = $${params.length}`); }

  const r = await db.query(`
    SELECT s.id, s.matric_no, s.level, u.full_name,
           ROUND(AVG(r.grade_point)::numeric, 2) AS gpa,
           COUNT(r.id) FILTER (WHERE r.grade = 'F')::int AS failed
      FROM students s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN results r ON r.student_id = s.id
     WHERE 1=1 ${where.length ? 'AND ' + where.join(' AND ') : ''}
     GROUP BY s.id, s.matric_no, s.level, u.full_name
     ORDER BY gpa ASC NULLS LAST
  `, params);
  return r.rows;
}

module.exports = { getPerformanceSnapshot, getCohortPerformance };