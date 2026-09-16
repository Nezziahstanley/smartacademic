// ============================================================
// SMARTACADEMIC — Grade Calculator
// Standard 5.0 grading scale used by Nigerian universities.
// Total score (0–100) → Grade (A–F) → Grade Point (5.0–0.0)
// ============================================================

'use strict';

/**
 * Nigerian 5.0 grading scale.
 * Adjust thresholds here if your institution differs.
 */
const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A', point: 5.0, remark: 'Excellent' },
  { min: 60, max: 69,  grade: 'B', point: 4.0, remark: 'Very Good' },
  { min: 50, max: 59,  grade: 'C', point: 3.0, remark: 'Good' },
  { min: 45, max: 49,  grade: 'D', point: 2.0, remark: 'Fair' },
  { min: 40, max: 44,  grade: 'E', point: 1.0, remark: 'Pass' },
  { min: 0,  max: 39,  grade: 'F', point: 0.0, remark: 'Fail' },
];

/**
 * Convert a total score (0–100) to grade + point + remark.
 * @param {number} total
 * @returns {{ grade: string, point: number, remark: string }}
 */
function scoreToGrade(total) {
  const score = Number(total) || 0;
  const clamp = Math.max(0, Math.min(100, score));
  for (const band of GRADE_SCALE) {
    if (clamp >= band.min && clamp <= band.max) {
      return { grade: band.grade, point: band.point, remark: band.remark };
    }
  }
  return { grade: 'F', point: 0.0, remark: 'Fail' };
}

/**
 * Compute total score from CA (30%) and Exam (70%).
 * Accepts raw CA and Exam marks already scaled to their max.
 * @param {number} caScore
 * @param {number} examScore
 * @returns {number} total (0–100)
 */
function computeTotal(caScore, examScore) {
  const ca = Number(caScore) || 0;
  const ex = Number(examScore) || 0;
  return +(ca * 0.3 + ex * 0.7).toFixed(2);
}

/**
 * Whether a grade is a pass (A–E) or fail (F).
 */
function isPass(grade) {
  return grade && grade !== 'F';
}

/**
 * Return the full grading table (for the settings page).
 */
function getGradingTable() {
  return GRADE_SCALE.map((b) => ({ ...b }));
}

module.exports = {
  scoreToGrade,
  computeTotal,
  isPass,
  getGradingTable,
  GRADE_SCALE,
};