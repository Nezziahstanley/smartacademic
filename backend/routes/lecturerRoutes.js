'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/lecturerController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate, body, param } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(requireAuth, requireRole('lecturer'));

router.get('/dashboard', asyncHandler(ctrl.getDashboard));
router.get('/courses', asyncHandler(ctrl.listMyCourses));
router.get('/students', asyncHandler(ctrl.listStudents));

router.get('/class-sessions', asyncHandler(ctrl.listClassSessions));
router.post('/class-sessions',
  body('course_id').isInt(),
  body('session_date').matches(/^\d{4}-\d{2}-\d{2}$/),
  validate, asyncHandler(ctrl.createClassSession)
);

router.get('/attendance/:classSessionId', param('classSessionId').isInt(), validate, asyncHandler(ctrl.getAttendance));
router.post('/attendance/:classSessionId',
  param('classSessionId').isInt(),
  body('records').isArray(),
  validate, asyncHandler(ctrl.saveAttendance)
);
router.get('/attendance-summary/:courseId', param('courseId').isInt(), validate, asyncHandler(ctrl.attendanceSummary));

router.get('/assessments', asyncHandler(ctrl.listAssessments));
router.post('/assessments',
  body('course_id').isInt(),
  body('type').isIn(['assignment', 'test', 'ca', 'exam']),
  body('title').trim().notEmpty(),
  body('max_score').isInt({ min: 1 }),
  validate, asyncHandler(ctrl.createAssessment)
);
router.delete('/assessments/:id', param('id').isInt(), validate, asyncHandler(ctrl.deleteAssessment));
router.get('/assessments/:id/scores', param('id').isInt(), validate, asyncHandler(ctrl.getScores));
router.post('/assessments/:id/scores',
  param('id').isInt(),
  body('scores').isArray(),
  validate, asyncHandler(ctrl.saveScores)
);

router.get('/results', asyncHandler(ctrl.listResults));
router.get('/at-risk', asyncHandler(ctrl.listAtRisk));
router.get('/interventions', asyncHandler(ctrl.listInterventions));
router.put('/interventions/:id', param('id').isInt(), validate, asyncHandler(ctrl.updateIntervention));

router.put('/profile', asyncHandler(ctrl.updateOwnProfile));
router.post('/change-password', asyncHandler(ctrl.changePassword));

router.get('/reports/course-performance', asyncHandler(ctrl.coursePerformanceReport));
router.get('/reports/attendance', asyncHandler(ctrl.attendanceReport));
router.get('/reports/grade-distribution', asyncHandler(ctrl.gradeDistributionReport));

router.post('/broadcast-students', asyncHandler(ctrl.broadcastToStudents));

router.get('/reports/student-averages', asyncHandler(ctrl.studentAveragesReport));

router.get('/student/:id', asyncHandler(ctrl.getStudentDetail));

module.exports = router;