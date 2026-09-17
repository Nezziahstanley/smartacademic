// ============================================================
// SMARTACADEMIC — HOD Routes
// All routes require authentication + role=hod.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/hodController');
const submissionController = require('../controllers/submissionController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate, body, param } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

// All HOD routes require auth + role
router.use(requireAuth, requireRole('hod'));

/* ============================================================
   DASHBOARD
   ============================================================ */
router.get('/dashboard', asyncHandler(ctrl.getDashboard));

/* ============================================================
   STUDENTS
   ============================================================ */
router.get('/students', asyncHandler(ctrl.listStudents));
router.get('/students/:id', param('id').isInt(), validate, asyncHandler(ctrl.getStudentDetail));

/* ============================================================
   LECTURERS
   ============================================================ */
router.get('/lecturers', asyncHandler(ctrl.listLecturers));

/* ============================================================
   COURSES
   ============================================================ */
router.get('/courses', asyncHandler(ctrl.listCourses));
router.post('/courses',
  body('code').trim().notEmpty(),
  body('title').trim().notEmpty(),
  body('units').isInt({ min: 1, max: 6 }),
  body('level').isInt({ min: 100, max: 700 }),
  body('semester_name').isIn(['First', 'Second', 'Summer']),
  validate,
  asyncHandler(ctrl.createCourse)
);
router.put('/courses/:id',
  param('id').isInt(),
  validate,
  asyncHandler(ctrl.updateCourse)
);
router.delete('/courses/:id',
  param('id').isInt(),
  validate,
  asyncHandler(ctrl.deleteCourse)
);

// Assign a lecturer from the department to a course
router.post('/courses/:courseId/assign-lecturer',
  param('courseId').isInt(),
  body('lecturer_id').isInt(),
  validate,
  asyncHandler(ctrl.assignLecturerToCourse)
);

/* ============================================================
   ATTENDANCE
   ============================================================ */
router.get('/attendance', asyncHandler(ctrl.getAttendanceOverview));

/* ============================================================
   PERFORMANCE
   ============================================================ */
router.get('/performance', asyncHandler(ctrl.getPerformance));

/* ============================================================
   RISK MONITORING
   ============================================================ */
router.get('/risk', asyncHandler(ctrl.listRisk));

/* ============================================================
   INTERVENTIONS
   ============================================================ */
router.get('/interventions', asyncHandler(ctrl.listInterventions));
router.get('/interventions/staff', asyncHandler(ctrl.listStaff));
router.post('/interventions',
  body('student_id').isInt(),
  body('type').isIn([
    'academic_counselling',
    'tutorial_recommendation',
    'lecturer_meeting',
    'hod_meeting',
    'attendance_improvement',
    'study_support',
    'course_advisory',
    'other',
  ]),
  body('title').trim().isLength({ min: 3, max: 150 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  validate,
  asyncHandler(ctrl.createIntervention)
);
router.put('/interventions/:id',
  param('id').isInt(),
  validate,
  asyncHandler(ctrl.updateIntervention)
);

/* ============================================================
   SUBMISSIONS
   ============================================================ */
router.post('/submissions',
  body('type').isIn(['student', 'lecturer', 'course']),
  asyncHandler(submissionController.createSubmission)
);
router.get('/submissions', asyncHandler(submissionController.listMySubmissions));

/* ============================================================
   PROFILE (own account)
   ============================================================ */
router.put('/profile', asyncHandler(ctrl.updateOwnProfile));
router.post('/change-password', asyncHandler(ctrl.changePassword));
router.post('/profile/photo', asyncHandler(ctrl.uploadOwnPhoto));
router.delete('/profile/photo', asyncHandler(ctrl.removeOwnPhoto));

module.exports = router;