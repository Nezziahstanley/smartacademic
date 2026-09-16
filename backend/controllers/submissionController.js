// ============================================================
// SMARTACADEMIC — HOD Submissions Controller
// HODs propose new students/lecturers/courses;
// Admin approves/rejects.
// ============================================================

'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const env = require('../config/env');
const db = require('../config/db');
const adminModel = require('../models/adminModel');
const emailService = require('../services/emailService');
const { AppError } = require('../middleware/errorHandler');

/* ============================================================
   HOD — Create Submission
   ============================================================ */
async function createSubmission(req, res, next) {
  try {
    const { type, payload } = req.body;

    if (!['student', 'lecturer', 'course'].includes(type)) {
      throw new AppError('Invalid type.', 400);
    }
    if (!payload || typeof payload !== 'object') {
      throw new AppError('Payload required.', 400);
    }

    // Get HOD's department
    const hodDept = await db.query(
      'SELECT id FROM departments WHERE hod_id = $1 AND is_active = TRUE',
      [req.user.id]
    );
    if (!hodDept.rows[0]) {
      throw new AppError('You are not assigned as HOD.', 403);
    }
    const departmentId = hodDept.rows[0].id;

    // Validation per type
    if (type === 'student') {
      if (!payload.full_name || !payload.email || !payload.matric_no) {
        throw new AppError('Full name, email, and matric number required.', 400);
      }
    } else if (type === 'lecturer') {
      if (!payload.full_name || !payload.email || !payload.staff_id) {
        throw new AppError('Full name, email, and staff ID required.', 400);
      }
    } else if (type === 'course') {
      if (!payload.code || !payload.title || !payload.units) {
        throw new AppError('Course code, title, and units required.', 400);
      }
    }

    const result = await db.query(`
      INSERT INTO hod_submissions (hod_user_id, department_id, type, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [req.user.id, departmentId, type, JSON.stringify(payload)]);

    // Notify all admins
    const admins = await db.query(`
      SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'admin' AND u.is_active = TRUE
    `);
    for (const a of admins.rows) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'New HOD submission', $2, 'system')
      `, [a.id, `${type} submission awaiting review`]);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'create_submission',
      module: 'submissions',
      affected_record: `submission:${result.rows[0].id}`,
      details: { type },
    });

    res.status(201).json({
      success: true,
      message: 'Submission sent to admin for approval.',
      data: result.rows[0],
    });
  } catch (err) { next(err); }
}

/* ============================================================
   HOD — List own submissions
   ============================================================ */
async function listMySubmissions(req, res, next) {
  try {
    const r = await db.query(`
      SELECT s.*, u.full_name AS reviewer_name
        FROM hod_submissions s
        LEFT JOIN users u ON u.id = s.reviewed_by
       WHERE s.hod_user_id = $1
       ORDER BY s.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ============================================================
   ADMIN — List all submissions
   ============================================================ */
async function listAllSubmissions(req, res, next) {
  try {
    const { status, type } = req.query;
    const params = []; const where = [];
    if (status) { params.push(status); where.push(`s.status = $${params.length}`); }
    if (type)   { params.push(type);   where.push(`s.type = $${params.length}`); }

    const r = await db.query(`
      SELECT s.*,
             u.full_name AS hod_name, u.email AS hod_email,
             d.name AS department_name,
             a.full_name AS reviewer_name
        FROM hod_submissions s
        JOIN users u ON u.id = s.hod_user_id
        JOIN departments d ON d.id = s.department_id
        LEFT JOIN users a ON a.id = s.reviewed_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.created_at DESC
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ============================================================
   ADMIN — Approve Submission (creates the actual record)
   ============================================================ */
async function approveSubmission(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const r = await db.query(`
      SELECT * FROM hod_submissions WHERE id = $1 AND status = 'pending'
    `, [id]);
    if (!r.rows[0]) throw new AppError('Pending submission not found.', 404);

    const sub = r.rows[0];
    const payload = sub.payload;

    // Create the actual record based on type
    if (sub.type === 'student') {
      const password = payload.temp_password || 'Welcome@' + crypto.randomBytes(3).toString('hex');
      const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      const roleRow = await db.query("SELECT id FROM roles WHERE name = 'student'");

      const u = await db.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id, must_change_pw)
        VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id
      `, [payload.full_name, payload.email.toLowerCase(), payload.phone || null, password_hash, roleRow.rows[0].id]);

      await db.query(`
        INSERT INTO students (user_id, matric_no, department_id, programme_id, level, admission_year)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [u.rows[0].id, payload.matric_no, sub.department_id, payload.programme_id || null,
          payload.level || 100, payload.admission_year || new Date().getFullYear()]);

      // Email the student
      try {
        await emailService.send({
          to: payload.email,
          subject: 'Welcome to SMARTACADEMIC',
          html: `
            <h2>Your account is ready</h2>
            <p>Hi ${payload.full_name},</p>
            <p>Your student account has been created by your department.</p>
            <p><strong>Email:</strong> ${payload.email}<br>
               <strong>Password:</strong> ${password}</p>
            <p>Please change your password after first login.</p>`,
        });
      } catch (e) { /* ignore */ }
    } else if (sub.type === 'lecturer') {
      const password = payload.temp_password || 'Welcome@' + crypto.randomBytes(3).toString('hex');
      const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      const roleRow = await db.query("SELECT id FROM roles WHERE name = 'lecturer'");

      const u = await db.query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_id, must_change_pw)
        VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id
      `, [payload.full_name, payload.email.toLowerCase(), payload.phone || null, password_hash, roleRow.rows[0].id]);

      await db.query(`
        INSERT INTO lecturers (user_id, staff_id, department_id, title)
        VALUES ($1, $2, $3, $4)
      `, [u.rows[0].id, payload.staff_id, sub.department_id, payload.title || null]);
    } else if (sub.type === 'course') {
      await db.query(`
        INSERT INTO courses (code, title, units, department_id, programme_id, level, semester_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      `, [payload.code, payload.title, payload.units, sub.department_id,
          payload.programme_id || null, payload.level || 100, payload.semester_name || 'First']);
    }

    // Mark submission approved
    await db.query(`
      UPDATE hod_submissions
         SET status = 'approved',
             reviewed_by = $2,
             reviewed_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
    `, [id, req.user.id]);

    // Notify HOD
    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES ($1, 'Submission approved', $2, 'system', $3)
    `, [sub.hod_user_id, `Your ${sub.type} submission was approved.`, id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'approve_submission',
      module: 'submissions',
      affected_record: `submission:${id}`,
    });

    res.json({ success: true, message: 'Submission approved and record created.' });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError('Email/matric/staff ID/course code already exists.', 409));
    }
    next(err);
  }
}

/* ============================================================
   ADMIN — Reject Submission
   ============================================================ */
async function rejectSubmission(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { admin_notes } = req.body;

    const r = await db.query(`
      SELECT * FROM hod_submissions WHERE id = $1 AND status = 'pending'
    `, [id]);
    if (!r.rows[0]) throw new AppError('Pending submission not found.', 404);

    await db.query(`
      UPDATE hod_submissions
         SET status = 'rejected',
             admin_notes = $2,
             reviewed_by = $3,
             reviewed_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
    `, [id, admin_notes || null, req.user.id]);

    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES ($1, 'Submission rejected', $2, 'system', $3)
    `, [r.rows[0].hod_user_id, `Your ${r.rows[0].type} submission was rejected. ${admin_notes || ''}`, id]);

    res.json({ success: true, message: 'Submission rejected.' });
  } catch (err) { next(err); }
}

module.exports = {
  createSubmission, listMySubmissions,
  listAllSubmissions, approveSubmission, rejectSubmission,
};