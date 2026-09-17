// ============================================================
// SMARTACADEMIC — Lecturer Controller
// All data scoped to courses taught by the logged-in lecturer.
// ============================================================

'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function getLecturerId(userId) {
  const r = await db.query('SELECT id, department_id FROM lecturers WHERE user_id = $1', [userId]);
  if (!r.rows[0]) throw new AppError('Lecturer profile not found.', 403);
  return r.rows[0];
}

async function assertCourseOwnership(lecturerId, courseId) {
  const r = await db.query('SELECT 1 FROM courses WHERE id = $1 AND lecturer_id = $2', [courseId, lecturerId]);
  if (!r.rows[0]) throw new AppError('You do not teach this course.', 403);
}

/* ==================== DASHBOARD ==================== */
async function getDashboard(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);

    const [courses, studentsCount, atRisk, avgAttendance] = await Promise.all([
      db.query(`
        SELECT c.id, c.code, c.title, c.units, c.level, c.semester_name,
               (SELECT COUNT(*)::int FROM course_registrations cr WHERE cr.course_id = c.id) AS registered
          FROM courses c
         WHERE c.lecturer_id = $1 AND c.is_active = TRUE
         ORDER BY c.code
      `, [lecturerId]),
      db.query(`
        SELECT COUNT(DISTINCT cr.student_id)::int AS n
          FROM course_registrations cr
          JOIN courses c ON c.id = cr.course_id
         WHERE c.lecturer_id = $1
      `, [lecturerId]),
      db.query(`
        SELECT ra.id, ra.risk_category, ra.risk_score, ra.assessed_at,
               s.id AS student_id, s.matric_no, s.level, u.full_name
          FROM risk_assessments ra
          JOIN students s ON s.id = ra.student_id
          JOIN users u ON u.id = s.user_id
          JOIN course_registrations cr ON cr.student_id = s.id
          JOIN courses c ON c.id = cr.course_id
         WHERE c.lecturer_id = $1
           AND ra.risk_category IN ('ORANGE', 'RED')
           AND ra.assessed_at = (SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id)
         GROUP BY ra.id, ra.risk_category, ra.risk_score, ra.assessed_at, s.id, s.matric_no, s.level, u.full_name
         ORDER BY ra.risk_score DESC
         LIMIT 10
      `, [lecturerId]),
      db.query(`
        SELECT ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
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
             (SELECT COUNT(*)::int FROM course_registrations cr WHERE cr.course_id = c.id) AS registered
        FROM courses c
       WHERE c.lecturer_id = $1 AND c.is_active = TRUE
       ORDER BY c.code
    `, [lecturerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

/* ==================== STUDENTS ==================== */
async function listStudents(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id, search } = req.query;
    const params = [lecturerId]; const where = [];
    if (course_id) { params.push(parseInt(course_id, 10)); where.push(`c.id = $${params.length}`); }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`);
    }

    const r = await db.query(`
      SELECT DISTINCT s.id, s.matric_no, s.level, u.full_name, u.email,
             COALESCE(ra.risk_category, 'GREEN') AS risk_category
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
        JOIN students s ON s.id = cr.student_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN risk_assessments ra ON ra.student_id = s.id
             AND ra.assessed_at = (SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = s.id)
       WHERE c.lecturer_id = $1
       ${where.length ? 'AND ' + where.join(' AND ') : ''}
       ORDER BY u.full_name
    `, params);
    res.json({ success: true, data: r.rows });
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
      INSERT INTO class_sessions (course_id, session_date, start_time, end_time, topic, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [course_id, session_date, start_time || null, end_time || null, topic || null, req.user.id]);
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
             COALESCE(a.status, NULL) AS status, a.id AS attendance_id, a.remarks
        FROM course_registrations cr
        JOIN students s ON s.id = cr.student_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN attendance a ON a.student_id = s.id AND a.class_session_id = $1
       WHERE cr.course_id = $2
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
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

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
             COUNT(*)::int AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END)::int AS absent,
             ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
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
    const params = [lecturerId]; const where = [];
    if (course_id) { params.push(parseInt(course_id, 10)); where.push(`a.course_id = $${params.length}`); }

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
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [course_id, type, title, max_score, weight || 0, due_date || null, req.user.id]);
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
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function getScores(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const id = parseInt(req.params.id, 10);
    const owns = await db.query(`
      SELECT a.*, c.id AS course_id, c.code, c.title
        FROM assessments a JOIN courses c ON c.id = a.course_id
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
       ORDER BY u.full_name
    `, [id, owns.rows[0].course_id]);

    res.json({ success: true, data: { assessment: owns.rows[0], students: students.rows } });
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
          await client.query('DELETE FROM scores WHERE assessment_id = $1 AND student_id = $2', [id, sc.student_id]);
          continue;
        }
        const val = Math.min(maxScore, Math.max(0, parseFloat(sc.score)));
        await client.query(`
          INSERT INTO scores (assessment_id, student_id, score, entered_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (assessment_id, student_id) DO UPDATE
             SET score = EXCLUDED.score, entered_by = EXCLUDED.entered_by, updated_at = NOW()
        `, [id, sc.student_id, val, req.user.id]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    res.json({ success: true, message: 'Scores saved.' });
  } catch (err) { next(err); }
}

/* ==================== RESULTS ==================== */
async function listResults(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const { course_id } = req.query;
    const params = [lecturerId]; const where = [];
    if (course_id) { params.push(parseInt(course_id, 10)); where.push(`c.id = $${params.length}`); }

    const r = await db.query(`
      SELECT r.*, c.code, c.title, c.units, u.full_name AS student_name, s.matric_no
        FROM results r
        JOIN courses c ON c.id = r.course_id
        JOIN students s ON s.id = r.student_id
        JOIN users u ON u.id = s.user_id
       WHERE c.lecturer_id = $1
       ${where.length ? 'AND ' + where.join(' AND ') : ''}
       ORDER BY r.computed_at DESC
       LIMIT 500
    `, params);
    res.json({ success: true, data: r.rows });
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
         AND ra.risk_category IN ('YELLOW','ORANGE','RED')
         AND ra.assessed_at = (SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = s.id)
       ORDER BY s.id, ra.risk_score DESC
    `, [lecturerId]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
}

async function getStudentDetail(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const studentId = parseInt(req.params.id, 10);

    const belongs = await db.query(`
      SELECT 1 FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
       WHERE cr.student_id = $1 AND c.lecturer_id = $2 LIMIT 1
    `, [studentId, lecturerId]);
    if (!belongs.rows[0]) throw new AppError('Student not in your courses.', 403);

    const [student, attendance, risk, results] = await Promise.all([
      db.query(`SELECT s.id, s.matric_no, s.level, u.full_name, u.email
                  FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [studentId]),
      db.query(`
        SELECT COUNT(*)::int AS total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::int AS present,
               ROUND((SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
          FROM attendance WHERE student_id = $1
      `, [studentId]),
      db.query(`SELECT * FROM risk_assessments WHERE student_id = $1 ORDER BY assessed_at DESC LIMIT 1`, [studentId]),
      db.query(`SELECT r.total_score, r.grade, c.code, c.title
                  FROM results r JOIN courses c ON c.id = r.course_id
                 WHERE r.student_id = $1 ORDER BY r.computed_at DESC LIMIT 10`, [studentId]),
    ]);

    res.json({
      success: true,
      data: {
        student: student.rows[0],
        attendance: attendance.rows[0],
        risk: risk.rows[0] || null,
        results: results.rows,
      },
    });
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
       WHERE cr.student_id = $1 AND c.lecturer_id = $2 LIMIT 1
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
       WHERE cr.student_id = $1 AND c.lecturer_id = $2 LIMIT 1
    `, [studentId, lecturerId]);
    if (!belongs.rows[0]) throw new AppError('Student not in your courses.', 403);

    const { message } = req.body;

    const hod = await db.query('SELECT hod_id FROM departments WHERE id = $1', [department_id]);
    if (!hod.rows[0] || !hod.rows[0].hod_id) {
      throw new AppError('No HOD assigned to your department.', 400);
    }

    const stu = await db.query(`
      SELECT u.full_name, s.matric_no
        FROM students s JOIN users u ON u.id = s.user_id
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

    await db.query(`
      INSERT INTO audit_logs (user_id, action, module, affected_record, details)
      VALUES ($1, 'report_to_hod', 'risk', $2, $3)
    `, [req.user.id, `student:${studentId}`, JSON.stringify({ message })]);

    res.json({ success: true, message: 'Reported to HOD.' });
  } catch (err) { next(err); }
}

/* ==================== INTERVENTIONS ==================== */
async function listInterventions(req, res, next) {
  try {
    const r = await db.query(`
      SELECT i.*, u.full_name AS student_name, s.matric_no, a.full_name AS assignee_name
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
    const owns = await db.query('SELECT id FROM interventions WHERE id = $1 AND assigned_to = $2', [id, req.user.id]);
    if (!owns.rows[0]) throw new AppError('Not found.', 404);

    const { status, notes } = req.body;
    await db.query(`
      UPDATE interventions SET
        status = COALESCE($2, status),
        notes = COALESCE($3, notes),
        completed_at = CASE WHEN $2 = 'Completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END
       WHERE id = $1
    `, [id, status, notes]);
    res.json({ success: true });
  } catch (err) { next(err); }
}

/* ==================== REPORT HELPERS ==================== */
async function coursePerformanceReport(req, res, next) {
  try {
    const { id: lecturerId } = await getLecturerId(req.user.id);
    const r = await db.query(`
      SELECT c.code, c.title,
             COUNT(DISTINCT r.student_id)::int AS student_count,
             ROUND(AVG(r.total_score)::numeric, 2) AS avg_score,
             MAX(r.total_score) AS max_score,
             MIN(r.total_score) AS min_score,
             ROUND(100.0 * SUM(CASE WHEN r.grade != 'F' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS pass_rate
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
             COUNT(*)::int AS total,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
             ROUND((SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS pct
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
    if (course_id) { params.push(parseInt(course_id, 10)); extra = ` AND c.id = $${params.length}`; }

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
       WHERE c.lecturer_id = $1 AND u.is_active = TRUE
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

    res.json({ success: true, message: `Sent to ${sent} students.`, count: sent });
  } catch (err) { next(err); }
}

/* ==================== PROFILE ==================== */
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
    await db.query('UPDATE users SET photo_url = NULL, updated_at = NOW() WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Photo removed.' });
  } catch (err) { next(err); }
}

/* ==================== EXPORTS ==================== */
module.exports = {
  getDashboard,
  listMyCourses,
  listStudents,
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
  listAtRisk,
  getStudentDetail,
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
};