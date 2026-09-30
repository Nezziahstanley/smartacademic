// ============================================================
// SMARTACADEMIC — Risk Classifier
// Maps raw factors → weighted score (0–100) → GREEN/YELLOW/ORANGE/RED.
// Thresholds are configurable via the settings table.
//
// NOTE ON SCALES:
//   - caAvg         is on a 0–30 scale  (continuous assessment is capped at 30)
//   - examAvg       is on a 0–70 scale  (examinations are capped at 70)
//   - attendancePct is on a 0–100 scale
//
// DATA SUFFICIENCY:
//   If perf.hasSufficientData === false, the student is returned as
//   UNASSESSED rather than being misclassified as failing.
// ============================================================

'use strict';

const DEFAULT_WEIGHTS = {
  attendance: 25,
  ca:         20,
  exam:       20,
  failed:     20,
  gpaDecline: 15,
};

const DEFAULT_THRESHOLDS = {
  // Attendance is a percentage (0–100)
  attendanceCritical: 50,
  attendanceLow:      70,
  attendanceWarn:     80,

  // CA average is on a 0–30 scale
  caCritical: 12,   // 40% of 30
  caLow:      15,   // 50% of 30

  // Exam average is on a 0–70 scale
  examCritical: 28, // 40% of 70
  examLow:      35, // 50% of 70

  // Failed courses — count
  failedHigh: 3,
  failedSome: 1,

  // GPA decline — absolute drop between two most recent semester GPAs
  gpaDeclineBig:  0.8,
  gpaDeclineSome: 0.3,

  // Final classification bands (applied to the summed risk score)
  yellowMin: 25,
  orangeMin: 50,
  redMin:    75,
};

/**
 * Compute a risk score (0–100) and category from a student's performance.
 * @param {object} perf  Output of computeStudentPerformance()
 * @param {object} cfg   { weights, thresholds }
 * @returns {{ score, category, factors }}
 */
function classify(perf, cfg = {}) {
  // ---------- DATA SUFFICIENCY GUARD ----------
  // If we don't have enough data to classify, do not invent one.
  if (perf.hasSufficientData === false) {
    return {
      score: 0,
      category: 'UNASSESSED',
      factors: ['Insufficient data — no published results or attendance recorded yet'],
    };
  }

  const W = { ...DEFAULT_WEIGHTS, ...(cfg.weights || {}) };
  const T = { ...DEFAULT_THRESHOLDS, ...(cfg.thresholds || {}) };
  const factors = [];
  let score = 0;

  // ---- Attendance (0–100 scale) ----
  if (perf.attendancePct < T.attendanceCritical) {
    score += W.attendance;
    factors.push(`Critical attendance (${perf.attendancePct}%)`);
  } else if (perf.attendancePct < T.attendanceLow) {
    score += W.attendance * 0.65;
    factors.push(`Low attendance (${perf.attendancePct}%)`);
  } else if (perf.attendancePct < T.attendanceWarn) {
    score += W.attendance * 0.3;
    factors.push(`Below-average attendance (${perf.attendancePct}%)`);
  }

  // ---- CA average (0–30 scale) ----
  if (perf.caAvg < T.caCritical) {
    score += W.ca;
    factors.push(`Very low CA average (${perf.caAvg}/30)`);
  } else if (perf.caAvg < T.caLow) {
    score += W.ca * 0.6;
    factors.push(`Low CA average (${perf.caAvg}/30)`);
  }

  // ---- Exam average (0–70 scale) ----
  if (perf.examAvg < T.examCritical) {
    score += W.exam;
    factors.push(`Very low exam average (${perf.examAvg}/70)`);
  } else if (perf.examAvg < T.examLow) {
    score += W.exam * 0.6;
    factors.push(`Low exam average (${perf.examAvg}/70)`);
  }

  // ---- Failed courses ----
  if (perf.failedCourses >= T.failedHigh) {
    score += W.failed;
    factors.push(`${perf.failedCourses} failed courses`);
  } else if (perf.failedCourses >= T.failedSome) {
    score += W.failed * 0.5;
    factors.push(`${perf.failedCourses} failed course(s)`);
  }

  // ---- GPA decline ----
  if (perf.gpaDecline > T.gpaDeclineBig) {
    score += W.gpaDecline;
    factors.push(`Significant GPA decline (-${perf.gpaDecline.toFixed(2)})`);
  } else if (perf.gpaDecline > T.gpaDeclineSome) {
    score += W.gpaDecline * 0.5;
    factors.push(`GPA decline (-${perf.gpaDecline.toFixed(2)})`);
  }

  score = +score.toFixed(2);

  let category = 'GREEN';
  if (score >= T.redMin) category = 'RED';
  else if (score >= T.orangeMin) category = 'ORANGE';
  else if (score >= T.yellowMin) category = 'YELLOW';

  return { score, category, factors };
}

module.exports = { classify, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS };