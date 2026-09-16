'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/hodController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate, body, param } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(requireAuth, requireRole('hod'));

router.get('/dashboard', asyncHandler(ctrl.getDashboard));
router.get('/students', asyncHandler(ctrl.listStudents));
router.get('/students/:id', param('id').isInt(), validate, asyncHandler(ctrl.getStudentDetail));
router.get('/lecturers', asyncHandler(ctrl.listLecturers));
router.get('/courses', asyncHandler(ctrl.listCourses));
router.get('/attendance', asyncHandler(ctrl.getAttendanceOverview));
router.get('/performance', asyncHandler(ctrl.getPerformance));
router.get('/risk', asyncHandler(ctrl.listRisk));
router.get('/interventions', asyncHandler(ctrl.listInterventions));
router.get('/interventions/staff', asyncHandler(ctrl.listStaff));
router.post('/interventions',
  body('student_id').isInt(),
  body('type').isIn(['academic_counselling','tutorial_recommendation','lecturer_meeting','hod_meeting','attendance_improvement','study_support','course_advisory','other']),
  body('title').trim().isLength({ min: 3, max: 150 }),
  validate, asyncHandler(ctrl.createIntervention)
);
router.put('/interventions/:id', param('id').isInt(), validate, asyncHandler(ctrl.updateIntervention));

router.put('/profile', asyncHandler(ctrl.updateOwnProfile));
router.post('/change-password', asyncHandler(ctrl.changePassword));

const submissionController = require('../controllers/submissionController');

router.post('/submissions',
  body('type').isIn(['student', 'lecturer', 'course']),
  asyncHandler(submissionController.createSubmission)
);
router.get('/submissions', asyncHandler(submissionController.listMySubmissions));

module.exports = router;