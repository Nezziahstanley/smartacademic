// ============================================================
// SMARTACADEMIC — Registration Approval Controller
// Lists pending (inactive) users, approves or rejects them.
// ============================================================

'use strict';

const db = require('../config/db');
const adminModel = require('../models/adminModel');
const emailService = require('../services/emailService');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/admin/pending-users
 * Lists users with is_active = FALSE.
 */
async function listPending(req, res, next) {
  try {
    const r = await db.query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.created_at,
             r.name AS role_name,
             s.matric_no, s.level, s.admission_year,
             d.name AS department_name,
             p.name AS programme_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN departments d ON d.id = s.department_id
        LEFT JOIN programmes p ON p.id = s.programme_id
       WHERE u.is_active = FALSE
       ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/**
 * POST /api/admin/pending-users/:id/approve
 */
async function approve(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const user = await db.query('SELECT * FROM users WHERE id = $1 AND is_active = FALSE', [id]);
    if (!user.rows[0]) throw new AppError('Pending user not found.', 404);

    await db.query('UPDATE users SET is_active = TRUE WHERE id = $1', [id]);

    // Welcome email (best-effort, ignore failures)
    try {
      await emailService.send({
        to: user.rows[0].email,
        subject: 'Your SMARTACADEMIC account is now active',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:#10b981;padding:24px;border-radius:12px 12px 0 0;color:#fff;text-align:center;">
              <h2 style="margin:0;">Account Approved ✅</h2>
            </div>
            <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
              <p>Hi ${user.rows[0].full_name},</p>
              <p>Your SMARTACADEMIC account has been approved. You can now log in with the email and password you registered with.</p>
              <p style="text-align:center;margin:24px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/login.html"
                   style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">
                  Log in
                </a>
              </p>
            </div>
          </div>`,
      });
    } catch (e) {
      console.warn('[approval] Email send failed:', e.message);
    }

    // In-app notification
    try {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'Account approved', 'Your account has been approved. Welcome to SMARTACADEMIC!', 'system')
      `, [id]);
    } catch (e) { /* ignore */ }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'approve_user',
      module: 'users',
      affected_record: `user:${id}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'User approved and notified.' });
  } catch (err) { next(err); }
}

/**
 * POST /api/admin/pending-users/:id/reject
 */
async function reject(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const user = await db.query('SELECT * FROM users WHERE id = $1 AND is_active = FALSE', [id]);
    if (!user.rows[0]) throw new AppError('Pending user not found.', 404);

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'reject_user',
      module: 'users',
      affected_record: `user:${id}`,
      details: { email: user.rows[0].email },
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Registration rejected and removed.' });
  } catch (err) { next(err); }
}

module.exports = { listPending, approve, reject };