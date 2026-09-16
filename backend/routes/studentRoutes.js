'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/studentController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, body, param } = require('../middleware/validate');

router.use(requireAuth, requireRole('student'));

router.get('/dashboard', asyncHandler(ctrl.getDashboard));
router.get('/profile', asyncHandler(ctrl.getProfile));
router.get('/courses', asyncHandler(ctrl.getMyCourses));
router.get('/attendance', asyncHandler(ctrl.getMyAttendance));
router.get('/results', asyncHandler(ctrl.getMyResults));
router.get('/gpa-cgpa', asyncHandler(ctrl.getGpaCgpa));
router.get('/performance', asyncHandler(ctrl.getPerformance));
router.get('/academic-status', asyncHandler(ctrl.getAcademicStatus));
router.get('/interventions', asyncHandler(ctrl.getMyInterventions));

router.get('/available-courses', asyncHandler(ctrl.getAvailableCourses));
router.get('/my-registrations', asyncHandler(ctrl.getMyRegistrations));
router.post('/register-course',
  body('course_id').isInt({ min: 1 }),
  validate,
  asyncHandler(ctrl.registerCourse)
);
router.post('/drop-course/:id',
  param('id').isInt({ min: 1 }),
  validate,
  asyncHandler(ctrl.dropCourse)
);

router.post('/upload-photo', asyncHandler(ctrl.uploadPhoto));

router.put('/profile', asyncHandler(ctrl.updateOwnProfile));
router.post('/change-password', asyncHandler(ctrl.changePassword));

module.exports = router;