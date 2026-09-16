// ============================================================
// SMARTACADEMIC — Admin Routes (mounted at /api/admin)
// All routes require authentication + admin role.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate, body, param } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

// All admin routes require auth + role=admin
router.use(requireAuth, requireRole('admin'));

/* ============================================================
   DASHBOARD
   ============================================================ */
router.get('/dashboard', asyncHandler(adminController.getDashboard));

/* ============================================================
   USERS
   ============================================================ */
router.get('/users', asyncHandler(adminController.listUsers));

router.get('/users/:id',
  param('id').isInt({ min: 1 }),
  validate,
  asyncHandler(adminController.getUser)
);

router.post('/users',
  body('full_name').trim().isLength({ min: 2, max: 120 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'hod', 'lecturer', 'student']),
  body('phone').optional({ nullable: true }).trim().isLength({ min: 7, max: 20 }),
  validate,
  asyncHandler(adminController.createUser)
);

router.put('/users/:id',
  param('id').isInt({ min: 1 }),
  body('full_name').optional().trim().isLength({ min: 2, max: 120 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'hod', 'lecturer', 'student']),
  body('phone').optional({ nullable: true }).trim().isLength({ min: 7, max: 20 }),
  body('is_active').optional().isBoolean(),
  validate,
  asyncHandler(adminController.updateUser)
);

router.post('/users/:id/toggle-active',
  param('id').isInt({ min: 1 }),
  validate,
  asyncHandler(adminController.toggleUserActive)
);

router.post('/users/:id/reset-password',
  param('id').isInt({ min: 1 }),
  body('new_password').isLength({ min: 6 }),
  validate,
  asyncHandler(adminController.resetUserPassword)
);

router.delete('/users/:id',
  param('id').isInt({ min: 1 }),
  validate,
  asyncHandler(adminController.deleteUser)
);

/* ============================================================
   ROLES LOOKUP
   ============================================================ */
router.get('/roles', asyncHandler(adminController.listRoles));

const academicController = require('../controllers/academicController');
const { body: b, param: p } = require('express-validator');

/* ============ DEPARTMENTS ============ */
router.get('/departments', asyncHandler(academicController.listDepartments));
router.get('/departments/hod-candidates', asyncHandler(academicController.listHodCandidates));
router.get('/departments/:id', p('id').isInt(), validate, asyncHandler(academicController.getDepartment));
router.post('/departments',
  b('name').trim().isLength({ min: 2, max: 120 }),
  b('code').optional({ nullable: true }).trim().isLength({ max: 10 }),
  b('hod_id').optional({ nullable: true }).isInt(),
  validate, asyncHandler(academicController.createDepartment)
);
router.put('/departments/:id',
  p('id').isInt(), validate,
  asyncHandler(academicController.updateDepartment)
);
router.delete('/departments/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteDepartment));

/* ============ PROGRAMMES ============ */
router.get('/programmes', asyncHandler(academicController.listProgrammes));
router.post('/programmes',
  b('name').trim().isLength({ min: 2, max: 120 }),
  b('department_id').isInt(),
  validate, asyncHandler(academicController.createProgramme)
);
router.put('/programmes/:id', p('id').isInt(), validate, asyncHandler(academicController.updateProgramme));
router.delete('/programmes/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteProgramme));

/* ============ STUDENTS ============ */
router.get('/students', asyncHandler(academicController.listStudents));
router.post('/students',
  b('full_name').trim().isLength({ min: 2, max: 120 }),
  b('email').trim().isEmail().normalizeEmail(),
  b('password').isLength({ min: 6 }),
  b('matric_no').trim().notEmpty(),
  b('department_id').isInt(),
  b('programme_id').isInt(),
  b('level').isInt({ min: 100, max: 700 }),
  validate, asyncHandler(academicController.createStudent)
);
router.put('/students/:id', p('id').isInt(), validate, asyncHandler(academicController.updateStudent));
router.delete('/students/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteStudent));

/* ============ LECTURERS ============ */
router.get('/lecturers', asyncHandler(academicController.listLecturers));
router.post('/lecturers',
  b('full_name').trim().isLength({ min: 2, max: 120 }),
  b('email').trim().isEmail().normalizeEmail(),
  b('password').isLength({ min: 6 }),
  b('staff_id').trim().notEmpty(),
  b('department_id').isInt(),
  validate, asyncHandler(academicController.createLecturer)
);
router.put('/lecturers/:id', p('id').isInt(), validate, asyncHandler(academicController.updateLecturer));
router.delete('/lecturers/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteLecturer));

/* ============ COURSES ============ */
router.get('/courses', asyncHandler(academicController.listCourses));
router.post('/courses',
  b('code').trim().notEmpty(),
  b('title').trim().notEmpty(),
  b('units').isInt({ min: 1, max: 6 }),
  b('department_id').isInt(),
  b('level').isInt({ min: 100, max: 700 }),
  b('semester_name').isIn(['First', 'Second', 'Summer']),
  validate, asyncHandler(academicController.createCourse)
);
router.put('/courses/:id', p('id').isInt(), validate, asyncHandler(academicController.updateCourse));
router.delete('/courses/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteCourse));

/* ============ SESSIONS ============ */
router.get('/sessions', asyncHandler(academicController.listSessions));
router.post('/sessions', b('name').trim().notEmpty(), validate, asyncHandler(academicController.createSession));
router.put('/sessions/:id', p('id').isInt(), validate, asyncHandler(academicController.updateSession));
router.delete('/sessions/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteSession));

/* ============ SEMESTERS ============ */
router.get('/semesters', asyncHandler(academicController.listSemesters));
router.post('/semesters',
  b('session_id').isInt(),
  b('name').isIn(['First', 'Second', 'Summer']),
  validate, asyncHandler(academicController.createSemester)
);
router.put('/semesters/:id', p('id').isInt(), validate, asyncHandler(academicController.updateSemester));
router.delete('/semesters/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteSemester));

/* ============ REGISTRATIONS ============ */
/* ============ REGISTRATIONS ============ */
router.get('/registrations', asyncHandler(adminController.listRegistrationsEnhanced));
router.post('/registrations/:id/approve',
  p('id').isInt(), validate,
  asyncHandler(adminController.approveRegistration)
);
router.post('/registrations/:id/drop',
  p('id').isInt(), validate,
  asyncHandler(adminController.dropRegistration)
);
router.delete('/registrations/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteRegistration));

/* ============ FEE PAYMENT ============ */
router.post('/students/:id/mark-fees-paid',
  p('id').isInt(),
  b('amount').optional().isNumeric(),
  b('receipt_no').optional().trim(),
  validate,
  asyncHandler(adminController.markFeesPaid)
);
router.post('/students/:id/mark-fees-unpaid',
  p('id').isInt(), validate,
  asyncHandler(adminController.markFeesUnpaid)
);

/* ============ ATTENDANCE ============ */
router.get('/attendance', asyncHandler(academicController.listAttendance));

/* ============ RESULTS ============ */
router.get('/results', asyncHandler(academicController.listResults));
router.put('/results/:id', p('id').isInt(), validate, asyncHandler(academicController.updateResult));
router.post('/results/:id/publish', p('id').isInt(), validate, asyncHandler(academicController.publishResult));
router.delete('/results/:id', p('id').isInt(), validate, asyncHandler(academicController.deleteResult));

/* ============ RISK ============ */
const riskController = require('../controllers/riskController');
router.get('/risk', asyncHandler(riskController.listRisk));
router.get('/risk/:id', p('id').isInt(), validate, asyncHandler(riskController.getRisk));
router.get('/risk/student/:studentId/history',
  p('studentId').isInt(), validate,
  asyncHandler(riskController.getStudentRiskHistory));

/* ============ INTERVENTIONS ============ */
router.get('/interventions', asyncHandler(riskController.listInterventions));
router.get('/interventions/staff', asyncHandler(riskController.listStaff));
router.get('/interventions/students', asyncHandler(riskController.listStudentsSelect));
router.get('/interventions/:id', p('id').isInt(), validate, asyncHandler(riskController.getIntervention));
router.post('/interventions',
  b('student_id').isInt(),
  b('type').isIn([
    'academic_counselling','tutorial_recommendation','lecturer_meeting',
    'hod_meeting','attendance_improvement','study_support','course_advisory','other',
  ]),
  b('title').trim().isLength({ min: 3, max: 150 }),
  b('priority').optional().isIn(['low','medium','high','critical']),
  validate, asyncHandler(riskController.createIntervention)
);
router.put('/interventions/:id', p('id').isInt(), validate, asyncHandler(riskController.updateIntervention));
router.delete('/interventions/:id', p('id').isInt(), validate, asyncHandler(riskController.deleteIntervention));

/* ============ SETTINGS ============ */
const settingsController = require('../controllers/settingsController');
const auditController = require('../controllers/auditController');
const reportController = require('../controllers/reportController');

router.get('/settings', asyncHandler(settingsController.list));
router.post('/settings', b('key').trim().notEmpty(), validate, asyncHandler(settingsController.update));
router.post('/settings/bulk', validate, asyncHandler(settingsController.bulkUpdate));
router.delete('/settings/:key', asyncHandler(settingsController.remove));

/* ============ AUDIT LOGS ============ */
router.get('/audit-logs', asyncHandler(auditController.list));
router.get('/audit-logs/modules', asyncHandler(auditController.listModules));

/* ============ REPORTS ============ */
router.get('/reports/student/:studentId', p('studentId').isInt(), validate, asyncHandler(reportController.studentReport));
router.get('/reports/attendance', asyncHandler(reportController.attendanceReport));
router.get('/reports/risk', asyncHandler(reportController.riskReport));
router.get('/reports/performance', asyncHandler(reportController.performanceReport));

router.post('/risk/recompute', asyncHandler(riskController.recompute));

router.post('/interventions/auto-create', asyncHandler(riskController.autoIntervene));

const { toCSV } = require('../utils/csvExporter');
const { generateReport } = require('../utils/pdfExporter');
const { generateWorkbook } = require('../utils/excelExporter');

router.get('/reports/export/:type', async (req, res, next) => {
  try {
    const type = req.params.type;
    const format = (req.query.format || 'csv').toLowerCase();

    let title, columns, rows;

    if (type === 'attendance') {
      const data = await reportController.attendanceReport(req, { json: () => {} }, () => {});
      // simpler: re-query
      const r = await db.query(`
        SELECT u.full_name AS student, s.matric_no AS matric, c.code AS course, c.title,
               COUNT(*)::int AS total,
               SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
               ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS percent
          FROM attendance a
          JOIN class_sessions cs ON cs.id = a.class_session_id
          JOIN students s ON s.id = a.student_id
          JOIN users u ON u.id = s.user_id
          JOIN courses c ON c.id = cs.course_id
         GROUP BY u.full_name, s.matric_no, c.code, c.title
         ORDER BY percent ASC NULLS LAST
      `);
      title = 'Attendance Report';
      columns = [
        { key: 'student', label: 'Student', width: 24 },
        { key: 'matric', label: 'Matric', width: 16 },
        { key: 'course', label: 'Course', width: 12 },
        { key: 'title', label: 'Title', width: 30 },
        { key: 'total', label: 'Total', width: 10, align: 'right' },
        { key: 'present', label: 'Present', width: 10, align: 'right' },
        { key: 'percent', label: 'Percent', width: 12, align: 'right' },
      ];
      rows = r.rows;
    } else if (type === 'risk') {
      const r = await db.query(`
        SELECT u.full_name AS student, s.matric_no AS matric, d.name AS department,
               s.level, ra.risk_category AS category, ra.risk_score AS score,
               ra.attendance_pct AS attendance, ra.gpa, ra.failed_courses AS failed
          FROM risk_assessments ra
          JOIN students s ON s.id = ra.student_id
          JOIN users u ON u.id = s.user_id
          JOIN departments d ON d.id = s.department_id
         WHERE ra.assessed_at = (SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id)
         ORDER BY ra.risk_score DESC
      `);
      title = 'Risk Report';
      columns = [
        { key: 'student', label: 'Student', width: 24 },
        { key: 'matric', label: 'Matric', width: 16 },
        { key: 'department', label: 'Department', width: 22 },
        { key: 'level', label: 'Level', width: 8, align: 'right' },
        { key: 'category', label: 'Category', width: 12 },
        { key: 'score', label: 'Score', width: 10, align: 'right' },
        { key: 'attendance', label: 'Attend%', width: 10, align: 'right' },
        { key: 'gpa', label: 'GPA', width: 8, align: 'right' },
        { key: 'failed', label: 'Failed', width: 8, align: 'right' },
      ];
      rows = r.rows;
    } else {
      return res.status(400).json({ success: false, error: 'Unknown report type.' });
    }

    const filename = `smartacademic-${type}-${new Date().toISOString().slice(0,10)}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(toCSV(rows, columns.map(c => c.key)));
    }
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      const doc = generateReport({
        title,
        subtitle: `Generated by SMARTACADEMIC`,
        columns,
        rows,
        meta: [`Total records: ${rows.length}`, `Generated: ${new Date().toLocaleString()}`],
      });
      doc.pipe(res);
      doc.end();
      return;
    }
    if (format === 'excel' || format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      const wb = await generateWorkbook({ title, columns, rows });
      await wb.xlsx.write(res);
      res.end();
      return;
    }

    res.status(400).json({ success: false, error: 'Unsupported format.' });
  } catch (err) { next(err); }
});

/* ============ BULK IMPORT ============ */
const importController = require('../controllers/importController');
router.get('/students/import/template', asyncHandler(importController.downloadTemplate));
router.post('/students/import', asyncHandler(importController.importStudents));

/* ============ USER APPROVALS ============ */
const approvalController = require('../controllers/approvalController');
router.get('/pending-users', asyncHandler(approvalController.listPending));
router.post('/pending-users/:id/approve', p('id').isInt(), validate, asyncHandler(approvalController.approve));
router.post('/pending-users/:id/reject', p('id').isInt(), validate, asyncHandler(approvalController.reject));

const submissionController = require('../controllers/submissionController');

router.get('/submissions', asyncHandler(submissionController.listAllSubmissions));
router.post('/submissions/:id/approve', p('id').isInt(), validate, asyncHandler(submissionController.approveSubmission));
router.post('/submissions/:id/reject',
  p('id').isInt(),
  b('admin_notes').optional().trim(),
  validate,
  asyncHandler(submissionController.rejectSubmission)
);

router.put('/profile', asyncHandler(adminController.updateOwnProfile));
router.post('/change-password', asyncHandler(adminController.changeOwnPassword));

/* ============ PROFILE PHOTO ============ */
router.post('/profile/photo',
  asyncHandler(adminController.uploadOwnPhoto)
);
router.delete('/profile/photo',
  asyncHandler(adminController.removeOwnPhoto)
);

module.exports = router;