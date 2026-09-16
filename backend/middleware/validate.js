// ============================================================
// SMARTACADEMIC — Validation Middleware
// Wraps express-validator: collects errors into a single
// JSON response instead of the default array format.
// ============================================================

'use strict';

const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Run after a chain of validators. If any failed, respond 422.
 * Usage:
 *   router.post('/login',
 *     body('email').isEmail(),
 *     body('password').isLength({ min: 6 }),
 *     validate,
 *     authController.login
 *   );
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map((e) => ({
    field:    e.path || e.param,
    message:  e.msg,
    value:    e.value,
  }));

  const err = new AppError('Validation failed.', 422, formatted);
  next(err);
}

// ---------- Reusable validators ----------
const { body, param, query } = require('express-validator');

const rules = {
  email:      body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  password:   body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  fullName:   body('full_name').trim().isLength({ min: 2, max: 120 }).withMessage('Full name required'),
  phone:      body('phone').optional().trim().isLength({ min: 7, max: 20 }).withMessage('Invalid phone'),
  idParam:    param('id').isInt({ min: 1 }).withMessage('Valid ID required'),
  pageQuery:  query('page').optional().isInt({ min: 1 }),
  limitQuery: query('limit').optional().isInt({ min: 1, max: 100 }),
};

module.exports = {
  validate,
  rules,
  body,
  param,
  query,
};