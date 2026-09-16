'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate, body, param } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(requireAuth);

// User's own
router.get('/', asyncHandler(ctrl.listMine));
router.post('/read-all', asyncHandler(ctrl.markAllRead));
router.post('/:id/read', param('id').isInt(), validate, asyncHandler(ctrl.markRead));

// Admin-only
router.post('/create', requireRole('admin'),
  body('user_id').isInt(),
  body('title').trim().notEmpty(),
  body('message').trim().notEmpty(),
  validate, asyncHandler(ctrl.create)
);

router.post('/broadcast', requireRole('admin'),
  body('title').trim().notEmpty(),
  body('message').trim().notEmpty(),
  validate, asyncHandler(ctrl.broadcast)
);

router.get('/all', requireRole('admin'), asyncHandler(ctrl.listAll));

// HOD broadcasts to their department
router.post('/broadcast-department', requireRole('hod'),
  body('title').trim().notEmpty(),
  body('message').trim().notEmpty(),
  body('targetRoles').optional().isArray(),
  validate,
  asyncHandler(ctrl.broadcastToDepartment)
);

module.exports = router;