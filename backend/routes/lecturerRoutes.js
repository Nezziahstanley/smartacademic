// ============================================================
// SMARTACADEMIC — Lecturer Routes
// All routes require authentication + role=lecturer.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/lecturerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate, body, param } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

// All lecturer routes require auth + role
router.use(requireAuth, requireRole('lecturer'));

/* ============================================================
   DASHBOARD
   ============================================================ */
router.get('/dashboard', asyncHandler(ctrl.getDashboard));

/* ============================================================
   COURSES
   ============================================================ */
router.get('/courses', asyncHandler(ctrl.listMyCourses));

/* ============================================================
   STUDENTS
   ============================================================ */
router.get('/students', asyncHandler(ctrl.listStudents));

/* ============================================================
   CLASS SESSIONS
   ============================================================ */
router.get('/class-sessions', asyncHandler(ctrl.listClassSessions));
router.post('/class-sessions',
  body('course_id').isInt(),
  body('session_date').matches(/^\d{4}-\d{2}-\d{2}$/),
  validate,
  asyncHandler(ctrl.createClassSession)
);

/* ============================================================
   ATTENDANCE
   ============================================================ */
router.get('/attendance/:classSessionId',
  param('classSessionId').isInt(),
  validate,
  asyncHandler(ctrl.getAttendance)
);
router.post('/attendance/:classSessionId',
  param('classSessionId').isInt(),
  body('records').isArray(),
  validate,
  asyncHandler(ctrl.saveAttendance)
);
router.get('/attendance-summary/:courseId',
  param('courseId').isInt(),
  validate,
  asyncHandler(ctrl.attendanceSummary)
);

/* ============================================================
   ASSESSMENTS
   ============================================================ */
router.get('/assessments', asyncHandler(ctrl.listAssessments));
router.post('/assessments',
  body('course_id').isInt(),
  body('type').isIn(['assignment', 'test', 'ca', 'exam']),
  body('title').trim().notEmpty(),
  body('max_score').isInt({ min: 1 }),
  validate,
  asyncHandler(ctrl.createAssessment)
);
router.delete('/assessments/:id',
  param('id').isInt(),
  validate,
  asyncHandler(ctrl.deleteAssessment)
);
router.get('/assessments/:id/scores',
  param('id').isInt(),
  validate,
  asyncHandler(ctrl.getScores)
);
router.post('/assessments/:id/scores',
  param('id').isInt(),
  body('scores').isArray(),
  validate,
  asyncHandler(ctrl.saveScores)
);

/* ============================================================
   RESULTS
   ============================================================ */
router.get('/results', asyncHandler(ctrl.listResults));

/* ============================================================
   REPORTS
   ============================================================ */
router.get('/reports/course-performance', asyncHandler(ctrl.coursePerformanceReport));
router.get('/reports/attendance', asyncHandler(ctrl.attendanceReport));
router.get('/reports/grade-distribution', asyncHandler(ctrl.gradeDistributionReport));
router.get('/reports/student-averages', asyncHandler(ctrl.studentAveragesReport));

/* ============================================================
   AT-RISK STUDENTS
   ============================================================ */
router.get('/at-risk', asyncHandler(ctrl.listAtRisk));
router.get('/student/:id', param('id').isInt(), validate, asyncHandler(ctrl.getStudentDetail));

// Lecturer creates an intervention directly
router.post('/at-risk/:studentId/intervene',
  param('studentId').isInt(),
  body('title').trim().notEmpty(),
  validate,
  asyncHandler(ctrl.interveneAtRisk)
);

// Lecturer reports the student to their HOD
router.post('/at-risk/:studentId/report-to-hod',
  param('studentId').isInt(),
  validate,
  asyncHandler(ctrl.reportToHod)
);

/* ============================================================
   INTERVENTIONS (assigned to this lecturer)
   ============================================================ */
router.get('/interventions', asyncHandler(ctrl.listInterventions));
router.put('/interventions/:id',
  param('id').isInt(),
  validate,
  asyncHandler(ctrl.updateIntervention)
);

/* ============================================================
   BROADCAST to students in my courses
   ============================================================ */
router.post('/broadcast-students',
  body('title').trim().notEmpty(),
  body('message').trim().notEmpty(),
  validate,
  asyncHandler(ctrl.broadcastToStudents)
);

/* ============================================================
   PROFILE (own account)
   ============================================================ */
router.put('/profile', asyncHandler(ctrl.updateOwnProfile));
router.post('/change-password', asyncHandler(ctrl.changePassword));
router.post('/profile/photo', asyncHandler(ctrl.uploadOwnPhoto));
router.delete('/profile/photo', asyncHandler(ctrl.removeOwnPhoto));

module.exports = router;