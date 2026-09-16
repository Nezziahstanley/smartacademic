// ============================================================
// SMARTACADEMIC — Result Engine
// One-shot: recompute ALL results (uses academicEngine).
// ============================================================

'use strict';

const { recomputeResults, computeStudentPerformance } = require('./academicEngine');

async function recomputeAll(opts = {}) {
  return recomputeResults(opts);
}

async function getStudentSnapshot(studentId) {
  return computeStudentPerformance(studentId);
}

module.exports = { recomputeAll, getStudentSnapshot };