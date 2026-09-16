// ============================================================
// SMARTACADEMIC — Student Controller
// Scoped to the logged-in student's own records.
// ============================================================

'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { summarize } = require('../utils/gpaCalculator');

/* ============================================================
   HELPER — Get the student profile for the logged-in user
   ============================================================ */
async function getStudentProfile(userId) {
  const r = await db.query(`
    SELECT s.id, s.matric_no, s.level, s.admission_year,
           u.full_name, u.email, u.phone, u.photo_url,
           d.name AS department_name, d.id AS department_id,
           p.name AS programme_name, p.id AS programme_id
      FROM students s
      JOIN users u ON u.id = s.user_id
      JOIN departments d ON d.id = s.department_id
      JOIN programmes p ON p.id = s.programme_id
     WHERE s.user_id = $1
  `, [userId]);
  if (!r.rows[0]) throw new AppError('Student profile not found.', 404);
  return r.rows[0];
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function getDashboard(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);

    const [results, attendance, risk, interventions] = await Promise.all([
      db.query(`
        SELECT r.*, c.code, c.title, c.units
          FROM results r JOIN courses c ON c.id = r.course_id
         WHERE r.student_id = $1 ORDER BY r.computed_at DESC
      `, [student.id]),
      db.query(`
        SELECT COUNT(*)::int AS total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::int AS present,
               SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END)::int AS absent,
               ROUND((SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
          FROM attendance WHERE student_id = $1
      `, [student.id]),
      db.query(`
        SELECT * FROM risk_assessments WHERE student_id = $1 ORDER BY assessed_at DESC LIMIT 1
      `, [student.id]),
      db.query(`
        SELECT i.*, u.full_name AS assignee_name
          FROM interventions i
          LEFT JOIN users u ON u.id = i.assigned_to
         WHERE i.student_id = $1 ORDER BY i.created_at DESC LIMIT 5
      `, [student.id]),
    ]);

    const summary = summarize(results.rows);

    res.json({
      success: true,
      data: {
        student,
        summary,
        attendance: attendance.rows[0],
        risk: risk.rows[0] || null,
        interventions: interventions.rows,
        recentResults: results.rows.slice(0, 5),
      },
    });
  } catch (err) { next(err); }
}

/* ============================================================
   PROFILE
   ============================================================ */
async function getProfile(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
}

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

async function changePassword(req, res, next) {
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

    res.json({ success: true, message: 'Password changed.' });
  } catch (err) { next(err); }
}

/* ============================================================
   PROFILE PHOTO UPLOAD
   ============================================================ */
async function uploadPhoto(req, res, next) {
  try {
    const { photo } = req.body;
    if (!photo || !photo.startsWith('data:image/')) {
      throw new AppError('Invalid image.', 400);
    }

    // Ensure the column exists (idempotent)
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT');
    await db.query('UPDATE users SET photo_url = $1 WHERE id = $2', [photo, req.user.id]);

    res.json({ success: true, message: 'Photo updated.' });
  } catch (err) { next(err); }
}

/* ============================================================
   MY COURSES (registered)
   ============================================================ */
async function getMyCourses(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);
    const r = await db.query(`
      SELECT c.id, c.code, c.title, c.units, c.level, c.semester_name,
             u.full_name AS lecturer_name
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
        LEFT JOIN lecturers l ON l.id = c.lecturer_id
        LEFT JOIN users u ON u.id = l.user_id
       WHERE cr.student_id = $1 AND cr.status != 'dropped'
       ORDER BY c.code
    `, [student.id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ============================================================
   COURSE REGISTRATION — Available / Registered / Add / Drop
   ============================================================ */

/**
 * GET /api/student/available-courses
 * Lists all active courses in the student's department, at their
 * level or lower, in the active semester, that they have NOT
 * yet registered for.
 */
async function getAvailableCourses(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);

    // Active session + semester
    const [sessRow, semRow] = await Promise.all([
      db.query(`SELECT id, name FROM sessions WHERE is_active = TRUE LIMIT 1`),
      db.query(`SELECT id, name FROM semesters WHERE is_active = TRUE LIMIT 1`),
    ]);
    if (!sessRow.rows[0] || !semRow.rows[0]) {
      throw new AppError('No active session/semester. Contact admin.', 400);
    }
    const sessionId = sessRow.rows[0].id;
    const semesterId = semRow.rows[0].id;
    const activeSemName = semRow.rows[0].name;

    console.log('[available-courses]', {
      student: student.matric_no,
      dept: student.department_id,
      level: student.level,
      semName: activeSemName,
    });

    // ⚡ MAIN QUERY:
    //   - Courses in the student's department
    //   - Active courses only
    //   - Course semester matches the active semester
    //   - Course level = student's level OR lower (so they always have options)
    //   - Excludes courses already registered (excluding dropped)
    const courses = await db.query(`
      SELECT c.id, c.code, c.title, c.units, c.level, c.semester_name,
             u.full_name AS lecturer_name,
             (SELECT COUNT(*)::int FROM course_registrations cr
               WHERE cr.course_id = c.id
                 AND cr.session_id = $4
                 AND cr.semester_id = $5) AS total_registered
        FROM courses c
        LEFT JOIN lecturers l ON l.id = c.lecturer_id
        LEFT JOIN users u ON u.id = l.user_id
       WHERE c.department_id = $1
         AND c.is_active = TRUE
         AND c.level <= $2
         AND c.level >= ($2 - 300)
         AND c.semester_name = $6
         AND NOT EXISTS (
           SELECT 1 FROM course_registrations cr
            WHERE cr.student_id = $3
              AND cr.course_id = c.id
              AND cr.session_id = $4
              AND cr.semester_id = $5
              AND cr.status != 'dropped'
         )
       ORDER BY c.level DESC, c.code
    `, [student.department_id, student.level, student.id, sessionId, semesterId, activeSemName]);

    console.log('[available-courses] found', courses.rows.length, 'courses');

    res.json({
      success: true,
      data: {
        courses: courses.rows,
        session: sessRow.rows[0],
        semester: semRow.rows[0],
      },
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/student/register-course
 * Body: { course_id }
 */
async function registerCourse(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);
    const { course_id } = req.body;

    if (!course_id) throw new AppError('Course ID required.', 400);

    const [sessRow, semRow] = await Promise.all([
      db.query(`SELECT id FROM sessions WHERE is_active = TRUE LIMIT 1`),
      db.query(`SELECT id FROM semesters WHERE is_active = TRUE LIMIT 1`),
    ]);
    if (!sessRow.rows[0] || !semRow.rows[0]) {
      throw new AppError('No active session/semester.', 400);
    }
    const sessionId = sessRow.rows[0].id;
    const semesterId = semRow.rows[0].id;

    // Verify course belongs to student's department and is at or below their level
    const course = await db.query(
      `SELECT id, units FROM courses
        WHERE id = $1
          AND department_id = $2
          AND level <= $3
          AND is_active = TRUE`,
      [course_id, student.department_id, student.level]
    );
    if (!course.rows[0]) {
      throw new AppError('Invalid course for your department/level.', 400);
    }

    // Credit unit limit check
    const totalUnits = await db.query(`
      SELECT COALESCE(SUM(c.units), 0)::int AS total
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.student_id = $1
         AND cr.session_id = $2
         AND cr.semester_id = $3
         AND cr.status != 'dropped'
    `, [student.id, sessionId, semesterId]);

    const MAX_UNITS = 24;
    if (totalUnits.rows[0].total + course.rows[0].units > MAX_UNITS) {
      throw new AppError(
        `Credit unit limit is ${MAX_UNITS}. You already have ${totalUnits.rows[0].total}.`,
        400
      );
    }

    // Insert or re-activate registration
    const result = await db.query(`
      INSERT INTO course_registrations
        (student_id, course_id, session_id, semester_id, status)
      VALUES ($1, $2, $3, $4, 'registered')
      ON CONFLICT (student_id, course_id, session_id, semester_id)
      DO UPDATE SET status = 'registered', registered_at = NOW()
      RETURNING id
    `, [student.id, course_id, sessionId, semesterId]);

    // Audit
    await db.query(`
      INSERT INTO audit_logs (user_id, action, module, affected_record)
      VALUES ($1, 'register_course', 'courses', $2)
    `, [req.user.id, `registration:${result.rows[0].id}`]);

    res.json({
      success: true,
      message: 'Course registered.',
      data: { id: result.rows[0].id },
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/student/drop-course/:id
 * Sets registration status = 'dropped'.
 */
async function dropCourse(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);
    const regId = parseInt(req.params.id, 10);

    const reg = await db.query(
      `SELECT id, status FROM course_registrations WHERE id = $1 AND student_id = $2`,
      [regId, student.id]
    );
    if (!reg.rows[0]) throw new AppError('Registration not found.', 404);
    if (reg.rows[0].status === 'dropped') throw new AppError('Already dropped.', 400);

    await db.query(
      `UPDATE course_registrations SET status = 'dropped' WHERE id = $1`,
      [regId]
    );

    await db.query(`
      INSERT INTO audit_logs (user_id, action, module, affected_record)
      VALUES ($1, 'drop_course', 'courses', $2)
    `, [req.user.id, `registration:${regId}`]);

    res.json({ success: true, message: 'Course dropped.' });
  } catch (err) { next(err); }
}

/**
 * GET /api/student/my-registrations
 */
async function getMyRegistrations(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);

    // Determine programme level (ND or HND)
    const prog = await db.query('SELECT code FROM programmes WHERE id = $1', [student.programme_id]);
    const progCode = prog.rows[0]?.code || '';
    const isHND = progCode.endsWith('-HND');

    const MIN_UNITS = 15;
    const MAX_UNITS = isHND ? 18 : 20;

    const r = await db.query(`
      SELECT cr.id, cr.status, cr.registered_at,
             c.id AS course_id, c.code, c.title, c.units, c.level, c.semester_name,
             u.full_name AS lecturer_name,
             sess.name AS session_name, sem.name AS semester_name
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
        LEFT JOIN lecturers l ON l.id = c.lecturer_id
        LEFT JOIN users u ON u.id = l.user_id
        JOIN sessions sess ON sess.id = cr.session_id
        JOIN semesters sem ON sem.id = cr.semester_id
       WHERE cr.student_id = $1 AND cr.status != 'dropped'
       ORDER BY c.level DESC, c.code
    `, [student.id]);

    const totalUnits = r.rows.reduce((sum, x) => sum + (x.units || 0), 0);

    res.json({
      success: true,
      data: {
        registrations: r.rows,
        totalUnits,
        minUnits: MIN_UNITS,
        maxUnits: MAX_UNITS,
        remainingUnits: Math.max(0, MAX_UNITS - totalUnits),
        programmeLevel: isHND ? 'HND' : 'ND',
      },
    });
  } catch (err) { next(err); }
}

/* ============================================================
   ATTENDANCE
   ============================================================ */
async function getMyAttendance(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);

    const byCourse = await db.query(`
      SELECT c.code, c.title,
             COUNT(*)::int AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END)::int AS absent,
             SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END)::int AS excused,
             ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN courses c ON c.id = cs.course_id
       WHERE a.student_id = $1
       GROUP BY c.id, c.code, c.title
       ORDER BY c.code
    `, [student.id]);

    const records = await db.query(`
      SELECT a.id, a.status, a.remarks, cs.session_date, cs.topic,
             c.code, c.title
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN courses c ON c.id = cs.course_id
       WHERE a.student_id = $1
       ORDER BY cs.session_date DESC
       LIMIT 100
    `, [student.id]);

    res.json({ success: true, data: { byCourse: byCourse.rows, records: records.rows } });
  } catch (err) { next(err); }
}

/* ============================================================
   RESULTS
   ============================================================ */
async function getMyResults(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);
    const r = await db.query(`
      SELECT r.id, r.ca_score, r.exam_score, r.total_score, r.grade, r.grade_point,
             r.is_published, r.computed_at,
             c.code, c.title, c.units,
             sess.name AS session_name, sem.name AS semester_name
        FROM results r
        JOIN courses c ON c.id = r.course_id
        JOIN sessions sess ON sess.id = r.session_id
        JOIN semesters sem ON sem.id = r.semester_id
       WHERE r.student_id = $1 AND r.is_published = TRUE
       ORDER BY r.computed_at DESC
    `, [student.id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ============================================================
   GPA / CGPA
   ============================================================ */
async function getGpaCgpa(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);
    const r = await db.query(`
      SELECT r.*, c.code, c.title, c.units,
             sess.id AS session_id, sem.id AS semester_id,
             sess.name AS session_name, sem.name AS semester_name
        FROM results r
        JOIN courses c ON c.id = r.course_id
        JOIN sessions sess ON sess.id = r.session_id
        JOIN semesters sem ON sem.id = r.semester_id
       WHERE r.student_id = $1 AND r.is_published = TRUE
    `, [student.id]);

    const summary = summarize(r.rows);
    res.json({ success: true, data: { summary, results: r.rows } });
  } catch (err) { next(err); }
}

/* ============================================================
   PERFORMANCE
   ============================================================ */
async function getPerformance(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);

    const byCourse = await db.query(`
      SELECT c.code, c.title, c.units,
             ROUND(AVG(r.total_score)::numeric, 2) AS avg_score,
             MIN(r.total_score) AS min_score,
             MAX(r.total_score) AS max_score
        FROM results r JOIN courses c ON c.id = r.course_id
       WHERE r.student_id = $1
       GROUP BY c.id, c.code, c.title, c.units
       ORDER BY c.code
    `, [student.id]);

    const trend = await db.query(`
      SELECT sess.name AS session_name, sem.name AS semester_name,
             ROUND(AVG(r.grade_point)::numeric, 2) AS gpa
        FROM results r
        JOIN sessions sess ON sess.id = r.session_id
        JOIN semesters sem ON sem.id = r.semester_id
       WHERE r.student_id = $1
       GROUP BY sess.id, sem.id, sess.name, sem.name
       ORDER BY sess.id, sem.id
    `, [student.id]);

    res.json({ success: true, data: { byCourse: byCourse.rows, trend: trend.rows } });
  } catch (err) { next(err); }
}

/* ============================================================
   ACADEMIC STATUS
   ============================================================ */
async function getAcademicStatus(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);

    const [risk, attendance, gpa] = await Promise.all([
      db.query('SELECT * FROM risk_assessments WHERE student_id = $1 ORDER BY assessed_at DESC LIMIT 1', [student.id]),
      db.query(`
        SELECT ROUND((SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
          FROM attendance WHERE student_id = $1
      `, [student.id]),
      db.query(`
        SELECT ROUND(AVG(grade_point)::numeric, 2) AS gpa, COUNT(*) FILTER (WHERE grade = 'F')::int AS failed
          FROM results WHERE student_id = $1
      `, [student.id]),
    ]);

    res.json({
      success: true,
      data: {
        student,
        risk: risk.rows[0] || null,
        attendancePct: parseFloat(attendance.rows[0].pct || 0),
        gpa: parseFloat(gpa.rows[0].gpa || 0),
        failedCourses: gpa.rows[0].failed,
      },
    });
  } catch (err) { next(err); }
}

/* ============================================================
   INTERVENTIONS
   ============================================================ */
async function getMyInterventions(req, res, next) {
  try {
    const student = await getStudentProfile(req.user.id);
    const r = await db.query(`
      SELECT i.*, u.full_name AS assignee_name
        FROM interventions i
        LEFT JOIN users u ON u.id = i.assigned_to
       WHERE i.student_id = $1
       ORDER BY i.created_at DESC
    `, [student.id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = {
  // Dashboard
  getDashboard,

  // Profile
  getProfile,
  updateOwnProfile,
  changePassword,
  uploadPhoto,

  // Courses
  getMyCourses,
  getAvailableCourses,
  registerCourse,
  dropCourse,
  getMyRegistrations,

  // Attendance
  getMyAttendance,

  // Results
  getMyResults,
  getGpaCgpa,
  getPerformance,

  // Status
  getAcademicStatus,

  // Interventions
  getMyInterventions,
};