// ============================================================
// SMARTACADEMIC — Auth Routes
// Mounted at /api/auth.
// Student matric numbers are auto-generated; no matric field
// is accepted or required from the register form.
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validate, body } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

// ============================================================
// POST /api/auth/register
// ============================================================
router.post(
  '/register',
  authLimiter,
  body('role').isIn(['student', 'lecturer']).withMessage('Role must be student or lecturer'),
  body('full_name').trim().isLength({ min: 2, max: 120 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim().isLength({ min: 7, max: 20 }),
  body('department_id').isInt({ min: 1 }).withMessage('Valid department required'),
  body('programme_id').if(body('role').equals('student')).isInt({ min: 1 }),
  body('level').if(body('role').equals('student')).isInt({ min: 100, max: 700 }),
  body('staff_id').if(body('role').equals('lecturer')).notEmpty(),
  validate,
  asyncHandler(authController.register)
);

// ============================================================
// POST /api/auth/login
// ============================================================
router.post(
  '/login',
  authLimiter,
  body('email').trim().isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  asyncHandler(authController.login)
);

// ============================================================
// GET /api/auth/me
// ============================================================
router.get('/me', requireAuth, asyncHandler(authController.me));

// ============================================================
// POST /api/auth/logout
// ============================================================
router.post('/logout', requireAuth, asyncHandler(authController.logout));

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
router.post(
  '/forgot-password',
  passwordResetLimiter,
  body('email').trim().isEmail().normalizeEmail(),
  validate,
  asyncHandler(authController.forgotPassword)
);

// ============================================================
// POST /api/auth/reset-password
// ============================================================
router.post(
  '/reset-password',
  passwordResetLimiter,
  body('token').notEmpty(),
  body('password').isLength({ min: 6 }),
  validate,
  asyncHandler(authController.resetPassword)
);

// ============================================================
// PUBLIC LOOKUPS — used by the register form
// ============================================================
router.get('/departments', asyncHandler(async (req, res) => {
  const db = require('../config/db');
  const r = await db.query(
    'SELECT id, name, code FROM departments WHERE is_active = TRUE ORDER BY name'
  );
  res.json({ success: true, data: r.rows });
}));

router.get('/programmes', asyncHandler(async (req, res) => {
  const db = require('../config/db');
  const deptId = parseInt(req.query.department_id, 10);
  if (!deptId) {
    return res.json({ success: true, data: [] });
  }
  const r = await db.query(
    `SELECT id, name, code
       FROM programmes
      WHERE department_id = $1 AND is_active = TRUE
      ORDER BY name`,
    [deptId]
  );
  res.json({ success: true, data: r.rows });
}));

// ============================================================
// INVITES
// ============================================================
const { requireRole } = require('../middleware/role');

router.post('/invite',
  requireAuth,
  requireRole('admin'),
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['student', 'lecturer', 'hod']),
  validate,
  asyncHandler(authController.sendInvite)
);

router.post('/accept-invite',
  body('token').notEmpty(),
  body('password').isLength({ min: 6 }),
  validate,
  asyncHandler(authController.acceptInvite)
);

module.exports = router;