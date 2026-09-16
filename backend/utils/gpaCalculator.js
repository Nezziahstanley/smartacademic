// ============================================================
// SMARTACADEMIC — GPA / CGPA Calculator
// Computes GPA per semester and CGPA overall, plus trend
// and failed-course counts used by the Risk Engine.
// ============================================================

'use strict';

const { scoreToGrade, isPass } = require('./gradeCalculator');

/**
 * Compute GPA from an array of results.
 * Each result must have: { units, grade_point } or { units, total_score }.
 *
 * GPA = Σ(units × grade_point) / Σ(units)
 */
function computeGPA(results) {
  if (!Array.isArray(results) || results.length === 0) return 0;

  let totalPoints = 0;
  let totalUnits  = 0;

  for (const r of results) {
    const units = Number(r.units) || 0;
    let gp;
    if (r.grade_point !== undefined && r.grade_point !== null) {
      gp = Number(r.grade_point);
    } else {
      gp = scoreToGrade(r.total_score).point;
    }
    totalPoints += units * gp;
    totalUnits  += units;
  }

  if (totalUnits === 0) return 0;
  return +(totalPoints / totalUnits).toFixed(2);
}

/**
 * Compute CGPA across all semesters.
 * Input: array of { units, grade_point | total_score } across all time.
 * Same formula as GPA but over the whole academic history.
 */
function computeCGPA(allResults) {
  return computeGPA(allResults);
}

/**
 * Compute semester-by-semester GPA trend.
 * Input: array of results where each has { session_id, semester_id, units, grade_point | total_score }
 * Output: array of { session_id, semester_id, gpa, units } sorted chronologically.
 */
function computeSemesterTrend(results) {
  if (!Array.isArray(results)) return [];

  const groups = new Map();
  for (const r of results) {
    const key = `${r.session_id}-${r.semester_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        session_id:  r.session_id,
        semester_id: r.semester_id,
        results:     [],
      });
    }
    groups.get(key).results.push(r);
  }

  const trend = [];
  for (const group of groups.values()) {
    trend.push({
      session_id:  group.session_id,
      semester_id: group.semester_id,
      gpa:         computeGPA(group.results),
      units:       group.results.reduce((s, r) => s + (Number(r.units) || 0), 0),
    });
  }

  // Sort by session then semester (assuming numeric IDs increment over time)
  trend.sort((a, b) => (a.session_id - b.session_id) || (a.semester_id - b.semester_id));
  return trend;
}

/**
 * Detect the GPA decline between the two most recent semesters.
 * Returns a positive number if there was a drop, 0 otherwise.
 */
function computeGPADecline(trend) {
  if (!Array.isArray(trend) || trend.length < 2) return 0;
  const prev = trend[trend.length - 2].gpa;
  const curr = trend[trend.length - 1].gpa;
  const drop = prev - curr;
  return drop > 0 ? +drop.toFixed(2) : 0;
}

/**
 * Count failed courses (grade F) from an array of results.
 */
function countFailed(results) {
  if (!Array.isArray(results)) return 0;
  return results.filter((r) => {
    const grade = r.grade || scoreToGrade(r.total_score).grade;
    return !isPass(grade);
  }).length;
}

/**
 * Full academic summary for a student.
 * @param {Array} results  All results for the student.
 * @returns {{
 *   gpa: number,
 *   cgpa: number,
 *   totalUnits: number,
 *   failedCourses: number,
 *   trend: Array,
 *   gpaDecline: number
 * }}
 */
function summarize(results) {
  const list = Array.isArray(results) ? results : [];
  const totalUnits = list.reduce((s, r) => s + (Number(r.units) || 0), 0);
  const cgpa       = computeCGPA(list);
  const trend      = computeSemesterTrend(list);
  const latestGPA  = trend.length > 0 ? trend[trend.length - 1].gpa : cgpa;
  const gpaDecline = computeGPADecline(trend);
  const failed     = countFailed(list);

  return {
    gpa: latestGPA,
    cgpa,
    totalUnits,
    failedCourses: failed,
    trend,
    gpaDecline,
  };
}

module.exports = {
  computeGPA,
  computeCGPA,
  computeSemesterTrend,
  computeGPADecline,
  countFailed,
  summarize,
};