// ============================================================
// SMARTACADEMIC — Registration Approval Controller
// Lists pending (inactive) users, approves or rejects them.
// On approval: sends welcome email + SMS + in-app notification.
// ============================================================

'use strict';

const db = require('../config/db');
const adminModel = require('../models/adminModel');
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

    const user = await db.query(
      'SELECT id, full_name, email, phone, role_id FROM users WHERE id = $1 AND is_active = FALSE',
      [id]
    );
    if (!user.rows[0]) throw new AppError('Pending user not found.', 404);

    await db.query('UPDATE users SET is_active = TRUE WHERE id = $1', [id]);

    // ------------------------------------------------------------
    // Notify the user: email + SMS + in-app
    // ------------------------------------------------------------
    try {
      const dispatcher = require('../services/notificationDispatcher');

      const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/login.html`;
      const firstName = (user.rows[0].full_name || '').split(' ')[0] || 'there';

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:24px;">
          <div style="background:#166534;padding:24px;border-radius:12px 12px 0 0;color:#fff;text-align:center;">
            <h1 style="margin:0;font-size:20px;">Account Approved ✅</h1>
          </div>
          <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
            <p style="font-size:15px;color:#0f172a;">Hi ${firstName},</p>
            <p style="font-size:14.5px;color:#334155;line-height:1.6;">
              Great news — your SMARTACADEMIC account has been approved. You can now log in
              and access your dashboard.
            </p>
            <p style="margin:24px 0;text-align:center;">
              <a href="${loginUrl}"
                 style="background:#166534;color:#fff;padding:12px 26px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">
                Log in now
              </a>
            </p>
            <p style="font-size:12.5px;color:#94a3b8;text-align:center;margin-top:24px;">
              — SMARTACADEMIC Team
            </p>
          </div>
        </div>`;

      const smsText = `Hi ${firstName}, your SMARTACADEMIC account is now ACTIVE. Log in at ${loginUrl}`;

      await dispatcher.notify({
        userId: id,
        email: user.rows[0].email,
        phone: user.rows[0].phone || null,
        subject: 'Your account is now active',
        emailHtml,
        smsText,
        inAppTitle: 'Account approved',
        inAppMessage: 'Your account has been approved. Welcome to SMARTACADEMIC!',
        inAppType: 'system',
      });
    } catch (e) {
      console.warn('[approval] Notification dispatch failed:', e.message);
    }

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

    const user = await db.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = FALSE',
      [id]
    );
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