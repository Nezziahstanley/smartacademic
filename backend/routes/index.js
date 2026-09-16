// ============================================================
// SMARTACADEMIC — Route Aggregator
// Mounts all sub-routers under /api.
// Sub-routers (auth, admin, hod, lecturer, student) will be
// implemented in later parts — currently stubbed with comments.
// ============================================================

'use strict';

const express = require('express');
const db = require('../config/db');

const router = express.Router();

// ============================================================
// HEALTH CHECK
// ============================================================
router.get('/health', async (req, res) => {
  const dbStatus = await db.healthCheck();
  res.json({
    success: true,
    service: 'SMARTACADEMIC API',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: dbStatus.ok ? 'connected' : 'disconnected',
    dbNow: dbStatus.ok ? dbStatus.now : null,
  });
});

// ============================================================
// SUB-ROUTERS (uncommented as each part is implemented)
// ============================================================

// Part 6 — Authentication
const authRoutes = require('./authRoutes');
router.use('/auth', authRoutes);

const notificationRoutes = require('./notificationRoutes');
router.use('/notifications', notificationRoutes);

// Part 10-15 — Admin
const adminRoutes = require('./adminRoutes');
router.use('/admin', adminRoutes);

// Part 16 — HOD
const hodRoutes = require('./hodRoutes');
router.use('/hod', hodRoutes);

// Part 17 — Lecturer
const lecturerRoutes = require('./lecturerRoutes');
router.use('/lecturer', lecturerRoutes);

// Part 18 — Student
const studentRoutes = require('./studentRoutes');
router.use('/student', studentRoutes);

// Public verification endpoint (no auth required)
router.get('/public/verify/:matric', async (req, res, next) => {
  try {
    const db = require('../config/db');
    const r = await db.query(`
      SELECT s.matric_no, s.level, s.admission_year,
             u.full_name, u.photo_url,
             d.name AS department_name,
             p.name AS programme_name
        FROM students s
        JOIN users u ON u.id = s.user_id
        JOIN departments d ON d.id = s.department_id
        JOIN programmes p ON p.id = s.programme_id
       WHERE s.matric_no = $1
       LIMIT 1
    `, [req.params.matric]);

    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});

// ============================================================
// 404 for unknown /api routes
// ============================================================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} /api${req.path}`,
  });
});

module.exports = router;