// ============================================================
// SMARTACADEMIC — Notification Controller
// Any authenticated user can view/update their own notifications.
// ============================================================

'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function listMine(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const onlyUnread = req.query.unread === 'true';

    const params = [req.user.id];
    let sql = `SELECT id, title, message, type, related_id, is_read, read_at, created_at
                 FROM notifications WHERE user_id = $1`;
    if (onlyUnread) sql += ` AND is_read = FALSE`;
    sql += ` ORDER BY created_at DESC LIMIT $2`;
    params.push(limit);

    const r = await db.query(sql, params);
    const unread = await db.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({ success: true, data: { items: r.rows, unread: unread.rows[0].n } });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await db.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (!r.rows[0]) throw new AppError('Notification not found.', 404);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { user_id, title, message, type = 'system', related_id = null } = req.body;
    const r = await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [user_id, title, message, type, related_id]);
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

async function broadcast(req, res, next) {
  try {
    const { roles, title, message, type = 'announcement' } = req.body;
    const targetRoles = Array.isArray(roles) && roles.length ? roles : ['admin', 'hod', 'lecturer', 'student'];
    const r = await db.query(`
      INSERT INTO notifications (user_id, title, message, type)
      SELECT u.id, $1, $2, $3
        FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = TRUE AND r.name = ANY($4)
      RETURNING id
    `, [title, message, type, targetRoles]);
    res.json({ success: true, count: r.rowCount });
  } catch (err) { next(err); }
}

async function listAll(req, res, next) {
  // Admin-only: list recent notifications across all users
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const r = await db.query(`
      SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at,
             u.full_name AS user_name, u.email
        FROM notifications n
        JOIN users u ON u.id = n.user_id
       ORDER BY n.created_at DESC
       LIMIT $1
    `, [limit]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ============================================================
   HOD BROADCAST — send to department members only
   ============================================================ */
async function broadcastToDepartment(req, res, next) {
  try {
    const { title, message, targetRoles } = req.body;
    if (!title || !message) throw new AppError('Title and message required.', 400);

    // Find HOD's department
    const deptRow = await db.query(
      'SELECT id, name FROM departments WHERE hod_id = $1 AND is_active = TRUE',
      [req.user.id]
    );
    if (!deptRow.rows[0]) throw new AppError('You are not assigned as HOD.', 403);
    const departmentId = deptRow.rows[0].id;

    // Default to all dept roles if not specified
    const roles = Array.isArray(targetRoles) && targetRoles.length
      ? targetRoles
      : ['lecturer', 'student'];

    // Get all users in this department
    const users = await db.query(`
      SELECT DISTINCT u.id, u.email, u.full_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN students s  ON s.user_id = u.id
        LEFT JOIN lecturers l ON l.user_id = u.id
       WHERE u.is_active = TRUE
         AND r.name = ANY($1)
         AND (s.department_id = $2 OR l.department_id = $2)
    `, [roles, departmentId]);

    if (!users.rows.length) {
      return res.json({
        success: true,
        message: 'No recipients in your department.',
        count: 0,
      });
    }

    // Insert notifications for each user
    let sent = 0;
    for (const u of users.rows) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, $2, $3, 'announcement')
      `, [u.id, title, message]);
      sent++;
    }

    // Audit
    try {
      await db.query(`
        INSERT INTO audit_logs (user_id, action, module, details)
        VALUES ($1, 'hod_broadcast', 'notifications', $2)
      `, [req.user.id, JSON.stringify({ sent, roles, departmentId })]);
    } catch (e) { /* ignore */ }

    res.json({
      success: true,
      message: `Broadcast sent to ${sent} users in your department.`,
      count: sent,
    });
  } catch (err) { next(err); }
}

module.exports = {
  listMine,
  markRead,
  markAllRead,
  create,
  broadcast,
  listAll,
  broadcastToDepartment,
};