// ============================================================
// SMARTACADEMIC — Admin Controller
// Dashboard stats, activity feed, attendance trend, users CRUD.
// ============================================================

'use strict';

const bcrypt = require('bcryptjs');
const env = require('../config/env');
const db = require('../config/db');
const adminModel = require('../models/adminModel');
const { AppError } = require('../middleware/errorHandler');

/* ============================================================
   DASHBOARD
   ============================================================ */
async function getDashboard(req, res, next) {
  try {
    const [stats, activity, highRisk, attendance] = await Promise.all([
      adminModel.getDashboardStats(),
      adminModel.getRecentActivity(8),
      adminModel.getRecentHighRisk(6),
      adminModel.getAttendanceTrend(),
    ]);

    res.json({
      success: true,
      data: { stats, activity, highRisk, attendance },
    });
  } catch (err) { next(err); }
}

/* ============================================================
   USERS
   ============================================================ */
async function listUsers(req, res, next) {
  try {
    const {
      role, search, is_active,
      page = 1, limit = 50,
    } = req.query;

    const filters = {
      role: role || null,
      search: search || null,
      isActive: is_active === undefined ? null : (is_active === 'true' || is_active === true),
    };

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [rows, total] = await Promise.all([
      adminModel.listUsers({ ...filters, limit: parseInt(limit, 10), offset }),
      adminModel.countUsers(filters),
    ]);

    res.json({
      success: true,
      data: {
        items: rows,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      },
    });
  } catch (err) { next(err); }
}

async function getUser(req, res, next) {
  try {
    const user = await adminModel.getUserById(parseInt(req.params.id, 10));
    if (!user) throw new AppError('User not found.', 404);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

async function createUser(req, res, next) {
  try {
    const { full_name, email, phone, password, role } = req.body;

    // Validate role
    const roleRow = await adminModel.getRoleByName(role);
    if (!roleRow) throw new AppError('Invalid role.', 400);

    // Email uniqueness
    if (await adminModel.emailExists(email)) {
      throw new AppError('Email already in use.', 409);
    }

    const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const result = await db.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role_id, must_change_pw)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING id
    `, [full_name, email.toLowerCase(), phone || null, password_hash, roleRow.id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'create_user',
      module: 'users',
      affected_record: `user:${result.rows[0].id}`,
      details: { email, role },
      ip_address: req.ip,
    });

    const user = await adminModel.getUserById(result.rows[0].id);
    res.status(201).json({ success: true, message: 'User created.', data: user });
  } catch (err) { next(err); }
}

async function updateUser(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const target = await adminModel.getUserById(id);
    if (!target) throw new AppError('User not found.', 404);

    const { full_name, email, phone, role, is_active } = req.body;

    let role_id = null;
    if (role) {
      const roleRow = await adminModel.getRoleByName(role);
      if (!roleRow) throw new AppError('Invalid role.', 400);
      role_id = roleRow.id;
    }

    if (email && await adminModel.emailExists(email, id)) {
      throw new AppError('Email already in use.', 409);
    }

    await adminModel.updateUser(id, {
      full_name,
      email,
      phone,
      role_id,
      is_active: is_active === undefined ? null : is_active,
    });

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'update_user',
      module: 'users',
      affected_record: `user:${id}`,
      details: req.body,
      ip_address: req.ip,
    });

    const user = await adminModel.getUserById(id);
    res.json({ success: true, message: 'User updated.', data: user });
  } catch (err) { next(err); }
}

async function toggleUserActive(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    // Prevent admin from deactivating themselves
    if (id === req.user.id) {
      throw new AppError('You cannot deactivate your own account.', 400);
    }

    const target = await adminModel.getUserById(id);
    if (!target) throw new AppError('User not found.', 404);

    const updated = await adminModel.setActive(id, !target.is_active);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: updated.is_active ? 'activate_user' : 'deactivate_user',
      module: 'users',
      affected_record: `user:${id}`,
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: updated.is_active ? 'User activated.' : 'User deactivated.',
      data: updated,
    });
  } catch (err) { next(err); }
}

async function resetUserPassword(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { new_password } = req.body;

    const target = await adminModel.getUserById(id);
    if (!target) throw new AppError('User not found.', 404);

    const password_hash = await bcrypt.hash(new_password, env.BCRYPT_ROUNDS);

    await db.query(
      'UPDATE users SET password_hash = $2, must_change_pw = TRUE WHERE id = $1',
      [id, password_hash]
    );

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'reset_password',
      module: 'users',
      affected_record: `user:${id}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Password reset. User must change on next login.' });
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    if (id === req.user.id) {
      throw new AppError('You cannot delete your own account.', 400);
    }

    const target = await adminModel.getUserById(id);
    if (!target) throw new AppError('User not found.', 404);

    await adminModel.deleteUser(id);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'delete_user',
      module: 'users',
      affected_record: `user:${id}`,
      details: { email: target.email },
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'User deleted.' });
  } catch (err) { next(err); }
}

async function listRoles(req, res, next) {
  try {
    const roles = await adminModel.listRoles();
    res.json({ success: true, data: roles });
  } catch (err) { next(err); }
}

/* ============================================================
   UPDATE OWN PROFILE
   ============================================================ */
async function updateOwnProfile(req, res, next) {
  try {
    const { full_name, phone } = req.body;
    await db.query(`
      UPDATE users
         SET full_name = COALESCE($2, full_name),
             phone     = COALESCE($3, phone)
       WHERE id = $1
    `, [req.user.id, full_name || null, phone || null]);
    res.json({ success: true, message: 'Profile updated.' });
  } catch (err) { next(err); }
}

/* ============================================================
   CHANGE OWN PASSWORD
   ============================================================ */
async function changeOwnPassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    const bcrypt = require('bcryptjs');
    const env = require('../config/env');

    if (!new_password || new_password.length < 6) {
      throw new AppError('New password must be at least 6 characters.', 400);
    }

    const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!r.rows[0]) throw new AppError('User not found.', 404);

    const ok = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!ok) throw new AppError('Current password is incorrect.', 400);

    const hash = await bcrypt.hash(new_password, env.BCRYPT_ROUNDS);
    await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);

    await adminModel.writeAudit({
      user_id: req.user.id, action: 'change_own_password', module: 'profile',
    });

    res.json({ success: true, message: 'Password changed.' });
  } catch (err) { next(err); }
}

/* ============================================================
   COURSE REGISTRATION — Approve / Drop / Mark Fees Paid
   ============================================================ */

/**
 * POST /api/admin/registrations/:id/approve
 */
async function approveRegistration(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const r = await db.query(`
      SELECT cr.id, cr.status, cr.student_id, u.full_name, c.code
        FROM course_registrations cr
        JOIN students s ON s.id = cr.student_id
        JOIN users u ON u.id = s.user_id
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.id = $1
    `, [id]);
    if (!r.rows[0]) throw new AppError('Registration not found.', 404);

    await db.query(`
      UPDATE course_registrations
         SET status = 'approved',
             approved_at = NOW(),
             approved_by = $2
       WHERE id = $1
    `, [id, req.user.id]);

    // Notify student
    const st = await db.query('SELECT user_id FROM students WHERE id = $1', [r.rows[0].student_id]);
    if (st.rows[0]) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'Course registration approved', $2, 'result')
      `, [st.rows[0].user_id, `Your registration for ${r.rows[0].code} has been approved.`]);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'approve_registration',
      module: 'registrations',
      affected_record: `registration:${id}`,
    });

    res.json({ success: true, message: 'Registration approved.' });
  } catch (err) { next(err); }
}

/**
 * POST /api/admin/registrations/:id/drop
 */
async function dropRegistration(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const r = await db.query(`
      SELECT cr.id, cr.student_id, c.code
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.id = $1
    `, [id]);
    if (!r.rows[0]) throw new AppError('Registration not found.', 404);

    await db.query(`
      UPDATE course_registrations
         SET status = 'dropped',
             dropped_at = NOW(),
             dropped_by = $2
       WHERE id = $1
    `, [id, req.user.id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'drop_registration',
      module: 'registrations',
      affected_record: `registration:${id}`,
    });

    res.json({ success: true, message: 'Registration dropped.' });
  } catch (err) { next(err); }
}

/**
 * POST /api/admin/students/:id/mark-fees-paid
 * Body: { amount, receipt_no }
 * Marks student fees paid AND auto-approves all their pending registrations.
 */
async function markFeesPaid(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const { amount, receipt_no } = req.body;

    const s = await db.query('SELECT id, user_id FROM students WHERE id = $1', [studentId]);
    if (!s.rows[0]) throw new AppError('Student not found.', 404);

    // 1. Mark fees paid
    await db.query(`
      UPDATE students
         SET school_fees_paid = TRUE,
             school_fees_paid_at = NOW(),
             school_fees_amount = $2,
             school_fees_receipt_no = $3
       WHERE id = $1
    `, [studentId, amount || null, receipt_no || null]);

    // 2. Auto-approve all their 'registered' registrations
    const approved = await db.query(`
      UPDATE course_registrations
         SET status = 'approved',
             approved_at = NOW(),
             approved_by = $2
       WHERE student_id = $1
         AND status = 'registered'
       RETURNING id
    `, [studentId, req.user.id]);

    // 3. Notify student
    await db.query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, 'Fees confirmed — courses approved', $2, 'result')
    `, [s.rows[0].user_id, `Your school fees have been received. ${approved.rowCount} course registration(s) have been auto-approved.`]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'mark_fees_paid',
      module: 'students',
      affected_record: `student:${studentId}`,
      details: { amount, receipt_no, approved: approved.rowCount },
    });

    res.json({
      success: true,
      message: `Fees marked paid. ${approved.rowCount} registration(s) auto-approved.`,
      data: { approvedCount: approved.rowCount },
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/admin/students/:id/mark-fees-unpaid
 */
async function markFeesUnpaid(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);

    await db.query(`
      UPDATE students
         SET school_fees_paid = FALSE,
             school_fees_paid_at = NULL,
             school_fees_amount = NULL,
             school_fees_receipt_no = NULL
       WHERE id = $1
    `, [studentId]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'mark_fees_unpaid',
      module: 'students',
      affected_record: `student:${studentId}`,
    });

    res.json({ success: true, message: 'Fees marked unpaid.' });
  } catch (err) { next(err); }
}

/**
 * GET /api/admin/registrations — updated to include fee status
 */
async function listRegistrationsEnhanced(req, res, next) {
  try {
    const { session_id, semester_id, course_id, status, search } = req.query;
    const params = []; const where = [];

    if (session_id)  { params.push(parseInt(session_id, 10));  where.push(`cr.session_id = $${params.length}`); }
    if (semester_id) { params.push(parseInt(semester_id, 10)); where.push(`cr.semester_id = $${params.length}`); }
    if (course_id)   { params.push(parseInt(course_id, 10));   where.push(`cr.course_id = $${params.length}`); }
    if (status)      { params.push(status);                    where.push(`cr.status = $${params.length}`); }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`);
    }

    const r = await db.query(`
      SELECT cr.id, cr.status, cr.registered_at, cr.approved_at, cr.dropped_at,
             s.id AS student_id, s.matric_no, s.school_fees_paid,
             u.full_name AS student_name,
             c.id AS course_id, c.code, c.title, c.units,
             sess.name AS session_name, sem.name AS semester_name
        FROM course_registrations cr
        JOIN students s     ON s.id = cr.student_id
        JOIN users u        ON u.id = s.user_id
        JOIN courses c      ON c.id = cr.course_id
        JOIN sessions sess  ON sess.id = cr.session_id
        JOIN semesters sem  ON sem.id = cr.semester_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY cr.registered_at DESC
       LIMIT 500
    `, params);

    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ============================================================
   PROFILE PHOTO UPLOAD (for admin's own profile)
   ============================================================ */
async function uploadOwnPhoto(req, res, next) {
  try {
    const { photo } = req.body;
    if (!photo || !photo.startsWith('data:image/')) {
      throw new AppError('Invalid image. Must be a data URL.', 400);
    }

    // Limit size — data URLs of 5MB images become ~7MB strings
    if (photo.length > 8_000_000) {
      throw new AppError('Image too large. Max ~2 MB after compression.', 400);
    }

    // Ensure column exists (idempotent)
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT');

    await db.query(
      'UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2',
      [photo, req.user.id]
    );

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'update_own_photo',
      module: 'profile',
      affected_record: `user:${req.user.id}`,
    });

    res.json({ success: true, message: 'Photo updated.' });
  } catch (err) { next(err); }
}

/* ============================================================
   REMOVE PROFILE PHOTO
   ============================================================ */
async function removeOwnPhoto(req, res, next) {
  try {
    await db.query(
      'UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true, message: 'Photo removed.' });
  } catch (err) { next(err); }
}

module.exports = {
  uploadOwnPhoto,
  removeOwnPhoto,
  getDashboard,
  listUsers,
  getUser,
  createUser,
  updateUser,
  toggleUserActive,
  resetUserPassword,
  deleteUser,
  listRoles,
  updateOwnProfile,
  changeOwnPassword,
  // NEW:
  approveRegistration,
  dropRegistration,
  markFeesPaid,
  markFeesUnpaid,
  listRegistrationsEnhanced,
};