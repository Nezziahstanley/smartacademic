// ============================================================
// SMARTACADEMIC — Authentication Controller
// Handles register (student / lecturer), login, me, logout,
// forgot-password, reset-password, invite, accept-invite.
// Student matric numbers are auto-generated on registration.
// Sends email + SMS + in-app notifications.
// ============================================================

'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const env = require('../config/env');
const db = require('../config/db');
const userModel = require('../models/userModel');
const { AppError } = require('../middleware/errorHandler');
const { signToken } = require('../middleware/auth');

// In-memory store for password reset tokens (dev only).
const resetTokens = new Map();

// In-memory store for invitation tokens (dev only).
const inviteStore = new Map();

// ============================================================
// REGISTER
// ============================================================
/**
 * POST /api/auth/register
 * Body: {
 *   role: 'student' | 'lecturer',
 *   full_name, email, phone, password,
 *   // student:
 *   department_id, programme_id, level, admission_year,
 *   // lecturer:
 *   staff_id, department_id, title
 * }
 *
 * Student matric number is AUTO-GENERATED.
 */
async function register(req, res, next) {
  try {
    const {
      role, full_name, email, phone, password,
      department_id, programme_id, level, admission_year,
      staff_id, title,
    } = req.body;

    if (!['student', 'lecturer'].includes(role)) {
      throw new AppError('Only student or lecturer registration is allowed. Contact admin for other roles.', 400);
    }

    const existing = await userModel.findByEmail(email);
    if (existing) throw new AppError('Email already registered.', 409);

    if (!(await userModel.departmentExists(department_id))) {
      throw new AppError('Invalid department.', 400);
    }

    if (role === 'student') {
      // matric_no is auto-generated — not taken from the request
      if (!programme_id) throw new AppError('Programme is required.', 400);
      if (!level) throw new AppError('Level is required.', 400);
      if (!(await userModel.programmeExists(programme_id))) {
        throw new AppError('Invalid programme.', 400);
      }
    } else {
      if (!staff_id) throw new AppError('Staff ID is required.', 400);
      if (await userModel.staffIdExists(staff_id)) {
        throw new AppError('Staff ID already in use.', 409);
      }
    }

    const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const role_id = await userModel.getRoleIdByName(role);
    if (!role_id) throw new AppError('Role not found.', 500);

    // Create user + profile in a transaction so the matric serial is safe
    const client = await db.pool.connect();
    let user_id;
    let generated_matric = null;

    try {
      await client.query('BEGIN');

      const u = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role_id, is_active)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         RETURNING id`,
        [full_name, email.toLowerCase(), phone || null, password_hash, role_id]
      );
      user_id = u.rows[0].id;

      if (role === 'student') {
        const matricGenerator = require('../utils/matricGenerator');
        generated_matric = await matricGenerator.generateMatric({
          departmentId: department_id,
          programmeId:  programme_id,
          admissionYear: admission_year || new Date().getFullYear(),
          client,
        });

        await client.query(
          `INSERT INTO students
             (user_id, matric_no, department_id, programme_id, level, admission_year)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            user_id,
            generated_matric,
            department_id,
            programme_id,
            level,
            admission_year || new Date().getFullYear(),
          ]
        );
      } else {
        await client.query(
          `INSERT INTO lecturers (user_id, staff_id, department_id, title)
           VALUES ($1, $2, $3, $4)`,
          [user_id, staff_id, department_id, title || null]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    console.log('[register] New user id:', user_id,
      role === 'student' ? `· matric: ${generated_matric}` : '');

    // Notify admins in-app
    try {
      const admins = await db.query(`
        SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'admin' AND u.is_active = TRUE
      `);
      for (const a of admins.rows) {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES ($1, 'New registration pending', $2, 'system')
        `, [a.id, `${full_name} (${email}) has registered and is awaiting your approval.`]);
      }
    } catch (e) { /* ignore */ }

    const user = await userModel.findById(user_id);

    // Notify the registrant: email + SMS + in-app
    try {
      const dispatcher = require('../services/notificationDispatcher');

      const loginUrl = `${env.CLIENT_URL || 'http://localhost:5000'}/login.html`;
      const firstName = (full_name || '').split(' ')[0] || 'there';

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:24px;">
          <div style="background:#166534;padding:24px;border-radius:12px 12px 0 0;color:#fff;text-align:center;">
            <h1 style="margin:0;font-size:20px;">SMARTACADEMIC</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:.9;">Federal Polytechnic, Ugep</p>
          </div>
          <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
            <p style="font-size:15px;color:#0f172a;">Hi ${firstName},</p>
            <p style="font-size:14.5px;color:#334155;line-height:1.6;">
              Thanks for registering with SMARTACADEMIC. Your account has been created
              and is <strong>pending approval</strong> by our admin team.
            </p>
            ${generated_matric ? `
              <p style="background:#f0fdf4;padding:14px;border-radius:8px;font-family:monospace;font-size:14px;color:#166534;text-align:center;">
                <strong>Your Matric Number:</strong><br>${generated_matric}
              </p>` : ''}
            <p style="font-size:14.5px;color:#334155;line-height:1.6;">
              You'll receive another email and SMS the moment your account is approved.
              Until then, you won't be able to log in.
            </p>
            <p style="margin:24px 0;text-align:center;">
              <a href="${loginUrl}"
                 style="background:#166534;color:#fff;padding:12px 26px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">
                Go to Login
              </a>
            </p>
            <p style="font-size:12.5px;color:#94a3b8;text-align:center;margin-top:24px;">
              If you didn't register, you can safely ignore this email.
            </p>
          </div>
        </div>`;

      const smsText = generated_matric
        ? `Hi ${firstName}, your SMARTACADEMIC account was received. Matric: ${generated_matric}. Pending approval.`
        : `Hi ${firstName}, your SMARTACADEMIC account was received. Pending approval.`;

      await dispatcher.notify({
        userId: user_id,
        email: email.toLowerCase(),
        phone: phone || null,
        subject: 'Registration received — pending approval',
        emailHtml,
        smsText,
        inAppTitle: 'Registration received',
        inAppMessage: generated_matric
          ? `Your matric number is ${generated_matric}. Pending admin approval.`
          : 'Your account is pending admin approval. You will be notified shortly.',
        inAppType: 'system',
      });
    } catch (e) {
      console.warn('[register] Notification dispatch failed:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending admin approval. You will be notified via email and SMS once it is active.',
      data: { user: sanitizeUser(user), matric_no: generated_matric, pending: true },
    });
  } catch (err) { next(err); }
}

// ============================================================
// LOGIN
// ============================================================
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await userModel.findByEmail(email);
    if (!user) throw new AppError('Invalid email or password.', 401);
    if (!user.is_active) throw new AppError('Account is deactivated.', 403);

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new AppError('Invalid email or password.', 401);

    await userModel.touchLastLogin(user.id);

    const token = signToken(user);

    res.json({
      success: true,
      message: 'Login successful.',
      data: { user: sanitizeUser(user), token },
    });
  } catch (err) { next(err); }
}

// ============================================================
// ME
// ============================================================
async function me(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) throw new AppError('User not found.', 404);

    let profile = null;

    if (user.role_name === 'student') {
      const r = await db.query(
        `SELECT s.id, s.matric_no, s.level, s.admission_year,
                d.id AS department_id, d.name AS department_name,
                p.id AS programme_id, p.name AS programme_name
           FROM students s
           JOIN departments d ON d.id = s.department_id
           JOIN programmes  p ON p.id = s.programme_id
          WHERE s.user_id = $1`,
        [user.id]
      );
      profile = r.rows[0] || null;
    } else if (user.role_name === 'lecturer') {
      const r = await db.query(
        `SELECT l.id, l.staff_id, l.title,
                d.id AS department_id, d.name AS department_name
           FROM lecturers l
           JOIN departments d ON d.id = l.department_id
          WHERE l.user_id = $1`,
        [user.id]
      );
      profile = r.rows[0] || null;
    } else if (user.role_name === 'hod') {
      const r = await db.query(
        `SELECT d.id AS department_id, d.name AS department_name
           FROM departments d
          WHERE d.hod_id = $1`,
        [user.id]
      );
      profile = r.rows[0] || null;
    }

    res.json({ success: true, data: { user: sanitizeUser(user), profile } });
  } catch (err) { next(err); }
}

// ============================================================
// LOGOUT
// ============================================================
async function logout(req, res) {
  res.json({ success: true, message: 'Logged out.' });
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await userModel.findByEmail(email);

    if (!user) {
      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    resetTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    const resetLink = `${env.CLIENT_URL}/reset-password.html?token=${token}`;
    if (env.isDevelopment) {
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('  PASSWORD RESET LINK (dev only)');
      console.log('  ' + resetLink);
      console.log('═══════════════════════════════════════════════');
      console.log('');
    }

    res.json({
      success: true,
      message: 'If that email exists, a reset link has been sent.',
      ...(env.isDevelopment ? { dev_token: token, dev_link: resetLink } : {}),
    });
  } catch (err) { next(err); }
}

// ============================================================
// RESET PASSWORD
// ============================================================
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const entry = resetTokens.get(token);

    if (!entry || entry.expiresAt < Date.now()) {
      throw new AppError('Invalid or expired reset token.', 400);
    }

    const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    await userModel.updatePassword(entry.userId, password_hash);
    resetTokens.delete(token);

    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (err) { next(err); }
}

// ============================================================
// SEND INVITE
// ============================================================
async function sendInvite(req, res, next) {
  try {
    const { email, full_name, role = 'student' } = req.body;
    if (!email) throw new AppError('Email required.', 400);

    const existing = await userModel.findByEmail(email);
    if (existing) throw new AppError('This email is already registered.', 409);

    const token = crypto.randomBytes(24).toString('hex');
    inviteStore.set(token, {
      email: email.toLowerCase(),
      full_name: full_name || '',
      role,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      created_by: req.user.id,
    });

    const link = `${env.CLIENT_URL}/register.html?invite=${token}`;

    const emailService = require('../services/emailService');
    try {
      await emailService.send({
        to: email,
        subject: "You're invited to SMARTACADEMIC",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:#166534;padding:24px;border-radius:12px 12px 0 0;color:#fff;text-align:center;">
              <h1 style="margin:0;">SMARTACADEMIC</h1>
              <p style="margin:4px 0 0;opacity:.9;">Federal Polytechnic, Ugep</p>
            </div>
            <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
              <p>Hi${full_name ? ' ' + full_name : ''},</p>
              <p>You have been invited to join SMARTACADEMIC as a <strong>${role}</strong>.</p>
              <p>Click the button below to complete your registration:</p>
              <p style="text-align:center;margin:26px 0;">
                <a href="${link}" style="background:#166534;color:#fff;padding:14px 30px;text-decoration:none;border-radius:10px;font-weight:700;">
                  Complete Registration
                </a>
              </p>
              <p style="color:#64748b;font-size:13px;">This link expires in 7 days.</p>
              <p style="color:#94a3b8;font-size:12px;margin-top:20px;">— SMARTACADEMIC Team</p>
            </div>
          </div>`,
      });
      console.log('[invite] Email sent to', email);
    } catch (emailErr) {
      console.warn('[invite] Email send failed:', emailErr.message);
    }

    res.json({
      success: true,
      message: `Invitation created for ${email}`,
      data: { email, role },
      link,
      dev_link: link,
    });
  } catch (err) { next(err); }
}

// ============================================================
// ACCEPT INVITE
// ============================================================
async function acceptInvite(req, res, next) {
  try {
    const {
      token, password, full_name, phone,
      department_id, programme_id, level, admission_year,
      staff_id, title,
    } = req.body;

    const entry = inviteStore.get(token);
    if (!entry) throw new AppError('Invalid or expired invitation.', 400);
    if (entry.expiresAt < Date.now()) {
      inviteStore.delete(token);
      throw new AppError('Invitation expired. Ask admin for a new one.', 400);
    }
    if (!password || password.length < 6) {
      throw new AppError('Password must be at least 6 characters.', 400);
    }

    const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const role_id = await userModel.getRoleIdByName(entry.role);

    const client = await db.pool.connect();
    let user_id, generated_matric = null;

    try {
      await client.query('BEGIN');

      const u = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role_id, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id`,
        [full_name || entry.full_name, entry.email, phone || null, password_hash, role_id]
      );
      user_id = u.rows[0].id;

      if (entry.role === 'student') {
        const matricGenerator = require('../utils/matricGenerator');
        generated_matric = await matricGenerator.generateMatric({
          departmentId: department_id,
          programmeId:  programme_id,
          admissionYear: admission_year || new Date().getFullYear(),
          client,
        });
        await client.query(
          `INSERT INTO students
             (user_id, matric_no, department_id, programme_id, level, admission_year)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user_id, generated_matric, department_id, programme_id, level,
           admission_year || new Date().getFullYear()]
        );
      } else if (entry.role === 'lecturer') {
        await client.query(
          `INSERT INTO lecturers (user_id, staff_id, department_id, title)
           VALUES ($1, $2, $3, $4)`,
          [user_id, staff_id, department_id, title || null]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    inviteStore.delete(token);

    const fullUser = await userModel.findById(user_id);
    const jwt = signToken(fullUser);

    res.status(201).json({
      success: true,
      message: 'Account created.',
      data: { user: sanitizeUser(fullUser), matric_no: generated_matric, token: jwt },
    });
  } catch (err) { next(err); }
}

// ============================================================
// HELPERS
// ============================================================
function sanitizeUser(user) {
  return {
    id:             user.id,
    full_name:      user.full_name,
    email:          user.email,
    phone:          user.phone,
    role:           user.role_name,
    is_active:      user.is_active,
    must_change_pw: user.must_change_pw || false,
    photo_url:      user.photo_url || null,
  };
}

module.exports = {
  register,
  login,
  me,
  logout,
  forgotPassword,
  resetPassword,
  sendInvite,
  acceptInvite,
};