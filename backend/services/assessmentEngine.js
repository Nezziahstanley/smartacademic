// ============================================================
// SMARTACADEMIC — Assessment Engine
// Aggregates CA / Exam scores with weighted scaling.
// ============================================================

'use strict';

const db = require('../config/db');

/**
 * Compute CA + Exam scores (0–30 and 0–70) for one student in one course.
 */
async function computeCourseScore(studentId, courseId) {
  const caRow = await db.query(`
    SELECT COALESCE(SUM((sc.score / NULLIF(a.max_score, 0)) * a.weight), 0) AS pct
      FROM scores sc
      JOIN assessments a ON a.id = sc.assessment_id
     WHERE sc.student_id = $1 AND a.course_id = $2
       AND a.type IN ('assignment','test','ca')
  `, [studentId, courseId]);

  const examRow = await db.query(`
    SELECT COALESCE(SUM((sc.score / NULLIF(a.max_score, 0)) * a.weight), 0) AS pct
      FROM scores sc
      JOIN assessments a ON a.id = sc.assessment_id
     WHERE sc.student_id = $1 AND a.course_id = $2
       AND a.type = 'exam'
  `, [studentId, courseId]);

  const caScore = Math.min(30, parseFloat(caRow.rows[0].pct || 0));
  const examScore = Math.min(70, parseFloat(examRow.rows[0].pct || 0));
  return { caScore, examScore, total: +(caScore + examScore).toFixed(2) };
}

async function getCourseAssessmentSummary(courseId) {
  const r = await db.query(`
    SELECT a.id, a.type, a.title, a.max_score, a.weight,
           COUNT(sc.id)::int AS scored,
           ROUND(AVG(sc.score)::numeric, 2) AS avg_score
      FROM assessments a
      LEFT JOIN scores sc ON sc.assessment_id = a.id
     WHERE a.course_id = $1
     GROUP BY a.id, a.type, a.title, a.max_score, a.weight
     ORDER BY a.created_at
  `, [courseId]);
  return r.rows;
}

module.exports = { computeCourseScore, getCourseAssessmentSummary };