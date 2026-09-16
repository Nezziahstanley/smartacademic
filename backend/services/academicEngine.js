// ============================================================
// SMARTACADEMIC — Academic Engine
// Aggregates scores + attendance → results → GPA/CGPA
// Runs in batches. Idempotent (safe to re-run).
// ============================================================

'use strict';

const db = require('../config/db');
const { computeTotal, scoreToGrade } = require('../utils/gradeCalculator');
const { computeGPA, computeSemesterTrend, computeGPADecline, countFailed } = require('../utils/gpaCalculator');

/* ============================================================
   1. RECOMPUTE RESULTS FROM SCORES
   For each student × course × session × semester:
     - CA average = mean of assignment/test/ca scores (weighted)
     - Exam score  = exam score(s)
     - Total       = 0.3 * CA + 0.7 * Exam  (already scaled to 100)
     - Grade + grade point from total
   ============================================================ */
async function recomputeResults({ sessionId = null, semesterId = null } = {}) {
  const params = []; const where = [];
  if (sessionId)  { params.push(sessionId);  where.push(`a.session_id = $${params.length}`); }
  if (semesterId) { params.push(semesterId); where.push(`a.semester_id = $${params.length}`); }

  // Find distinct (student, course, session, semester) tuples that have scores
  const tuples = await db.query(`
    SELECT DISTINCT
           sc.student_id,
           a.course_id,
           a.session_id,
           a.semester_id
      FROM scores sc
      JOIN assessments a ON a.id = sc.assessment_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `, params);

  let updated = 0;

  for (const t of tuples.rows) {
    // CA: all assessment types EXCEPT exam → scaled to 30
    const caRow = await db.query(`
      SELECT
        COALESCE(SUM((sc.score / NULLIF(a.max_score, 0)) * a.weight), 0) AS weighted_pct
        FROM scores sc
        JOIN assessments a ON a.id = sc.assessment_id
       WHERE sc.student_id = $1 AND a.course_id = $2
         AND a.session_id = $3 AND a.semester_id = $4
         AND a.type IN ('assignment','test','ca')
    `, [t.student_id, t.course_id, t.session_id, t.semester_id]);

    const caPct = parseFloat(caRow.rows[0].weighted_pct || 0); // 0–30 weight-capped
    const caScore = Math.min(30, caPct);

    // Exam: type = 'exam' → scaled to 70
    const examRow = await db.query(`
      SELECT
        COALESCE(SUM((sc.score / NULLIF(a.max_score, 0)) * a.weight), 0) AS weighted_pct
        FROM scores sc
        JOIN assessments a ON a.id = sc.assessment_id
       WHERE sc.student_id = $1 AND a.course_id = $2
         AND a.session_id = $3 AND a.semester_id = $4
         AND a.type = 'exam'
    `, [t.student_id, t.course_id, t.session_id, t.semester_id]);

    const examPct = parseFloat(examRow.rows[0].weighted_pct || 0); // 0–70 weight-capped
    const examScore = Math.min(70, examPct);

    const total = +(caScore + examScore).toFixed(2);
    const { grade, point } = scoreToGrade(total);

    // Upsert
    await db.query(`
      INSERT INTO results
        (student_id, course_id, session_id, semester_id,
         ca_score, exam_score, total_score, grade, grade_point)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (student_id, course_id, session_id, semester_id) DO UPDATE
         SET ca_score = EXCLUDED.ca_score,
             exam_score = EXCLUDED.exam_score,
             total_score = EXCLUDED.total_score,
             grade = EXCLUDED.grade,
             grade_point = EXCLUDED.grade_point,
             computed_at = NOW()
    `, [t.student_id, t.course_id, t.session_id, t.semester_id,
        caScore, examScore, total, grade, point]);

    updated++;
  }

  return { updated };
}

/* ============================================================
   2. COMPUTE STUDENT PERFORMANCE SNAPSHOT
   For a single student: GPA, CGPA, semester trend, failed courses.
   ============================================================ */
async function computeStudentPerformance(studentId) {
  const r = await db.query(`
    SELECT r.id, r.student_id, r.course_id, r.session_id, r.semester_id,
           r.ca_score, r.exam_score, r.total_score, r.grade, r.grade_point,
           c.units
      FROM results r
      JOIN courses c ON c.id = r.course_id
     WHERE r.student_id = $1
       AND r.is_published = TRUE
  `, [studentId]);

  const rows = r.rows;
  const cgpa = computeGPA(rows);
  const trend = computeSemesterTrend(rows);
  const latestGpa = trend.length ? trend[trend.length - 1].gpa : cgpa;
  const gpaDecline = computeGPADecline(trend);
  const failedCourses = countFailed(rows);

  // Attendance summary
  const attn = await db.query(`
    SELECT COUNT(*)::int AS total,
           SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::int AS present,
           ROUND((SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
      FROM attendance WHERE student_id = $1
  `, [studentId]);

  // CA / Exam averages
  const avg = await db.query(`
    SELECT ROUND(AVG(ca_score)::numeric, 2) AS ca_avg,
           ROUND(AVG(exam_score)::numeric, 2) AS exam_avg
      FROM results WHERE student_id = $1
  `, [studentId]);

  return {
    gpa: latestGpa,
    cgpa,
    gpaDecline,
    failedCourses,
    trend,
    attendancePct: parseFloat(attn.rows[0].pct || 0),
    caAvg: parseFloat(avg.rows[0].ca_avg || 0),
    examAvg: parseFloat(avg.rows[0].exam_avg || 0),
  };
}

/* ============================================================
   3. RECOMPUTE FOR ALL STUDENTS
   ============================================================ */
async function recomputeAllResults(opts = {}) {
  return recomputeResults(opts);
}

module.exports = {
  recomputeResults,
  recomputeAllResults,
  computeStudentPerformance,
};