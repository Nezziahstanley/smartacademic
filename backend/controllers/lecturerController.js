// ============================================================
// SMARTACADEMIC — Lecturer Controller
// All data scoped to courses taught by the logged-in lecturer.
// Includes audit logging on every mutating action.
// ============================================================

'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const adminModel = require('../models/adminModel');

/* ============================================================
   HELPERS
   ============================================================ */
async function getLecturerId(userId) {
  const r = await db.query(
    'SELECT id, department_id FROM lecturers WHERE user_id = $1',
    [userId]
  );
  if (!r.rows[0]) throw new AppError('Lecturer profile not found.', 403);
  return r.rows[0];
}

async function assertCourseOwnership(lecturerId, courseId) {
  const r = await db.query(
    'SELECT 1 FROM courses WHERE id = $1 AND lecturer_id = $2',
    [courseId, lecturerId]
  );
  if (!r.rows[0]) throw new AppError('You do not teach this course.', 403);
}

/* ==================== DASHBOARD ==================== */
async function getDashboard(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);

    const [courses, studentsCount, atRisk, avgAttendance] = await Promise.all([
      db.query(`
        SELECT c.id, c.code, c.title, c.units, c.level, c.semester_name,
               (SELECT COUNT(*)::int FROM course_registrations cr
                 WHERE cr.course_id = c.id AND cr.status != 'dropped') AS registered
          FROM courses c
         WHERE c.lecturer_id = $1 AND c.is_active = TRUE
         ORDER BY c.code
      `, [lecturerId]),

      db.query(`
        SELECT COUNT(DISTINCT cr.student_id)::int AS n
          FROM course_registrations cr
          JOIN courses c ON c.id = cr.course_id
         WHERE c.lecturer_id = $1
           AND cr.status != 'dropped'
      `, [lecturerId]),

      db.query(`
        SELECT DISTINCT ON (s.id)
               ra.id, ra.risk_category, ra.risk_score, ra.assessed_at,
               s.id AS student_id, s.matric_no, s.level, u.full_name
          FROM risk_assessments ra
          JOIN students s ON s.id = ra.student_id
          JOIN users u ON u.id = s.user_id
          JOIN course_registrations cr ON cr.student_id = s.id
          JOIN courses c ON c.id = cr.course_id
         WHERE c.lecturer_id = $1
           AND cr.status != 'dropped'
           AND ra.risk_category IN ('ORANGE', 'RED')
           AND ra.assessed_at = (
             SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = s.id
           )
         ORDER BY s.id, ra.risk_score DESC
         LIMIT 20
      `, [lecturerId]),

      db.query(`
        SELECT ROUND(
                 (SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric
                  / NULLIF(COUNT(*),0)) * 100, 2
               ) AS pct
          FROM attendance a
          JOIN class_sessions cs ON cs.id = a.class_session_id
          JOIN courses c ON c.id = cs.course_id
         WHERE c.lecturer_id = $1
      `, [lecturerId]),
    ]);

    res.json({
      success: true,
      data: {
        courses: courses.rows,
        totalStudents: studentsCount.rows[0].n,
        atRisk: atRisk.rows,
        avgAttendance: parseFloat(avgAttendance.rows[0].pct || 0),
      },
    });
  } catch (err) { next(err); }
}

/* ==================== MY COURSES ==================== */
async function listMyCourses(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const r = await db.query(`
      SELECT c.id, c.code, c.title, c.units, c.level, c.semester_name,
             (SELECT COUNT(*)::int FROM course_registrations cr
               WHERE cr.course_id = c.id AND cr.status != 'dropped') AS registered
        FROM courses c
       WHERE c.lecturer_id = $1 AND c.is_active = TRUE
       ORDER BY c.code
    `, [lecturerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== STUDENTS (scoped) ==================== */
async function listStudents(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id, search } = req.query;

    const params = [lecturerId];
    const where = [];

    if (course_id) {
      const cid = parseInt(course_id, 10);
      await assertCourseOwnership(lecturerId, cid);
      params.push(cid);
      where.push(`c.id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(
        `(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`
      );
    }

    const r = await db.query(`
      SELECT
        s.id            AS student_id,
        s.matric_no,
        s.level,
        s.is_active,
        u.id            AS user_id,
        u.full_name,
        u.email,
        u.phone,
        c.id            AS course_id,
        c.code          AS course_code,
        c.title         AS course_title,
        cr.status       AS registration_status,
        cr.registered_at,
        COALESCE(ra.risk_category, 'GREEN') AS risk_category,
        ra.risk_score
      FROM course_registrations cr
      JOIN courses c   ON c.id = cr.course_id
      JOIN students s  ON s.id = cr.student_id
      JOIN users u     ON u.id = s.user_id
      LEFT JOIN risk_assessments ra
             ON ra.student_id = s.id
            AND ra.assessed_at = (
              SELECT MAX(assessed_at)
                FROM risk_assessments
               WHERE student_id = s.id
            )
      WHERE c.lecturer_id = $1
        AND cr.status != 'dropped'
        ${where.length ? 'AND ' + where.join(' AND ') : ''}
      ORDER BY c.code, u.full_name
    `, params);

    const courses = await db.query(`
      SELECT c.id, c.code, c.title, c.level, c.semester_name,
             (SELECT COUNT(*)::int FROM course_registrations cr
               WHERE cr.course_id = c.id AND cr.status != 'dropped') AS students
        FROM courses c
       WHERE c.lecturer_id = $1 AND c.is_active = TRUE
       ORDER BY c.code
    `, [lecturerId]);

    res.json({
      success: true,
      data: {
        items: r.rows,
        courses: courses.rows,
        total: r.rows.length,
      },
    });
  } catch (err) { next(err); }
}

/* ==================== STUDENT DETAIL (scoped) ==================== */
async function getStudentDetail(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const studentId = parseInt(req.params.id, 10);

    const belongs = await db.query(`
      SELECT 1
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.student_id = $1
         AND c.lecturer_id = $2
         AND cr.status != 'dropped'
       LIMIT 1
    `, [studentId, lecturerId]);
    if (!belongs.rows[0]) {
      throw new AppError('Student is not registered in any of your courses.', 403);
    }

    const student = await db.query(`
      SELECT s.id, s.matric_no, s.level, s.admission_year,
             u.full_name, u.email, u.phone, u.photo_url
        FROM students s
        JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
    `, [studentId]);

    const attendance = await db.query(`
      SELECT
        COUNT(*)::int                                              AS total,
        SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int   AS present,
        SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END)::int   AS absent,
        SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END)::int   AS excused,
        ROUND(
          (SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric
           / NULLIF(COUNT(*),0)) * 100, 2
        )                                                          AS pct
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN courses c         ON c.id = cs.course_id
       WHERE a.student_id = $1
         AND c.lecturer_id = $2
    `, [studentId, lecturerId]);

    const attendanceByCourse = await db.query(`
      SELECT c.id AS course_id, c.code, c.title,
             COUNT(*)::int                                            AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END)::int AS absent,
             SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END)::int AS excused,
             ROUND(
               (SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric
                / NULLIF(COUNT(*),0)) * 100, 2
             )                                                        AS pct
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN courses c         ON c.id = cs.course_id
       WHERE a.student_id = $1
         AND c.lecturer_id = $2
       GROUP BY c.id, c.code, c.title
       ORDER BY c.code
    `, [studentId, lecturerId]);

    const risk = await db.query(`
      SELECT risk_score, risk_category, attendance_pct, ca_avg, exam_avg,
             failed_courses, gpa, cgpa, factors, assessed_at
        FROM risk_assessments
       WHERE student_id = $1
       ORDER BY assessed_at DESC
       LIMIT 1
    `, [studentId]);

    const results = await db.query(`
      SELECT r.id, r.total_score, r.grade, r.grade_point,
             r.ca_score, r.exam_score, r.is_published, r.computed_at,
             c.code, c.title, c.units,
             sess.name AS session_name, sem.name AS semester_name
        FROM results r
        JOIN courses c       ON c.id = r.course_id
        JOIN sessions sess   ON sess.id = r.session_id
        JOIN semesters sem   ON sem.id = r.semester_id
       WHERE r.student_id = $1
         AND c.lecturer_id = $2
       ORDER BY r.computed_at DESC
    `, [studentId, lecturerId]);

    const registrations = await db.query(`
      SELECT cr.id, cr.status, cr.registered_at,
             c.id AS course_id, c.code, c.title, c.units, c.level, c.semester_name
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.student_id = $1
         AND c.lecturer_id = $2
         AND cr.status != 'dropped'
       ORDER BY c.code
    `, [studentId, lecturerId]);

    res.json({
      success: true,
      data: {
        student: student.rows[0],
        attendance: attendance.rows[0],
        attendanceByCourse: attendanceByCourse.rows,
        risk: risk.rows[0] || null,
        results: results.rows,
        registrations: registrations.rows,
      },
    });
  } catch (err) { next(err); }
}

/* ==================== CLASS SESSIONS ==================== */
async function listClassSessions(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id } = req.query;
    if (!course_id) throw new AppError('course_id is required.', 400);
    await assertCourseOwnership(lecturerId, parseInt(course_id, 10));

    const r = await db.query(`
      SELECT cs.id, cs.session_date, cs.start_time, cs.end_time, cs.topic,
             (SELECT COUNT(*)::int FROM attendance a WHERE a.class_session_id = cs.id) AS recorded
        FROM class_sessions cs
       WHERE cs.course_id = $1
       ORDER BY cs.session_date DESC
    `, [course_id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function createClassSession(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id, session_date, start_time, end_time, topic } = req.body;
    await assertCourseOwnership(lecturerId, course_id);

    const r = await db.query(`
      INSERT INTO class_sessions
        (course_id, session_date, start_time, end_time, topic, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [course_id, session_date, start_time || null, end_time || null, topic || null, req.user.id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'create_class_session',
      module: 'attendance',
      affected_record: `class_session:${r.rows[0].id}`,
      details: { course_id, session_date, topic },
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

/* ==================== ATTENDANCE ==================== */
async function getAttendance(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const classSessionId = parseInt(req.params.classSessionId, 10);

    const owns = await db.query(`
      SELECT cs.id, c.id AS course_id, c.code, c.title
        FROM class_sessions cs
        JOIN courses c ON c.id = cs.course_id
       WHERE cs.id = $1 AND c.lecturer_id = $2
    `, [classSessionId, lecturerId]);
    if (!owns.rows[0]) throw new AppError('Class session not found in your courses.', 404);

    const students = await db.query(`
      SELECT s.id, s.matric_no, u.full_name,
             COALESCE(a.status, NULL) AS status,
             a.id AS attendance_id, a.remarks
        FROM course_registrations cr
        JOIN students s ON s.id = cr.student_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN attendance a
               ON a.student_id = s.id
              AND a.class_session_id = $1
       WHERE cr.course_id = $2
         AND cr.status != 'dropped'
       ORDER BY u.full_name
    `, [classSessionId, owns.rows[0].course_id]);

    res.json({
      success: true,
      data: { session: owns.rows[0], students: students.rows },
    });
  } catch (err) { next(err); }
}

async function saveAttendance(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const classSessionId = parseInt(req.params.classSessionId, 10);
    const { records } = req.body;

    const owns = await db.query(`
      SELECT cs.id FROM class_sessions cs
        JOIN courses c ON c.id = cs.course_id
       WHERE cs.id = $1 AND c.lecturer_id = $2
    `, [classSessionId, lecturerId]);
    if (!owns.rows[0]) throw new AppError('Unauthorized.', 403);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const rec of records) {
        await client.query(`
          INSERT INTO attendance (class_session_id, student_id, status, remarks, recorded_by)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (class_session_id, student_id) DO UPDATE
             SET status = EXCLUDED.status,
                 remarks = EXCLUDED.remarks,
                 recorded_by = EXCLUDED.recorded_by,
                 recorded_at = NOW()
        `, [classSessionId, rec.student_id, rec.status, rec.remarks || null, req.user.id]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'save_attendance',
      module: 'attendance',
      affected_record: `class_session:${classSessionId}`,
      details: { records: records.length },
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Attendance saved.' });
  } catch (err) { next(err); }
}

async function attendanceSummary(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const courseId = parseInt(req.params.courseId, 10);
    await assertCourseOwnership(lecturerId, courseId);

    const r = await db.query(`
      SELECT s.id, s.matric_no, u.full_name,
             COUNT(*)::int                                             AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int  AS present,
             SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END)::int  AS absent,
             ROUND(
               (SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric
                / NULLIF(COUNT(*),0)) * 100, 2
             )                                                         AS pct
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
       WHERE cs.course_id = $1
       GROUP BY s.id, s.matric_no, u.full_name
       ORDER BY pct ASC NULLS LAST
    `, [courseId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== ASSESSMENTS ==================== */
async function listAssessments(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id } = req.query;
    const params = [lecturerId];
    const where = [];

    if (course_id) {
      params.push(parseInt(course_id, 10));
      where.push(`a.course_id = $${params.length}`);
    }

    const r = await db.query(`
      SELECT a.*, c.code AS course_code, c.title AS course_title,
             (SELECT COUNT(*)::int FROM scores sc WHERE sc.assessment_id = a.id) AS scored
        FROM assessments a
        JOIN courses c ON c.id = a.course_id
       WHERE c.lecturer_id = $1
       ${where.length ? 'AND ' + where.join(' AND ') : ''}
       ORDER BY a.created_at DESC
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function createAssessment(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id, type, title, max_score, weight, due_date } = req.body;
    await assertCourseOwnership(lecturerId, course_id);

    const r = await db.query(`
      INSERT INTO assessments (course_id, type, title, max_score, weight, due_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [course_id, type, title, max_score, weight || 0, due_date || null, req.user.id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'create_assessment',
      module: 'assessments',
      affected_record: `assessment:${r.rows[0].id}`,
      details: { course_id, type, title, max_score },
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

async function deleteAssessment(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const id = parseInt(req.params.id, 10);
    const owns = await db.query(`
      SELECT a.id FROM assessments a
        JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1 AND c.lecturer_id = $2
    `, [id, lecturerId]);
    if (!owns.rows[0]) throw new AppError('Not found.', 404);
    await db.query('DELETE FROM assessments WHERE id = $1', [id]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'delete_assessment',
      module: 'assessments',
      affected_record: `assessment:${id}`,
      ip_address: req.ip,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
}

async function getScores(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const id = parseInt(req.params.id, 10);

    const owns = await db.query(`
      SELECT a.*, c.id AS course_id, c.code, c.title
        FROM assessments a
        JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1 AND c.lecturer_id = $2
    `, [id, lecturerId]);
    if (!owns.rows[0]) throw new AppError('Not found.', 404);

    const students = await db.query(`
      SELECT s.id, s.matric_no, u.full_name, sc.score, sc.id AS score_id
        FROM course_registrations cr
        JOIN students s ON s.id = cr.student_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN scores sc ON sc.student_id = s.id AND sc.assessment_id = $1
       WHERE cr.course_id = $2
         AND cr.status != 'dropped'
       ORDER BY u.full_name
    `, [id, owns.rows[0].course_id]);

    res.json({
      success: true,
      data: { assessment: owns.rows[0], students: students.rows },
    });
  } catch (err) { next(err); }
}

async function saveScores(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const id = parseInt(req.params.id, 10);
    const { scores } = req.body;

    const owns = await db.query(`
      SELECT a.id, a.max_score FROM assessments a
        JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1 AND c.lecturer_id = $2
    `, [id, lecturerId]);
    if (!owns.rows[0]) throw new AppError('Unauthorized.', 403);

    const maxScore = owns.rows[0].max_score;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const sc of scores) {
        if (sc.score === null || sc.score === undefined || sc.score === '') {
          await client.query(
            'DELETE FROM scores WHERE assessment_id = $1 AND student_id = $2',
            [id, sc.student_id]
          );
          continue;
        }
        const val = Math.min(maxScore, Math.max(0, parseFloat(sc.score)));
        await client.query(`
          INSERT INTO scores (assessment_id, student_id, score, entered_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (assessment_id, student_id) DO UPDATE
             SET score = EXCLUDED.score,
                 entered_by = EXCLUDED.entered_by,
                 updated_at = NOW()
        `, [id, sc.student_id, val, req.user.id]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'save_scores',
      module: 'assessments',
      affected_record: `assessment:${id}`,
      details: { students: scores.length },
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Scores saved.' });
  } catch (err) { next(err); }
}

/* ============================================================
   RESULTS — grouped by course, with submission status
   ============================================================ */
async function listResults(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id } = req.query;

    const params = [lecturerId];
    const where = [];

    if (course_id) {
      params.push(parseInt(course_id, 10));
      where.push(`c.id = $${params.length}`);
    }

    const r = await db.query(`
      SELECT
        c.id   AS course_id,
        c.code,
        c.title,
        c.units,
        c.level,
        sess.id   AS session_id,  sess.name AS session_name,
        sem.id    AS semester_id, sem.name  AS semester_name,
        COUNT(r.id)::int                                       AS students,
        ROUND(AVG(r.total_score)::numeric, 2)                  AS avg_score,
        MIN(r.submission_status)                               AS min_status,
        MAX(r.submission_status)                               AS max_status,
        MAX(r.return_reason)                                   AS return_reason,
        MAX(r.submitted_at)                                    AS submitted_at,
        MAX(r.approved_at)                                     AS approved_at,
        COALESCE(BOOL_OR(r.is_published), FALSE)               AS any_published,
        COALESCE(BOOL_AND(r.is_published), FALSE)              AS all_published
      FROM courses c
      LEFT JOIN results r ON r.course_id = c.id
      LEFT JOIN sessions sess ON sess.id = r.session_id
      LEFT JOIN semesters sem ON sem.id = r.semester_id
      WHERE c.lecturer_id = $1
        ${where.length ? 'AND ' + where.join(' AND ') : ''}
      GROUP BY c.id, c.code, c.title, c.units, c.level,
               sess.id, sess.name, sem.id, sem.name
      ORDER BY c.code, sess.id, sem.id
    `, params);

    const rows = r.rows.map(row => {
      let status = row.max_status || 'draft';
      if (row.min_status && row.max_status && row.min_status !== row.max_status) {
        status = 'mixed';
      }
      return {
        course_id:          row.course_id,
        code:               row.code,
        title:              row.title,
        units:              row.units,
        level:              row.level,
        session_id:         row.session_id,
        session_name:       row.session_name,
        semester_id:        row.semester_id,
        semester_name:      row.semester_name,
        students:           row.students,
        avg_score:          row.avg_score,
        submission_status:  status,
        return_reason:      row.return_reason,
        submitted_at:       row.submitted_at,
        approved_at:        row.approved_at,
        is_published:       row.all_published === true,
      };
    });

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

/* ==================== COURSE RESULT DETAIL ==================== */
async function getCourseResultDetail(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const courseId = parseInt(req.params.courseId, 10);
    const { session_id, semester_id } = req.query;

    if (!session_id || !semester_id) {
      throw new AppError('session_id and semester_id are required.', 400);
    }

    const owns = await db.query(`
      SELECT c.id, c.code, c.title, c.units, c.level,
             sess.name AS session_name, sem.name AS semester_name
        FROM courses c
        JOIN sessions sess ON sess.id = $2
        JOIN semesters sem ON sem.id = $3
       WHERE c.id = $1
         AND c.lecturer_id = $4
    `, [courseId, session_id, semester_id, lecturerId]);

    if (!owns.rows[0]) {
      throw new AppError('You do not teach this course.', 403);
    }

    const results = await db.query(`
      SELECT
        r.id,
        r.ca_score, r.exam_score, r.total_score,
        r.grade, r.grade_point,
        r.is_published,
        r.submission_status,
        r.submitted_at, r.approved_at,
        r.return_reason,
        r.computed_at,
        s.matric_no, s.level AS student_level,
        u.full_name AS student_name
      FROM results r
      JOIN students s ON s.id = r.student_id
      JOIN users u    ON u.id = s.user_id
     WHERE r.course_id = $1
       AND r.session_id = $2
       AND r.semester_id = $3
     ORDER BY u.full_name
    `, [courseId, session_id, semester_id]);

    const summary = {
      students:  results.rows.length,
      published: results.rows.filter(r => r.is_published).length,
      avg_score: results.rows.length
        ? +(results.rows
            .reduce((s, r) => s + parseFloat(r.total_score || 0), 0)
            / results.rows.length).toFixed(2)
        : 0,
    };

    const statuses = new Set(results.rows.map(r => r.submission_status || 'draft'));
    let overall = 'draft';
    if (statuses.size === 1) overall = [...statuses][0];
    else if (statuses.size > 1) overall = 'mixed';

    const returnReason = results.rows.find(r => r.return_reason)?.return_reason || null;

    res.json({
      success: true,
      data: {
        course: {
          id: owns.rows[0].id,
          code: owns.rows[0].code,
          title: owns.rows[0].title,
          units: owns.rows[0].units,
          level: owns.rows[0].level,
          session_name: owns.rows[0].session_name,
          semester_name: owns.rows[0].semester_name,
        },
        submission: {
          status: overall,
          return_reason: returnReason,
          submitted_at: results.rows.find(r => r.submitted_at)?.submitted_at || null,
          approved_at:  results.rows.find(r => r.approved_at)?.approved_at  || null,
        },
        summary,
        students: results.rows,
      },
    });
  } catch (err) { next(err); }
}

/* ==================== AT-RISK STUDENTS ==================== */
async function listAtRisk(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const r = await db.query(`
      SELECT DISTINCT ON (s.id)
             ra.id AS risk_id, ra.risk_category, ra.risk_score, ra.assessed_at,
             ra.attendance_pct, ra.gpa, ra.failed_courses, ra.factors,
             s.id AS student_id, s.matric_no, s.level, u.full_name, u.email,
             c.code AS course_code
        FROM risk_assessments ra
        JOIN students s ON s.id = ra.student_id
        JOIN users u ON u.id = s.user_id
        JOIN course_registrations cr ON cr.student_id = s.id
        JOIN courses c ON c.id = cr.course_id
       WHERE c.lecturer_id = $1
         AND cr.status != 'dropped'
         AND ra.risk_category IN ('YELLOW','ORANGE','RED')
         AND ra.assessed_at = (
           SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = s.id
         )
       ORDER BY s.id, ra.risk_score DESC
    `, [lecturerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== AT-RISK: Intervene ==================== */
async function interveneAtRisk(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const studentId = parseInt(req.params.studentId, 10);

    const belongs = await db.query(`
      SELECT 1 FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.student_id = $1
         AND c.lecturer_id = $2
         AND cr.status != 'dropped'
       LIMIT 1
    `, [studentId, lecturerId]);
    if (!belongs.rows[0]) throw new AppError('Student not in your courses.', 403);

    const { type = 'lecturer_meeting', title, description, priority = 'medium' } = req.body;
    if (!title) throw new AppError('Title required.', 400);

    const r = await db.query(`
      INSERT INTO interventions
        (student_id, type, title, description, assigned_to, priority, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7)
      RETURNING id
    `, [studentId, type, title, description || null, req.user.id, priority, req.user.id]);

    const st = await db.query('SELECT user_id FROM students WHERE id = $1', [studentId]);
    if (st.rows[0]) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES ($1, 'New intervention', $2, 'intervention', $3)
      `, [st.rows[0].user_id, `Your lecturer created: ${title}`, r.rows[0].id]);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'create_intervention',
      module: 'interventions',
      affected_record: `intervention:${r.rows[0].id}`,
      details: { student_id: studentId, type, priority },
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
}

/* ==================== AT-RISK: Report to HOD ==================== */
async function reportToHod(req, res, next) {
  try {
    const { id: lecturerId, department_id } = await getLecturerId(req.user.id);
    const studentId = parseInt(req.params.studentId, 10);

    const belongs = await db.query(`
      SELECT 1 FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.student_id = $1
         AND c.lecturer_id = $2
         AND cr.status != 'dropped'
       LIMIT 1
    `, [studentId, lecturerId]);
    if (!belongs.rows[0]) throw new AppError('Student not in your courses.', 403);

    const { message } = req.body;

    const hod = await db.query(
      'SELECT hod_id FROM departments WHERE id = $1',
      [department_id]
    );
    if (!hod.rows[0] || !hod.rows[0].hod_id) {
      throw new AppError('No HOD assigned to your department.', 400);
    }

    const stu = await db.query(`
      SELECT u.full_name, s.matric_no
        FROM students s
        JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
    `, [studentId]);

    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES ($1, 'At-risk student flagged', $2, 'risk_alert', $3)
    `, [
      hod.rows[0].hod_id,
      `${req.user.full_name} flagged ${stu.rows[0].full_name} (${stu.rows[0].matric_no}) — please review. ${message || ''}`.trim(),
      studentId,
    ]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'report_to_hod',
      module: 'risk',
      affected_record: `student:${studentId}`,
      details: { message },
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Reported to HOD.' });
  } catch (err) { next(err); }
}

/* ==================== INTERVENTIONS ==================== */
async function listInterventions(req, res, next) {
  try {
    const r = await db.query(`
      SELECT i.*, u.full_name AS student_name, s.matric_no,
             a.full_name AS assignee_name
        FROM interventions i
        JOIN students s ON s.id = i.student_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN users a ON a.id = i.assigned_to
       WHERE i.assigned_to = $1
       ORDER BY i.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function updateIntervention(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const owns = await db.query(
      'SELECT id FROM interventions WHERE id = $1 AND assigned_to = $2',
      [id, req.user.id]
    );
    if (!owns.rows[0]) throw new AppError('Not found.', 404);

    const { status, notes } = req.body;
    await db.query(`
      UPDATE interventions SET
        status = COALESCE($2, status),
        notes = COALESCE($3, notes),
        completed_at = CASE
          WHEN $2 = 'Completed' AND completed_at IS NULL THEN NOW()
          ELSE completed_at
        END
       WHERE id = $1
    `, [id, status, notes]);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'update_intervention',
      module: 'interventions',
      affected_record: `intervention:${id}`,
      details: { status },
      ip_address: req.ip,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
}

/* ==================== REPORTS ==================== */
async function coursePerformanceReport(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const r = await db.query(`
      SELECT c.code, c.title,
             COUNT(DISTINCT r.student_id)::int AS student_count,
             ROUND(AVG(r.total_score)::numeric, 2) AS avg_score,
             MAX(r.total_score) AS max_score,
             MIN(r.total_score) AS min_score,
             ROUND(
               100.0 * SUM(CASE WHEN r.grade != 'F' THEN 1 ELSE 0 END)
               / NULLIF(COUNT(*), 0), 2
             ) AS pass_rate
        FROM courses c
        LEFT JOIN results r ON r.course_id = c.id
       WHERE c.lecturer_id = $1
       GROUP BY c.id, c.code, c.title
       ORDER BY c.code
    `, [lecturerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function attendanceReport(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const r = await db.query(`
      SELECT s.id, s.matric_no, u.full_name,
             COUNT(*)::int                                            AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             ROUND(
               (SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric
                / NULLIF(COUNT(*),0)) * 100, 2
             )                                                        AS pct
        FROM attendance a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN courses c ON c.id = cs.course_id
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
       WHERE c.lecturer_id = $1
       GROUP BY s.id, s.matric_no, u.full_name
       ORDER BY pct ASC NULLS LAST
    `, [lecturerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function gradeDistributionReport(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const r = await db.query(`
      SELECT r.grade, COUNT(*)::int AS count
        FROM results r
        JOIN courses c ON c.id = r.course_id
       WHERE c.lecturer_id = $1
       GROUP BY r.grade
       ORDER BY r.grade
    `, [lecturerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function studentAveragesReport(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id } = req.query;
    const params = [lecturerId];
    let extra = '';
    if (course_id) {
      params.push(parseInt(course_id, 10));
      extra = ` AND c.id = $${params.length}`;
    }

    const r = await db.query(`
      SELECT u.full_name, s.matric_no, c.code, r.total_score, r.grade
        FROM results r
        JOIN courses c ON c.id = r.course_id
        JOIN students s ON s.id = r.student_id
        JOIN users u ON u.id = s.user_id
       WHERE c.lecturer_id = $1${extra}
       ORDER BY c.code, u.full_name
       LIMIT 500
    `, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== BROADCAST ==================== */
async function broadcastToStudents(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { title, message } = req.body;
    if (!title || !message) throw new AppError('Title and message required.', 400);

    const students = await db.query(`
      SELECT DISTINCT u.id
        FROM users u
        JOIN students s ON s.user_id = u.id
        JOIN course_registrations cr ON cr.student_id = s.id
        JOIN courses c ON c.id = cr.course_id
       WHERE c.lecturer_id = $1
         AND cr.status != 'dropped'
         AND u.is_active = TRUE
    `, [lecturerId]);

    if (!students.rows.length) {
      return res.json({ success: true, message: 'No students in your courses.', count: 0 });
    }

    let sent = 0;
    for (const s of students.rows) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, $2, $3, 'announcement')
      `, [s.id, title, message]);
      sent++;
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'broadcast_students',
      module: 'notifications',
      details: { count: sent, title },
      ip_address: req.ip,
    });

    res.json({ success: true, message: `Sent to ${sent} students.`, count: sent });
  } catch (err) { next(err); }
}

/* ==================== PROFILE ==================== */
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

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'change_password',
      module: 'profile',
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Password changed.' });
  } catch (err) { next(err); }
}

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

/* ============================================================
   RESULT SUBMISSION
   ============================================================ */
async function submitResultsToHod(req, res, next) {
  try {
    const { id: lecturerId, department_id } = await getLecturerId(req.user.id);
    const courseId = parseInt(req.params.courseId, 10);

    await assertCourseOwnership(lecturerId, courseId);

    const { session_id, semester_id } = req.body;

    if (!session_id || !semester_id) {
      throw new AppError('session_id and semester_id required.', 400);
    }

    const results = await db.query(`
      SELECT r.id, r.student_id
        FROM results r
       WHERE r.course_id = $1
         AND r.session_id = $2
         AND r.semester_id = $3
    `, [courseId, session_id, semester_id]);

    if (!results.rows.length) {
      throw new AppError('No results found to submit. Enter scores first.', 400);
    }

    await db.query(`
      UPDATE results
         SET submission_status = 'submitted',
             submitted_at = NOW(),
             submitted_by = $4
       WHERE course_id = $1
         AND session_id = $2
         AND semester_id = $3
         AND submission_status IN ('draft', 'returned')
    `, [courseId, session_id, semester_id, req.user.id]);

    const hod = await db.query('SELECT hod_id FROM departments WHERE id = $1', [department_id]);
    if (hod.rows[0] && hod.rows[0].hod_id) {
      const course = await db.query('SELECT code, title FROM courses WHERE id = $1', [courseId]);
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'Results submitted for review', $2, 'system')
      `, [
        hod.rows[0].hod_id,
        `${req.user.full_name} submitted results for ${course.rows[0].code} — ${course.rows[0].title} for approval.`,
      ]);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'submit_results',
      module: 'results',
      affected_record: `course:${courseId}`,
      details: { session_id, semester_id, students: results.rows.length },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: `Results submitted to HOD (${results.rows.length} student records).`,
    });
  } catch (err) { next(err); }
}

async function submitResultsBulk(req, res, next) {
  try {
    const { id: lecturerId, department_id } = await getLecturerId(req.user.id);
    const { course_ids, session_id, semester_id } = req.body;

    if (!Array.isArray(course_ids) || !course_ids.length) {
      throw new AppError('course_ids array required.', 400);
    }
    if (!session_id || !semester_id) {
      throw new AppError('session_id and semester_id required.', 400);
    }

    let totalSubmitted = 0;
    const submittedCourses = [];

    for (const cid of course_ids) {
      const courseId = parseInt(cid, 10);
      try {
        await assertCourseOwnership(lecturerId, courseId);

        const upd = await db.query(`
          UPDATE results
             SET submission_status = 'submitted',
                 submitted_at = NOW(),
                 submitted_by = $4
           WHERE course_id = $1
             AND session_id = $2
             AND semester_id = $3
             AND submission_status IN ('draft', 'returned')
          RETURNING id
        `, [courseId, session_id, semester_id, req.user.id]);

        if (upd.rowCount > 0) {
          totalSubmitted += upd.rowCount;
          submittedCourses.push({ course_id: courseId, count: upd.rowCount });
        }
      } catch (e) {
        console.warn('[bulk-submit] Skipped course', courseId, e.message);
      }
    }

    if (totalSubmitted > 0) {
      const hod = await db.query('SELECT hod_id FROM departments WHERE id = $1', [department_id]);
      if (hod.rows[0] && hod.rows[0].hod_id) {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES ($1, 'Results submitted for review', $2, 'system')
        `, [
          hod.rows[0].hod_id,
          `${req.user.full_name} submitted results for ${submittedCourses.length} course(s) (${totalSubmitted} students).`,
        ]);
      }
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'submit_results_bulk',
      module: 'results',
      details: {
        courses: submittedCourses.length,
        students: totalSubmitted,
        session_id, semester_id,
      },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: `${submittedCourses.length} course(s) submitted, ${totalSubmitted} student results in total.`,
      data: { submitted: submittedCourses, totalSubmitted },
    });
  } catch (err) { next(err); }
}

/* ==================== EXPORTS ==================== */
module.exports = {
  getDashboard,
  listMyCourses,
  listStudents,
  getStudentDetail,
  listClassSessions,
  createClassSession,
  getAttendance,
  saveAttendance,
  attendanceSummary,
  listAssessments,
  createAssessment,
  deleteAssessment,
  getScores,
  saveScores,
  listResults,
  getCourseResultDetail,
  listAtRisk,
  interveneAtRisk,
  reportToHod,
  listInterventions,
  updateIntervention,
  coursePerformanceReport,
  attendanceReport,
  gradeDistributionReport,
  studentAveragesReport,
  broadcastToStudents,
  updateOwnProfile,
  changePassword,
  uploadOwnPhoto,
  removeOwnPhoto,
  submitResultsToHod,
  submitResultsBulk,
};