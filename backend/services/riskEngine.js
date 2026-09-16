// ============================================================
// SMARTACADEMIC — Risk Engine
// Runs academicEngine.computeStudentPerformance() → classify()
// → upsert risk_assessments + notify authorized staff.
// ============================================================

'use strict';

const db = require('../config/db');
const { computeStudentPerformance } = require('./academicEngine');
const { classify } = require('../utils/riskClassifier');
const { recomputeResults } = require('./academicEngine');

/* ============================================================
   LOAD CONFIG from `settings` table
   ============================================================ */
async function loadConfig() {
  const r = await db.query(`SELECT key, value FROM settings WHERE category IN ('risk','attendance','assessment')`);
  const cfg = { weights: {}, thresholds: {} };
  const map = {
    risk_weight_attendance: ['weights', 'attendance', 'int'],
    risk_weight_ca:         ['weights', 'ca', 'int'],
    risk_weight_exam:       ['weights', 'exam', 'int'],
    risk_weight_failed:     ['weights', 'failed', 'int'],
    risk_weight_gpa_decline:['weights', 'gpaDecline', 'int'],
    attendance_threshold:   ['thresholds', 'attendanceWarn', 'int'],
    attendance_warning:     ['thresholds', 'attendanceLow', 'int'],
    ca_threshold:           ['thresholds', 'caLow', 'int'],
    exam_threshold:         ['thresholds', 'examLow', 'int'],
    risk_yellow_min:        ['thresholds', 'yellowMin', 'int'],
    risk_orange_min:        ['thresholds', 'orangeMin', 'int'],
    risk_red_min:           ['thresholds', 'redMin', 'int'],
  };
  for (const row of r.rows) {
    const meta = map[row.key];
    if (!meta) continue;
    const [group, key, type] = meta;
    cfg[group][key] = type === 'int' ? parseInt(row.value, 10) : row.value;
  }
  return cfg;
}

/* ============================================================
   ASSESS ONE STUDENT
   ============================================================ */
async function assessStudent(studentId, sessionId, semesterId, cfg = null) {
  const perf = await computeStudentPerformance(studentId);
  const { score, category, factors } = classify(perf, cfg || {});
  const factorText = factors.join('; ');

  // Upsert risk assessment (one per student+session+semester)
  const existing = await db.query(`
    SELECT id FROM risk_assessments
     WHERE student_id = $1 AND session_id = $2 AND semester_id = $3
  `, [studentId, sessionId, semesterId]);

  if (existing.rows[0]) {
    await db.query(`
      UPDATE risk_assessments SET
        risk_score = $2,
        risk_category = $3,
        attendance_pct = $4,
        ca_avg = $5,
        exam_avg = $6,
        failed_courses = $7,
        gpa = $8,
        cgpa = $9,
        gpa_decline = $10,
        factors = $11,
        assessed_at = NOW()
       WHERE id = $1
    `, [existing.rows[0].id, score, category,
        perf.attendancePct, perf.caAvg, perf.examAvg,
        perf.failedCourses, perf.gpa, perf.cgpa, perf.gpaDecline,
        factorText]);
    return { id: existing.rows[0].id, score, category, changed: true };
  }

  const r = await db.query(`
    INSERT INTO risk_assessments
      (student_id, session_id, semester_id, risk_score, risk_category,
       attendance_pct, ca_avg, exam_avg, failed_courses, gpa, cgpa, gpa_decline, factors)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id
  `, [studentId, sessionId, semesterId, score, category,
      perf.attendancePct, perf.caAvg, perf.examAvg,
      perf.failedCourses, perf.gpa, perf.cgpa, perf.gpaDecline, factorText]);

  return { id: r.rows[0].id, score, category, changed: true };
}

/* ============================================================
   ASSESS ALL STUDENTS (batch)
   ============================================================ */
async function assessAllStudents({ sessionId = null, semesterId = null } = {}) {
  // Determine active session + semester if not given
  let sess = sessionId;
  let sem = semesterId;

  if (!sess) {
    const r = await db.query(`SELECT id FROM sessions WHERE is_active = TRUE LIMIT 1`);
    sess = r.rows[0]?.id;
  }
  if (!sem) {
    const r = await db.query(`SELECT id FROM semesters WHERE is_active = TRUE LIMIT 1`);
    sem = r.rows[0]?.id;
  }
  if (!sess || !sem) throw new Error('No active session/semester. Set them in Settings.');

  const cfg = await loadConfig();

  const students = await db.query(`SELECT id FROM students WHERE is_active = TRUE`);
  const results = [];
  for (const s of students.rows) {
    try {
      const r = await assessStudent(s.id, sess, sem, cfg);
      results.push({ student_id: s.id, ...r });
    } catch (err) {
      console.error(`[riskEngine] Student ${s.id} failed:`, err.message);
      results.push({ student_id: s.id, error: err.message });
    }
  }

  return { count: students.rows.length, sessionId: sess, semesterId: sem, results };
}

/* ============================================================
   RECOMPUTE EVERYTHING (academic + risk)
   This is what /api/admin/risk/recompute calls
   ============================================================ */
async function fullRecompute(opts = {}) {
  // 1. Recompute results from scores
  const resultsInfo = await recomputeResults(opts);

  // 2. Recompute risk for all students
  const riskInfo = await assessAllStudents(opts);

  return { results: resultsInfo, risk: riskInfo };
}

module.exports = {
  loadConfig,
  assessStudent,
  assessAllStudents,
  fullRecompute,
};