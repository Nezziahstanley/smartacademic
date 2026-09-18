// ============================================================
// SMARTACADEMIC — Admin Controller
// Dashboard stats, users CRUD, fee tracking,
// result publishing (by department), safe result deletion,
// bulk registration actions.
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
    const { role, search, is_active, page = 1, limit = 50 } = req.query;

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

    const roleRow = await adminModel.getRoleByName(role);
    if (!roleRow) throw new AppError('Invalid role.', 400);

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
   OWN PROFILE / CHANGE PASSWORD
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
   REGISTRATION ACTIONS
   ============================================================ */
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

/* ============================================================
   BULK REGISTRATION ACTIONS
   Return per-row success/failure lists.
   ============================================================ */
async function bulkApproveRegistrations(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      throw new AppError('ids array required.', 400);
    }

    const approved = [];
    const failed = [];
    const notifyStudent = new Map(); // student_id → [codes]

    for (const raw of ids) {
      const id = parseInt(raw, 10);
      if (!id) { failed.push({ id: raw, error: 'Invalid ID' }); continue; }
      try {
        const r = await db.query(`
          SELECT cr.id, cr.status, cr.student_id, c.code
            FROM course_registrations cr
            JOIN courses c ON c.id = cr.course_id
           WHERE cr.id = $1
        `, [id]);
        if (!r.rows[0]) { failed.push({ id, error: 'Not found' }); continue; }

        const row = r.rows[0];

        if (row.status === 'approved') {
          approved.push({ id, code: row.code });
          continue;
        }
        if (row.status === 'dropped') {
          failed.push({ id, error: 'Registration was dropped' });
          continue;
        }

        await db.query(`
          UPDATE course_registrations
             SET status = 'approved',
                 approved_at = NOW(),
                 approved_by = $2
           WHERE id = $1
        `, [id, req.user.id]);

        approved.push({ id, code: row.code });

        if (!notifyStudent.has(row.student_id)) notifyStudent.set(row.student_id, []);
        notifyStudent.get(row.student_id).push(row.code);
      } catch (err) {
        failed.push({ id, error: err.message });
      }
    }

    // Send ONE notification per student with a summary of their approved courses
    for (const [studentId, codes] of notifyStudent.entries()) {
      const st = await db.query('SELECT user_id FROM students WHERE id = $1', [studentId]);
      if (!st.rows[0]) continue;
      const summary = codes.length === 1
        ? `Your registration for ${codes[0]} has been approved.`
        : `${codes.length} of your course registrations have been approved.`;
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'Course registration approved', $2, 'result')
      `, [st.rows[0].user_id, summary]);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'bulk_approve_registrations',
      module: 'registrations',
      details: { approved: approved.length, failed: failed.length },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: `${approved.length} approved, ${failed.length} failed.`,
      data: { approved, failed },
    });
  } catch (err) { next(err); }
}

async function bulkDropRegistrations(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      throw new AppError('ids array required.', 400);
    }

    const dropped = [];
    const failed = [];

    for (const raw of ids) {
      const id = parseInt(raw, 10);
      if (!id) { failed.push({ id: raw, error: 'Invalid ID' }); continue; }
      try {
        const r = await db.query(`
          SELECT cr.id, cr.status, c.code
            FROM course_registrations cr
            JOIN courses c ON c.id = cr.course_id
           WHERE cr.id = $1
        `, [id]);
        if (!r.rows[0]) { failed.push({ id, error: 'Not found' }); continue; }

        const row = r.rows[0];
        if (row.status === 'dropped') {
          dropped.push({ id, code: row.code });
          continue;
        }

        await db.query(`
          UPDATE course_registrations
             SET status = 'dropped',
                 dropped_at = NOW(),
                 dropped_by = $2
           WHERE id = $1
        `, [id, req.user.id]);
        dropped.push({ id, code: row.code });
      } catch (err) {
        failed.push({ id, error: err.message });
      }
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'bulk_drop_registrations',
      module: 'registrations',
      details: { dropped: dropped.length, failed: failed.length },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: `${dropped.length} dropped, ${failed.length} failed.`,
      data: { dropped, failed },
    });
  } catch (err) { next(err); }
}

async function markFeesPaid(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const { amount, receipt_no } = req.body;

    const s = await db.query('SELECT id, user_id FROM students WHERE id = $1', [studentId]);
    if (!s.rows[0]) throw new AppError('Student not found.', 404);

    await db.query(`
      UPDATE students
         SET school_fees_paid = TRUE,
             school_fees_paid_at = NOW(),
             school_fees_amount = $2,
             school_fees_receipt_no = $3
       WHERE id = $1
    `, [studentId, amount || null, receipt_no || null]);

    const approved = await db.query(`
      UPDATE course_registrations
         SET status = 'approved',
             approved_at = NOW(),
             approved_by = $2
       WHERE student_id = $1
         AND status = 'registered'
       RETURNING id
    `, [studentId, req.user.id]);

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
   PROFILE PHOTO
   ============================================================ */
async function uploadOwnPhoto(req, res, next) {
  try {
    const { photo } = req.body;
    if (!photo || !photo.startsWith('data:image/')) {
      throw new AppError('Invalid image. Must be a data URL.', 400);
    }
    if (photo.length > 8_000_000) {
      throw new AppError('Image too large. Max ~2 MB after compression.', 400);
    }

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

async function removeOwnPhoto(req, res, next) {
  try {
    await db.query(
      'UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true, message: 'Photo removed.' });
  } catch (err) { next(err); }
}

/* ============================================================
   PUBLISH — helpers
   ============================================================ */
async function notifyPublishedStudents(rows) {
  if (!rows || !rows.length) return;

  const byStudent = new Map();
  for (const r of rows) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
    byStudent.get(r.student_id).push(r.course_id);
  }

  const studentIds = Array.from(byStudent.keys());

  const users = await db.query(`
    SELECT s.id AS student_id, s.user_id
      FROM students s
     WHERE s.id = ANY($1)
  `, [studentIds]);

  const allCourseIds = Array.from(new Set(rows.map(r => r.course_id)));
  const courses = await db.query(
    'SELECT id, code FROM courses WHERE id = ANY($1)',
    [allCourseIds]
  );
  const codeMap = Object.fromEntries(courses.rows.map(c => [c.id, c.code]));

  for (const u of users.rows) {
    const courseIds = byStudent.get(u.student_id) || [];
    const codes = courseIds.map(id => codeMap[id]).filter(Boolean);
    if (!codes.length) continue;

    const summary = codes.length === 1
      ? `Your result for ${codes[0]} is now available.`
      : `${codes.length} of your results are now available.`;

    await db.query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, 'Result published', $2, 'result')
    `, [u.user_id, summary]);
  }
}

/* ============================================================
   PUBLISH — GROUPED BY DEPARTMENT
   ============================================================ */
async function listPublishableResultsGrouped(req, res, next) {
  try {
    const { status = 'approved' } = req.query;

    const r = await db.query(`
      SELECT
        d.id   AS department_id,
        d.name AS department_name,
        c.id   AS course_id,
        c.code, c.title, c.level,
        sess.id   AS session_id,  sess.name AS session_name,
        sem.id    AS semester_id, sem.name  AS semester_name,
        COUNT(r.id)::int                                    AS students,
        COUNT(r.id) FILTER (WHERE r.is_published)::int      AS published_count,
        COUNT(r.id) FILTER (WHERE NOT r.is_published)::int  AS unpublished_count,
        MAX(r.approved_at)                                  AS approved_at
      FROM results r
      JOIN courses c      ON c.id  = r.course_id
      JOIN departments d  ON d.id  = c.department_id
      JOIN sessions sess  ON sess.id = r.session_id
      JOIN semesters sem  ON sem.id  = r.semester_id
      WHERE r.submission_status = $1
      GROUP BY d.id, d.name, c.id, c.code, c.title, c.level,
               sess.id, sess.name, sem.id, sem.name
      ORDER BY d.name, c.code
    `, [status]);

    const deptMap = new Map();
    for (const row of r.rows) {
      if (!deptMap.has(row.department_id)) {
        deptMap.set(row.department_id, {
          department_id:   row.department_id,
          department_name: row.department_name,
          courses: [],
          totals: { courses: 0, students: 0, published: 0, unpublished: 0 },
          status: 'approved',
        });
      }
      const dept = deptMap.get(row.department_id);
      dept.courses.push(row);
      dept.totals.courses++;
      dept.totals.students    += row.students;
      dept.totals.published   += row.published_count;
      dept.totals.unpublished += row.unpublished_count;
    }

    for (const dept of deptMap.values()) {
      if (dept.totals.unpublished === 0 && dept.totals.published > 0) {
        dept.status = 'published';
      } else if (dept.totals.published > 0 && dept.totals.unpublished > 0) {
        dept.status = 'partial';
      } else {
        dept.status = 'approved';
      }
    }

    res.json({ success: true, data: Array.from(deptMap.values()) });
  } catch (err) { next(err); }
}

async function publishDepartment(req, res, next) {
  try {
    const departmentId = parseInt(req.params.departmentId, 10);
    const { session_id, semester_id } = req.body;

    if (!session_id || !semester_id) {
      throw new AppError('session_id and semester_id required.', 400);
    }

    const dept = await db.query('SELECT name FROM departments WHERE id = $1', [departmentId]);
    if (!dept.rows[0]) throw new AppError('Department not found.', 404);

    const upd = await db.query(`
      UPDATE results r
         SET is_published = TRUE
        FROM courses c
       WHERE r.course_id = c.id
         AND c.department_id = $1
         AND r.session_id = $2
         AND r.semester_id = $3
         AND r.submission_status = 'approved'
         AND r.is_published = FALSE
      RETURNING r.id, r.student_id, r.course_id
    `, [departmentId, session_id, semester_id]);

    if (upd.rowCount > 0) {
      await notifyPublishedStudents(upd.rows);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'publish_department',
      module: 'results',
      affected_record: `department:${departmentId}`,
      details: { published: upd.rowCount, dept: dept.rows[0].name },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: `${upd.rowCount} result(s) published for ${dept.rows[0].name}.`,
      data: { published: upd.rowCount },
    });
  } catch (err) { next(err); }
}

async function publishDepartmentsBulk(req, res, next) {
  try {
    const { department_ids, session_id, semester_id } = req.body;

    if (!Array.isArray(department_ids) || !department_ids.length) {
      throw new AppError('department_ids array required.', 400);
    }
    if (!session_id || !semester_id) {
      throw new AppError('session_id and semester_id required.', 400);
    }

    const ids = department_ids.map(x => parseInt(x, 10)).filter(Boolean);

    const upd = await db.query(`
      UPDATE results r
         SET is_published = TRUE
        FROM courses c
       WHERE r.course_id = c.id
         AND c.department_id = ANY($1)
         AND r.session_id = $2
         AND r.semester_id = $3
         AND r.submission_status = 'approved'
         AND r.is_published = FALSE
      RETURNING r.id, r.student_id, r.course_id
    `, [ids, session_id, semester_id]);

    if (upd.rowCount > 0) {
      await notifyPublishedStudents(upd.rows);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'publish_departments_bulk',
      module: 'results',
      details: { departments: ids.length, published: upd.rowCount },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: `${upd.rowCount} result(s) published across ${ids.length} department(s).`,
      data: { published: upd.rowCount, departments: ids.length },
    });
  } catch (err) { next(err); }
}

async function unpublishDepartment(req, res, next) {
  try {
    const departmentId = parseInt(req.params.departmentId, 10);
    const { session_id, semester_id } = req.body;

    if (!session_id || !semester_id) {
      throw new AppError('session_id and semester_id required.', 400);
    }

    const upd = await db.query(`
      UPDATE results r
         SET is_published = FALSE
        FROM courses c
       WHERE r.course_id = c.id
         AND c.department_id = $1
         AND r.session_id = $2
         AND r.semester_id = $3
         AND r.is_published = TRUE
      RETURNING r.id
    `, [departmentId, session_id, semester_id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'unpublish_department',
      module: 'results',
      affected_record: `department:${departmentId}`,
      details: { unpublished: upd.rowCount },
    });

    res.json({
      success: true,
      message: `${upd.rowCount} result(s) unpublished.`,
      data: { unpublished: upd.rowCount },
    });
  } catch (err) { next(err); }
}

/* ============================================================
   DELETE RESULT — policy-aware
   - published → blocked
   - approved  → soft-return to lecturer
   - other     → hard delete
   ============================================================ */
async function deleteResultSafely(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const r = await db.query(`
      SELECT r.id, r.is_published, r.submission_status,
             r.student_id, r.course_id,
             c.code AS course_code
        FROM results r
        JOIN courses c ON c.id = r.course_id
       WHERE r.id = $1
    `, [id]);
    if (!r.rows[0]) throw new AppError('Result not found.', 404);

    const row = r.rows[0];

    if (row.is_published) {
      throw new AppError(
        'Cannot delete a published result. Unpublish it first.',
        409
      );
    }

    if (row.submission_status === 'approved') {
      await db.query(`
        UPDATE results
           SET submission_status = 'returned',
               return_reason = 'Deleted by administrator.',
               approved_at = NULL,
               approved_by = NULL
         WHERE id = $1
      `, [id]);

      const lect = await db.query(`
        SELECT l.user_id
          FROM courses c
          JOIN lecturers l ON l.id = c.lecturer_id
         WHERE c.id = $1
      `, [row.course_id]);

      if (lect.rows[0] && lect.rows[0].user_id) {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES ($1, 'Result returned', $2, 'system')
        `, [
          lect.rows[0].user_id,
          `A result you submitted for ${row.course_code} was removed by the administrator. Please review and resubmit.`,
        ]);
      }

      await adminModel.writeAudit({
        user_id: req.user.id,
        action: 'return_result',
        module: 'results',
        affected_record: `result:${id}`,
        details: { reason: 'Deleted by administrator' },
      });

      return res.json({
        success: true,
        message: 'Approved result returned to lecturer (soft-deleted).',
      });
    }

    await db.query('DELETE FROM results WHERE id = $1', [id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'delete_result',
      module: 'results',
      affected_record: `result:${id}`,
    });

    res.json({ success: true, message: 'Result deleted.' });
  } catch (err) { next(err); }
}

/* ============================================================
   LEGACY PUBLISH ENDPOINTS
   ============================================================ */
async function listPublishableResults(req, res, next) {
  return listPublishableResultsGrouped(req, res, next);
}

async function publishResults(req, res, next) {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const { session_id, semester_id } = req.body;

    const upd = await db.query(`
      UPDATE results
         SET is_published = TRUE
       WHERE course_id = $1
         AND session_id = $2
         AND semester_id = $3
         AND submission_status = 'approved'
         AND is_published = FALSE
       RETURNING id, student_id, course_id
    `, [courseId, session_id, semester_id]);

    if (upd.rowCount > 0) {
      await notifyPublishedStudents(upd.rows);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'publish_results',
      module: 'results',
      affected_record: `course:${courseId}`,
      details: { published: upd.rowCount },
    });

    res.json({ success: true, message: `${upd.rowCount} results published.` });
  } catch (err) { next(err); }
}

async function unpublishResults(req, res, next) {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const { session_id, semester_id } = req.body;

    const upd = await db.query(`
      UPDATE results
         SET is_published = FALSE
       WHERE course_id = $1
         AND session_id = $2
         AND semester_id = $3
       RETURNING id
    `, [courseId, session_id, semester_id]);

    res.json({ success: true, message: `${upd.rowCount} results unpublished.` });
  } catch (err) { next(err); }
}

async function publishResultsBulk(req, res, next) {
  try {
    const { course_ids, session_id, semester_id } = req.body;

    if (!Array.isArray(course_ids) || !course_ids.length) {
      throw new AppError('course_ids array required.', 400);
    }
    if (!session_id || !semester_id) {
      throw new AppError('session_id and semester_id required.', 400);
    }

    const ids = course_ids.map(x => parseInt(x, 10)).filter(Boolean);

    const upd = await db.query(`
      UPDATE results
         SET is_published = TRUE
       WHERE course_id = ANY($1)
         AND session_id = $2
         AND semester_id = $3
         AND submission_status = 'approved'
         AND is_published = FALSE
      RETURNING id, student_id, course_id
    `, [ids, session_id, semester_id]);

    if (upd.rowCount > 0) {
      await notifyPublishedStudents(upd.rows);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'publish_results_bulk',
      module: 'results',
      details: { courses: ids.length, published: upd.rowCount },
    });

    res.json({
      success: true,
      message: `${ids.length} course(s) processed, ${upd.rowCount} student results published.`,
      data: { published: upd.rowCount },
    });
  } catch (err) { next(err); }
}

/* ============================================================
   EXPORTS
   ============================================================ */
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
  approveRegistration,
  dropRegistration,
  bulkApproveRegistrations,
  bulkDropRegistrations,
  markFeesPaid,
  markFeesUnpaid,
  listRegistrationsEnhanced,
  listPublishableResultsGrouped,
  publishDepartment,
  publishDepartmentsBulk,
  unpublishDepartment,
  deleteResultSafely,
  listPublishableResults,
  publishResults,
  unpublishResults,
  publishResultsBulk,
};