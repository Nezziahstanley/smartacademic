// ============================================================
// SMARTACADEMIC — Risk Classifier
// Maps raw factors → weighted score (0–100) → GREEN/YELLOW/ORANGE/RED.
// Thresholds are configurable via the settings table.
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
  attendanceCritical: 50,
  attendanceLow:      70,
  attendanceWarn:     80,
  caCritical:         40,
  caLow:              50,
  examCritical:       40,
  examLow:            50,
  failedHigh:         3,
  failedSome:         1,
  gpaDeclineBig:      0.8,
  gpaDeclineSome:     0.3,
  yellowMin:          25,
  orangeMin:          50,
  redMin:             75,
};

/**
 * Compute a risk score (0–100) and category from a student's performance.
 * @param {object} perf  Output of computeStudentPerformance()
 * @param {object} cfg   { weights, thresholds }
 * @returns {{ score, category, factors }}
 */
function classify(perf, cfg = {}) {
  const W = { ...DEFAULT_WEIGHTS, ...(cfg.weights || {}) };
  const T = { ...DEFAULT_THRESHOLDS, ...(cfg.thresholds || {}) };
  const factors = [];
  let score = 0;

  // Attendance
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

  // CA
  if (perf.caAvg < T.caCritical) {
    score += W.ca;
    factors.push(`Very low CA average (${perf.caAvg})`);
  } else if (perf.caAvg < T.caLow) {
    score += W.ca * 0.6;
    factors.push(`Low CA average (${perf.caAvg})`);
  }

  // Exam
  if (perf.examAvg < T.examCritical) {
    score += W.exam;
    factors.push(`Very low exam average (${perf.examAvg})`);
  } else if (perf.examAvg < T.examLow) {
    score += W.exam * 0.6;
    factors.push(`Low exam average (${perf.examAvg})`);
  }

  // Failed courses
  if (perf.failedCourses >= T.failedHigh) {
    score += W.failed;
    factors.push(`${perf.failedCourses} failed courses`);
  } else if (perf.failedCourses >= T.failedSome) {
    score += W.failed * 0.5;
    factors.push(`${perf.failedCourses} failed course(s)`);
  }

  // GPA decline
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