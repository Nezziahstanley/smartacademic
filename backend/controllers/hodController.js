// ============================================================
// SMARTACADEMIC — HOD Controller
// All queries scoped to the HOD's department.
// ============================================================

'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * Get the department ID for the logged-in HOD.
 */
async function getHodDepartmentId(userId) {
  const r = await db.query(
    'SELECT id FROM departments WHERE hod_id = $1 AND is_active = TRUE',
    [userId]
  );
  if (!r.rows[0]) throw new AppError('You are not assigned as HOD of any department.', 403);
  return r.rows[0].id;
}

/* ==================== DASHBOARD ==================== */
async function getDashboard(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);

    const [dept, students, lecturers, courses, risk, gpaAvg, attendanceAvg] = await Promise.all([
      db.query('SELECT id, name, code FROM departments WHERE id = $1', [deptId]),
      db.query('SELECT COUNT(*)::int AS n FROM students WHERE department_id = $1 AND is_active = TRUE', [deptId]),
      db.query('SELECT COUNT(*)::int AS n FROM lecturers WHERE department_id = $1 AND is_active = TRUE', [deptId]),
      db.query('SELECT COUNT(*)::int AS n FROM courses WHERE department_id = $1 AND is_active = TRUE', [deptId]),
      db.query(`
        SELECT ra.risk_category, COUNT(*)::int AS n
          FROM risk_assessments ra
          JOIN students s ON s.id = ra.student_id
         WHERE s.department_id = $1
           AND ra.assessed_at = (
             SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
           )
         GROUP BY ra.risk_category
      `, [deptId]),
      db.query(`
        SELECT ROUND(AVG(r.grade_point)::numeric, 2) AS avg
          FROM results r
          JOIN students s ON s.id = r.student_id
         WHERE s.department_id = $1
      `, [deptId]),
      db.query(`
        SELECT ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
          FROM attendance a
          JOIN class_sessions cs ON cs.id = a.class_session_id
          JOIN courses c ON c.id = cs.course_id
         WHERE c.department_id = $1
      `, [deptId]),
    ]);

    const riskMap = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    risk.rows.forEach(r => { riskMap[r.risk_category] = r.n; });

    const highRisk = await db.query(`
      SELECT s.id, s.matric_no, s.level, u.full_name,
             ra.risk_score, ra.risk_category, ra.assessed_at
        FROM risk_assessments ra
        JOIN students s ON s.id = ra.student_id
        JOIN users u ON u.id = s.user_id
       WHERE s.department_id = $1
         AND ra.risk_category IN ('ORANGE','RED')
         AND ra.assessed_at = (
           SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
         )
       ORDER BY ra.risk_score DESC
       LIMIT 8
    `, [deptId]);

    const coursePerformance = await db.query(`
      SELECT c.code, c.title, COUNT(DISTINCT cr.student_id)::int AS students,
             ROUND(AVG(r.total_score)::numeric, 2) AS avg_score
        FROM courses c
        LEFT JOIN course_registrations cr ON cr.course_id = c.id
        LEFT JOIN results r ON r.course_id = c.id
       WHERE c.department_id = $1
       GROUP BY c.id, c.code, c.title
       ORDER BY c.code
       LIMIT 8
    `, [deptId]);

    res.json({
      success: true,
      data: {
        department: dept.rows[0],
        counts: {
          students: students.rows[0].n,
          lecturers: lecturers.rows[0].n,
          courses: courses.rows[0].n,
        },
        risk: riskMap,
        gpaAverage: parseFloat(gpaAvg.rows[0].avg || 0),
        attendanceAverage: parseFloat(attendanceAvg.rows[0].pct || 0),
        highRisk: highRisk.rows,
        coursePerformance: coursePerformance.rows,
      },
    });
  } catch (err) { next(err); }
}

/* ==================== STUDENTS ==================== */
async function listStudents(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const { search, level } = req.query;
    const params = [deptId]; const where = ['s.department_id = $1'];

    if (level) { params.push(parseInt(level, 10)); where.push(`s.level = $${params.length}`); }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`);
    }

    const r = await db.query(`
      SELECT s.id, s.matric_no, s.level, u.full_name, u.email, u.phone,
             p.name AS programme_name,
             COALESCE(ra.risk_category, 'GREEN') AS risk_category,
             ra.risk_score
        FROM students s
        JOIN users u ON u.id = s.user_id
        JOIN programmes p ON p.id = s.programme_id
        LEFT JOIN risk_assessments ra ON ra.student_id = s.id
             AND ra.assessed_at = (SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = s.id)
       WHERE ${where.join(' AND ')}
       ORDER BY u.full_name
    `, params);

    res.json({ success: true, data: { items: r.rows, total: r.rows.length } });
  } catch (err) { next(err); }
}

async function getStudentDetail(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const studentId = parseInt(req.params.id, 10);

    const info = await db.query(`
      SELECT s.*, u.full_name, u.email, u.phone, p.name AS programme_name
        FROM students s
        JOIN users u ON u.id = s.user_id
        JOIN programmes p ON p.id = s.programme_id
       WHERE s.id = $1 AND s.department_id = $2
    `, [studentId, deptId]);
    if (!info.rows[0]) throw new AppError('Student not found in your department.', 404);

    const [results, attendance, risk, interventions] = await Promise.all([
      db.query(`
        SELECT r.*, c.code, c.title, c.units
          FROM results r JOIN courses c ON c.id = r.course_id
         WHERE r.student_id = $1 ORDER BY r.computed_at DESC
      `, [studentId]),
      db.query(`
        SELECT COUNT(*)::int AS total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::int AS present,
               ROUND((SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
          FROM attendance WHERE student_id = $1
      `, [studentId]),
      db.query(`SELECT * FROM risk_assessments WHERE student_id = $1 ORDER BY assessed_at DESC LIMIT 5`, [studentId]),
      db.query(`
        SELECT i.*, u.full_name AS assignee_name
          FROM interventions i LEFT JOIN users u ON u.id = i.assigned_to
         WHERE i.student_id = $1 ORDER BY i.created_at DESC
      `, [studentId]),
    ]);

    res.json({
      success: true,
      data: {
        student: info.rows[0],
        results: results.rows,
        attendance: attendance.rows[0],
        risk: risk.rows,
        interventions: interventions.rows,
      },
    });
  } catch (err) { next(err); }
}

/* ==================== LECTURERS ==================== */
async function listLecturers(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const r = await db.query(`
      SELECT l.id, l.staff_id, l.title, u.full_name, u.email, u.phone,
             (SELECT COUNT(*)::int FROM courses c WHERE c.lecturer_id = l.id) AS course_count
        FROM lecturers l
        JOIN users u ON u.id = l.user_id
       WHERE l.department_id = $1 AND l.is_active = TRUE
       ORDER BY u.full_name
    `, [deptId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== COURSES ==================== */
async function listCourses(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const r = await db.query(`
      SELECT c.id, c.code, c.title, c.units, c.level, c.semester_name,
             c.lecturer_id, u.full_name AS lecturer_name,
             (SELECT COUNT(*)::int FROM course_registrations cr WHERE cr.course_id = c.id) AS registered
        FROM courses c
        LEFT JOIN lecturers l ON l.id = c.lecturer_id
        LEFT JOIN users u ON u.id = l.user_id
       WHERE c.department_id = $1 AND c.is_active = TRUE
       ORDER BY c.level, c.code
    `, [deptId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function createCourse(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const { code, title, units, level, semester_name, lecturer_id } = req.body;

    if (!code || !title) throw new AppError('Code and title required.', 400);

    // Check for duplicate code within the department
    const dupe = await db.query(
      'SELECT 1 FROM courses WHERE code = $1 AND department_id = $2',
      [code, deptId]
    );
    if (dupe.rows[0]) throw new AppError(`Course code ${code} already exists in your department.`, 409);

    const r = await db.query(`
      INSERT INTO courses
        (code, title, units, department_id, programme_id, level, semester_name, lecturer_id, is_active)
      VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, TRUE)
      RETURNING id
    `, [code, title, units, deptId, level, semester_name, lecturer_id || null]);

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

async function updateCourse(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const id = parseInt(req.params.id, 10);
    const { code, title, units, level, semester_name, lecturer_id, is_active } = req.body;

    // Verify ownership
    const owns = await db.query('SELECT 1 FROM courses WHERE id = $1 AND department_id = $2', [id, deptId]);
    if (!owns.rows[0]) throw new AppError('Course not in your department.', 403);

    await db.query(`
      UPDATE courses
         SET code = COALESCE($2, code),
             title = COALESCE($3, title),
             units = COALESCE($4, units),
             level = COALESCE($5, level),
             semester_name = COALESCE($6, semester_name),
             lecturer_id = $7,
             is_active = COALESCE($8, is_active),
             updated_at = NOW()
       WHERE id = $1
    `, [id, code, title, units, level, semester_name,
        lecturer_id === undefined ? null : lecturer_id,
        is_active]);

    res.json({ success: true, message: 'Course updated.' });
  } catch (err) { next(err); }
}

async function deleteCourse(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const id = parseInt(req.params.id, 10);

    const owns = await db.query('SELECT 1 FROM courses WHERE id = $1 AND department_id = $2', [id, deptId]);
    if (!owns.rows[0]) throw new AppError('Course not in your department.', 403);

    await db.query('DELETE FROM courses WHERE id = $1', [id]);
    res.json({ success: true, message: 'Course deleted.' });
  } catch (err) { next(err); }
}

async function assignLecturerToCourse(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const courseId = parseInt(req.params.courseId, 10);
    const { lecturer_id } = req.body;

    const course = await db.query(
      'SELECT id FROM courses WHERE id = $1 AND department_id = $2',
      [courseId, deptId]
    );
    if (!course.rows[0]) throw new AppError('Course not in your department.', 403);

    const lecturer = await db.query(
      'SELECT id FROM lecturers WHERE id = $1 AND department_id = $2',
      [lecturer_id, deptId]
    );
    if (!lecturer.rows[0]) throw new AppError('Lecturer not in your department.', 403);

    await db.query(
      'UPDATE courses SET lecturer_id = $1, updated_at = NOW() WHERE id = $2',
      [lecturer_id, courseId]
    );

    res.json({ success: true, message: 'Lecturer assigned.' });
  } catch (err) { next(err); }
}

/* ==================== ATTENDANCE ==================== */
async function getAttendanceOverview(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const byCourse = await db.query(`
      SELECT c.id, c.code, c.title,
             COUNT(*)::int AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN courses c ON c.id = cs.course_id
       WHERE c.department_id = $1
       GROUP BY c.id, c.code, c.title
       ORDER BY pct ASC NULLS LAST
    `, [deptId]);

    const lowAttendance = await db.query(`
      SELECT s.id, s.matric_no, u.full_name,
             COUNT(*)::int AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
       WHERE s.department_id = $1
       GROUP BY s.id, s.matric_no, u.full_name
       HAVING (SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) < 0.75
       ORDER BY pct ASC
       LIMIT 20
    `, [deptId]);

    res.json({ success: true, data: { byCourse: byCourse.rows, lowAttendance: lowAttendance.rows } });
  } catch (err) { next(err); }
}

/* ==================== PERFORMANCE ==================== */
async function getPerformance(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);

    const byLevel = await db.query(`
      SELECT s.level,
             COUNT(DISTINCT s.id)::int AS students,
             ROUND(AVG(r.grade_point)::numeric, 2) AS avg_gpa
        FROM students s
        LEFT JOIN results r ON r.student_id = s.id
       WHERE s.department_id = $1
       GROUP BY s.level
       ORDER BY s.level
    `, [deptId]);

    const topPerformers = await db.query(`
      SELECT s.id, s.matric_no, s.level, u.full_name,
             ROUND(AVG(r.grade_point)::numeric, 2) AS gpa
        FROM students s
        JOIN users u ON u.id = s.user_id
        JOIN results r ON r.student_id = s.id
       WHERE s.department_id = $1
       GROUP BY s.id, s.matric_no, s.level, u.full_name
       ORDER BY gpa DESC NULLS LAST
       LIMIT 10
    `, [deptId]);

    const failedCourses = await db.query(`
      SELECT c.code, c.title, COUNT(*)::int AS failures
        FROM results r
        JOIN courses c ON c.id = r.course_id
        JOIN students s ON s.id = r.student_id
       WHERE s.department_id = $1 AND r.grade = 'F'
       GROUP BY c.id, c.code, c.title
       ORDER BY failures DESC
       LIMIT 10
    `, [deptId]);

    res.json({ success: true, data: { byLevel: byLevel.rows, topPerformers: topPerformers.rows, failedCourses: failedCourses.rows } });
  } catch (err) { next(err); }
}

/* ==================== RISK ==================== */
async function listRisk(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const { category, level } = req.query;
    const params = [deptId]; const where = ['s.department_id = $1'];
    if (category) { params.push(category); where.push(`ra.risk_category = $${params.length}`); }
    if (level) { params.push(parseInt(level, 10)); where.push(`s.level = $${params.length}`); }

    const r = await db.query(`
      SELECT ra.id, ra.risk_score, ra.risk_category, ra.attendance_pct, ra.gpa,
             ra.failed_courses, ra.factors, ra.assessed_at,
             s.id AS student_id, s.matric_no, s.level, u.full_name, u.email
        FROM risk_assessments ra
        JOIN students s ON s.id = ra.student_id
        JOIN users u ON u.id = s.user_id
       WHERE ${where.join(' AND ')}
         AND ra.assessed_at = (
           SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
         )
       ORDER BY
         CASE ra.risk_category WHEN 'RED' THEN 1 WHEN 'ORANGE' THEN 2 WHEN 'YELLOW' THEN 3 ELSE 4 END,
         ra.risk_score DESC
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== INTERVENTIONS ==================== */
async function listInterventions(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const { status } = req.query;
    const params = [deptId]; const where = ['s.department_id = $1'];
    if (status) { params.push(status); where.push(`i.status = $${params.length}`); }

    const r = await db.query(`
      SELECT i.*, u.full_name AS student_name, s.matric_no,
             a.full_name AS assignee_name
        FROM interventions i
        JOIN students s ON s.id = i.student_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN users a ON a.id = i.assigned_to
       WHERE ${where.join(' AND ')}
       ORDER BY i.created_at DESC
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function createIntervention(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const { student_id, type, title, description, assigned_to, priority, due_date } = req.body;

    const s = await db.query('SELECT id FROM students WHERE id = $1 AND department_id = $2', [student_id, deptId]);
    if (!s.rows[0]) throw new AppError('Student not in your department.', 403);

    const r = await db.query(`
      INSERT INTO interventions (student_id, type, title, description, assigned_to, priority, due_date, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [student_id, type, title, description || null, assigned_to || null,
        priority || 'medium', due_date || null, req.user.id]);

    if (assigned_to) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES ($1, 'New intervention assigned', $2, 'intervention', $3)
      `, [assigned_to, `You have been assigned: ${title}`, r.rows[0].id]);
    }

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

async function updateIntervention(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const id = parseInt(req.params.id, 10);

    const belongs = await db.query(`
      SELECT i.id FROM interventions i
        JOIN students s ON s.id = i.student_id
       WHERE i.id = $1 AND s.department_id = $2
    `, [id, deptId]);
    if (!belongs.rows[0]) throw new AppError('Intervention not in your department.', 403);

    const { status, priority, notes, assigned_to, due_date } = req.body;
    await db.query(`
      UPDATE interventions SET
        status = COALESCE($2, status),
        priority = COALESCE($3, priority),
        notes = COALESCE($4, notes),
        assigned_to = $5,
        due_date = $6,
        completed_at = CASE WHEN $2 = 'Completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END
       WHERE id = $1
    `, [id, status, priority, notes, assigned_to, due_date]);

    res.json({ success: true });
  } catch (err) { next(err); }
}

async function listStaff(req, res, next) {
  try {
    const deptId = await getHodDepartmentId(req.user.id);
    const r = await db.query(`
      SELECT u.id, u.full_name, u.email, r.name AS role
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN lecturers l ON l.user_id = u.id
       WHERE u.is_active = TRUE
         AND (l.department_id = $1 OR u.id = $2)
         AND r.name IN ('lecturer', 'hod', 'admin')
       ORDER BY u.full_name
    `, [deptId, req.user.id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== PROFILE (own account) ==================== */
async function updateOwnProfile(req, res, next) {
  try {
    const { full_name, phone } = req.body;
    await db.query(`
      UPDATE users SET full_name = COALESCE($2, full_name), phone = COALESCE($3, phone)
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

/* ==================== PROFILE PHOTO ==================== */
async function uploadOwnPhoto(req, res, next) {
  try {
    const { photo } = req.body;
    if (!photo || !photo.startsWith('data:image/')) {
      throw new AppError('Invalid image.', 400);
    }
    if (photo.length > 8_000_000) {
      throw new AppError('Image too large (max ~2 MB).', 400);
    }

    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT');
    await db.query(
      'UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2',
      [photo, req.user.id]
    );

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

/* ==================== EXPORTS ==================== */
module.exports = {
  getDashboard,
  listStudents,
  getStudentDetail,
  listLecturers,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  assignLecturerToCourse,
  getAttendanceOverview,
  getPerformance,
  listRisk,
  listInterventions,
  createIntervention,
  updateIntervention,
  listStaff,
  updateOwnProfile,
  changePassword,
  uploadOwnPhoto,
  removeOwnPhoto,
};