// ============================================================
// SMARTACADEMIC — Academic Model
// Shared CRUD for students, lecturers, departments, programmes,
// courses, sessions, semesters, registrations, attendance.
// ============================================================

'use strict';

const db = require('../config/db');

/* ==================== DEPARTMENTS ==================== */
async function listDepartments({ search = null, limit = 100, offset = 0 } = {}) {
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(d.name) LIKE $${params.length} OR LOWER(d.code) LIKE $${params.length})`);
  }
  params.push(limit, offset);
  const result = await db.query(`
    SELECT d.id, d.name, d.code, d.is_active, d.created_at,
           d.hod_id,
           u.full_name AS hod_name, u.email AS hod_email,
           (SELECT COUNT(*)::int FROM students s WHERE s.department_id = d.id)   AS student_count,
           (SELECT COUNT(*)::int FROM lecturers l WHERE l.department_id = d.id)  AS lecturer_count,
           (SELECT COUNT(*)::int FROM courses c WHERE c.department_id = d.id)    AS course_count
      FROM departments d
      LEFT JOIN users u ON u.id = d.hod_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY d.name
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return result.rows;
}

async function getDepartment(id) {
  const r = await db.query(`
    SELECT d.*, u.full_name AS hod_name
      FROM departments d
      LEFT JOIN users u ON u.id = d.hod_id
     WHERE d.id = $1
  `, [id]);
  return r.rows[0] || null;
}

async function createDepartment({ name, code, hod_id }) {
  const r = await db.query(`
    INSERT INTO departments (name, code, hod_id)
    VALUES ($1, $2, $3) RETURNING id
  `, [name, code || null, hod_id || null]);
  return r.rows[0];
}

async function updateDepartment(id, { name, code, hod_id, is_active }) {
  await db.query(`
    UPDATE departments
       SET name      = COALESCE($2, name),
           code      = COALESCE($3, code),
           hod_id    = $4,
           is_active = COALESCE($5, is_active)
     WHERE id = $1
  `, [id, name, code, hod_id === undefined ? null : hod_id, is_active]);
}

async function deleteDepartment(id) {
  await db.query('DELETE FROM departments WHERE id = $1', [id]);
}

async function listHodCandidates() {
  const r = await db.query(`
    SELECT u.id, u.full_name, u.email
      FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'hod' AND u.is_active = TRUE
     ORDER BY u.full_name
  `);
  return r.rows;
}

/* ==================== PROGRAMMES ==================== */
async function listProgrammes({ departmentId = null, search = null, limit = 100, offset = 0 } = {}) {
  const params = [];
  const where = [];
  if (departmentId) {
    params.push(departmentId);
    where.push(`p.department_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`LOWER(p.name) LIKE $${params.length}`);
  }
  params.push(limit, offset);
  const r = await db.query(`
    SELECT p.id, p.name, p.code, p.duration_years, p.is_active, p.department_id,
           d.name AS department_name,
           (SELECT COUNT(*)::int FROM students s WHERE s.programme_id = p.id) AS student_count,
           (SELECT COUNT(*)::int FROM courses  c WHERE c.programme_id = p.id) AS course_count
      FROM programmes p
      JOIN departments d ON d.id = p.department_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY p.name
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return r.rows;
}

async function createProgramme({ name, code, department_id, duration_years }) {
  const r = await db.query(`
    INSERT INTO programmes (name, code, department_id, duration_years)
    VALUES ($1, $2, $3, $4) RETURNING id
  `, [name, code || null, department_id, duration_years || 4]);
  return r.rows[0];
}

async function updateProgramme(id, { name, code, department_id, duration_years, is_active }) {
  await db.query(`
    UPDATE programmes
       SET name = COALESCE($2, name),
           code = COALESCE($3, code),
           department_id = COALESCE($4, department_id),
           duration_years = COALESCE($5, duration_years),
           is_active = COALESCE($6, is_active)
     WHERE id = $1
  `, [id, name, code, department_id, duration_years, is_active]);
}

async function deleteProgramme(id) {
  await db.query('DELETE FROM programmes WHERE id = $1', [id]);
}

/* ==================== STUDENTS ==================== */
async function listStudents({ departmentId = null, programmeId = null, level = null, search = null, limit = 50, offset = 0 } = {}) {
  const params = [];
  const where = [];
  if (departmentId) { params.push(departmentId); where.push(`s.department_id = $${params.length}`); }
  if (programmeId)  { params.push(programmeId);  where.push(`s.programme_id  = $${params.length}`); }
  if (level)        { params.push(level);        where.push(`s.level          = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }
  params.push(limit, offset);
    const r = await db.query(`
      SELECT s.id, s.matric_no, s.level, s.admission_year, s.is_active,
            u.id AS user_id, u.full_name, u.email, u.phone,
            u.photo_url,
            d.id AS department_id, d.name AS department_name,
            d.code AS department_code,
            p.id AS programme_id,  p.name AS programme_name
        FROM students s
        JOIN users u       ON u.id = s.user_id
        JOIN departments d ON d.id = s.department_id
        JOIN programmes p  ON p.id = s.programme_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY u.full_name
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
  return r.rows;
}

async function countStudents(filters = {}) {
  const params = [];
  const where = [];
  if (filters.departmentId) { params.push(filters.departmentId); where.push(`s.department_id = $${params.length}`); }
  if (filters.programmeId)  { params.push(filters.programmeId);  where.push(`s.programme_id = $${params.length}`); }
  if (filters.level)        { params.push(filters.level);        where.push(`s.level = $${params.length}`); }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(s.matric_no) LIKE $${params.length})`);
  }
  const r = await db.query(`
    SELECT COUNT(*)::int AS n
      FROM students s JOIN users u ON u.id = s.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `, params);
  return r.rows[0].n;
}

async function createStudent({ full_name, email, phone, password_hash, matric_no, department_id, programme_id, level, admission_year }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const roleRow = await client.query("SELECT id FROM roles WHERE name = 'student'");
    const u = await client.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [full_name, email.toLowerCase(), phone || null, password_hash, roleRow.rows[0].id]);
    const s = await client.query(`
      INSERT INTO students (user_id, matric_no, department_id, programme_id, level, admission_year)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [u.rows[0].id, matric_no, department_id, programme_id, level, admission_year || new Date().getFullYear()]);
    await client.query('COMMIT');
    return { user_id: u.rows[0].id, student_id: s.rows[0].id };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

async function updateStudent(id, { full_name, email, phone, matric_no, department_id, programme_id, level, admission_year, is_active }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const s = await client.query('SELECT user_id FROM students WHERE id = $1', [id]);
    if (!s.rows[0]) throw new Error('Student not found');
    const userId = s.rows[0].user_id;
    await client.query(`
      UPDATE users SET
        full_name = COALESCE($2, full_name),
        email     = COALESCE($3, email),
        phone     = COALESCE($4, phone),
        is_active = COALESCE($5, is_active)
       WHERE id = $1
    `, [userId, full_name, email ? email.toLowerCase() : null, phone, is_active]);
    await client.query(`
      UPDATE students SET
        matric_no      = COALESCE($2, matric_no),
        department_id  = COALESCE($3, department_id),
        programme_id   = COALESCE($4, programme_id),
        level          = COALESCE($5, level),
        admission_year = COALESCE($6, admission_year)
       WHERE id = $1
    `, [id, matric_no, department_id, programme_id, level, admission_year]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

async function deleteStudent(id) {
  const s = await db.query('SELECT user_id FROM students WHERE id = $1', [id]);
  if (s.rows[0]) await db.query('DELETE FROM users WHERE id = $1', [s.rows[0].user_id]);
}

/* ==================== LECTURERS ==================== */
async function listLecturers({ departmentId = null, search = null, limit = 50, offset = 0 } = {}) {
  const params = [];
  const where = [];
  if (departmentId) { params.push(departmentId); where.push(`l.department_id = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(l.staff_id) LIKE $${params.length})`);
  }
  params.push(limit, offset);
  const r = await db.query(`
    SELECT l.id, l.staff_id, l.title, l.is_active,
           u.id AS user_id, u.full_name, u.email, u.phone,
           d.id AS department_id, d.name AS department_name,
           (SELECT COUNT(*)::int FROM courses c WHERE c.lecturer_id = l.id) AS course_count
      FROM lecturers l
      JOIN users u       ON u.id = l.user_id
      JOIN departments d ON d.id = l.department_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.full_name
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return r.rows;
}

async function countLecturers(filters = {}) {
  const params = [];
  const where = [];
  if (filters.departmentId) { params.push(filters.departmentId); where.push(`l.department_id = $${params.length}`); }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(l.staff_id) LIKE $${params.length})`);
  }
  const r = await db.query(`
    SELECT COUNT(*)::int AS n
      FROM lecturers l JOIN users u ON u.id = l.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `, params);
  return r.rows[0].n;
}

async function createLecturer({ full_name, email, phone, password_hash, staff_id, department_id, title }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const roleRow = await client.query("SELECT id FROM roles WHERE name = 'lecturer'");
    const u = await client.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [full_name, email.toLowerCase(), phone || null, password_hash, roleRow.rows[0].id]);
    const l = await client.query(`
      INSERT INTO lecturers (user_id, staff_id, department_id, title)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [u.rows[0].id, staff_id, department_id, title || null]);
    await client.query('COMMIT');
    return { user_id: u.rows[0].id, lecturer_id: l.rows[0].id };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

async function updateLecturer(id, { full_name, email, phone, staff_id, department_id, title, is_active }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const l = await client.query('SELECT user_id FROM lecturers WHERE id = $1', [id]);
    if (!l.rows[0]) throw new Error('Lecturer not found');
    await client.query(`
      UPDATE users SET
        full_name = COALESCE($2, full_name),
        email     = COALESCE($3, email),
        phone     = COALESCE($4, phone),
        is_active = COALESCE($5, is_active)
       WHERE id = $1
    `, [l.rows[0].user_id, full_name, email ? email.toLowerCase() : null, phone, is_active]);
    await client.query(`
      UPDATE lecturers SET
        staff_id      = COALESCE($2, staff_id),
        department_id = COALESCE($3, department_id),
        title         = COALESCE($4, title)
       WHERE id = $1
    `, [id, staff_id, department_id, title]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

async function deleteLecturer(id) {
  const l = await db.query('SELECT user_id FROM lecturers WHERE id = $1', [id]);
  if (l.rows[0]) await db.query('DELETE FROM users WHERE id = $1', [l.rows[0].user_id]);
}

/* ==================== COURSES ==================== */
async function listCourses({ departmentId = null, lecturerId = null, level = null, search = null, limit = 100, offset = 0 } = {}) {
  const params = []; const where = [];
  if (departmentId) { params.push(departmentId); where.push(`c.department_id = $${params.length}`); }
  if (lecturerId)   { params.push(lecturerId);   where.push(`c.lecturer_id = $${params.length}`); }
  if (level)        { params.push(level);        where.push(`c.level = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(c.code) LIKE $${params.length} OR LOWER(c.title) LIKE $${params.length})`);
  }
  params.push(limit, offset);
  const r = await db.query(`
    SELECT c.id, c.code, c.title, c.units, c.level, c.semester_name,
           c.is_active, c.department_id, c.programme_id, c.lecturer_id,
           d.name AS department_name,
           p.name AS programme_name,
           u.full_name AS lecturer_name,
           (SELECT COUNT(*)::int FROM course_registrations cr WHERE cr.course_id = c.id) AS registration_count
      FROM courses c
      LEFT JOIN departments d ON d.id = c.department_id
      LEFT JOIN programmes  p ON p.id = c.programme_id
      LEFT JOIN lecturers   l ON l.id = c.lecturer_id
      LEFT JOIN users       u ON u.id = l.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.code
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return r.rows;
}

async function createCourse(data) {
  const r = await db.query(`
    INSERT INTO courses (code, title, units, department_id, programme_id, level, semester_name, lecturer_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
  `, [data.code, data.title, data.units, data.department_id, data.programme_id || null,
      data.level, data.semester_name, data.lecturer_id || null]);
  return r.rows[0];
}

async function updateCourse(id, data) {
  await db.query(`
    UPDATE courses
       SET code = COALESCE($2, code),
           title = COALESCE($3, title),
           units = COALESCE($4, units),
           department_id = COALESCE($5, department_id),
           programme_id = $6,
           level = COALESCE($7, level),
           semester_name = COALESCE($8, semester_name),
           lecturer_id = $9,
           is_active = COALESCE($10, is_active)
     WHERE id = $1
  `, [id, data.code, data.title, data.units, data.department_id,
      data.programme_id === undefined ? null : data.programme_id,
      data.level, data.semester_name,
      data.lecturer_id === undefined ? null : data.lecturer_id,
      data.is_active]);
}

async function deleteCourse(id) {
  await db.query('DELETE FROM courses WHERE id = $1', [id]);
}

/* ==================== SESSIONS ==================== */
async function listSessions() {
  const r = await db.query(`
    SELECT s.*,
           (SELECT COUNT(*)::int FROM semesters sm WHERE sm.session_id = s.id) AS semester_count
      FROM sessions s ORDER BY s.name DESC
  `);
  return r.rows;
}

async function createSession({ name, start_date, end_date }) {
  const r = await db.query(`
    INSERT INTO sessions (name, start_date, end_date) VALUES ($1, $2, $3) RETURNING id
  `, [name, start_date || null, end_date || null]);
  return r.rows[0];
}

async function updateSession(id, { name, start_date, end_date, is_active }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (is_active === true) await client.query('UPDATE sessions SET is_active = FALSE WHERE id <> $1', [id]);
    await client.query(`
      UPDATE sessions SET
        name = COALESCE($2, name),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        is_active = COALESCE($5, is_active)
      WHERE id = $1
    `, [id, name, start_date, end_date, is_active]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function deleteSession(id) {
  await db.query('DELETE FROM sessions WHERE id = $1', [id]);
}

/* ==================== SEMESTERS ==================== */
async function listSemesters(sessionId = null) {
  const params = []; const where = [];
  if (sessionId) { params.push(sessionId); where.push(`sm.session_id = $${params.length}`); }
  const r = await db.query(`
    SELECT sm.*, s.name AS session_name
      FROM semesters sm
      JOIN sessions s ON s.id = sm.session_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.name DESC, sm.name
  `, params);
  return r.rows;
}

async function createSemester({ session_id, name, start_date, end_date }) {
  const r = await db.query(`
    INSERT INTO semesters (session_id, name, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id
  `, [session_id, name, start_date || null, end_date || null]);
  return r.rows[0];
}

async function updateSemester(id, { session_id, name, start_date, end_date, is_active }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (is_active === true) await client.query('UPDATE semesters SET is_active = FALSE WHERE id <> $1', [id]);
    await client.query(`
      UPDATE semesters SET
        session_id = COALESCE($2, session_id),
        name = COALESCE($3, name),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        is_active = COALESCE($6, is_active)
      WHERE id = $1
    `, [id, session_id, name, start_date, end_date, is_active]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function deleteSemester(id) {
  await db.query('DELETE FROM semesters WHERE id = $1', [id]);
}

/* ==================== COURSE REGISTRATIONS ==================== */
async function listRegistrations({ studentId = null, courseId = null, sessionId = null, semesterId = null, limit = 200, offset = 0 } = {}) {
  const params = []; const where = [];
  if (studentId)  { params.push(studentId);  where.push(`cr.student_id = $${params.length}`); }
  if (courseId)   { params.push(courseId);   where.push(`cr.course_id = $${params.length}`); }
  if (sessionId)  { params.push(sessionId);  where.push(`cr.session_id = $${params.length}`); }
  if (semesterId) { params.push(semesterId); where.push(`cr.semester_id = $${params.length}`); }
  params.push(limit, offset);
  const r = await db.query(`
    SELECT cr.id, cr.status, cr.registered_at,
           s.id AS student_id, s.matric_no,
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
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return r.rows;
}

async function updateRegistrationStatus(id, status) {
  await db.query('UPDATE course_registrations SET status = $2 WHERE id = $1', [id, status]);
}

async function deleteRegistration(id) {
  await db.query('DELETE FROM course_registrations WHERE id = $1', [id]);
}

/* ==================== ATTENDANCE ==================== */
async function listAttendance({ studentId = null, courseId = null, fromDate = null, toDate = null, limit = 200, offset = 0 } = {}) {
  const params = []; const where = [];
  if (studentId) { params.push(studentId); where.push(`a.student_id = $${params.length}`); }
  if (courseId)  { params.push(courseId);  where.push(`cs.course_id = $${params.length}`); }
  if (fromDate)  { params.push(fromDate);  where.push(`cs.session_date >= $${params.length}`); }
  if (toDate)    { params.push(toDate);    where.push(`cs.session_date <= $${params.length}`); }
  params.push(limit, offset);
  const r = await db.query(`
    SELECT a.id, a.status, a.recorded_at,
           cs.session_date, cs.topic,
           c.code AS course_code, c.title AS course_title,
           s.matric_no, u.full_name AS student_name
      FROM attendance a
      JOIN class_sessions cs ON cs.id = a.class_session_id
      JOIN courses c         ON c.id = cs.course_id
      JOIN students s        ON s.id = a.student_id
      JOIN users u           ON u.id = s.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY cs.session_date DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return r.rows;
}

async function getAttendanceSummary({ courseId = null, studentId = null } = {}) {
  const params = []; const where = [];
  if (courseId)  { params.push(courseId);  where.push(`cs.course_id = $${params.length}`); }
  if (studentId) { params.push(studentId); where.push(`a.student_id = $${params.length}`); }
  const r = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::int AS present,
      SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END)::int AS absent,
      SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END)::int AS excused,
      ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS present_pct
      FROM attendance a
      JOIN class_sessions cs ON cs.id = a.class_session_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `, params);
  return r.rows[0];
}

/* ==================== RESULTS ==================== */
async function listResults({ studentId = null, courseId = null, sessionId = null, semesterId = null, limit = 200, offset = 0 } = {}) {
  const params = []; const where = [];
  if (studentId)  { params.push(studentId);  where.push(`r.student_id = $${params.length}`); }
  if (courseId)   { params.push(courseId);   where.push(`r.course_id = $${params.length}`); }
  if (sessionId)  { params.push(sessionId);  where.push(`r.session_id = $${params.length}`); }
  if (semesterId) { params.push(semesterId); where.push(`r.semester_id = $${params.length}`); }
  params.push(limit, offset);
  const r = await db.query(`
    SELECT r.id, r.ca_score, r.exam_score, r.total_score, r.grade, r.grade_point,
           r.is_published, r.computed_at,
           c.code, c.title, c.units,
           s.matric_no, u.full_name AS student_name,
           sess.name AS session_name, sem.name AS semester_name
      FROM results r
      JOIN courses c      ON c.id = r.course_id
      JOIN students s     ON s.id = r.student_id
      JOIN users u        ON u.id = s.user_id
      JOIN sessions sess  ON sess.id = r.session_id
      JOIN semesters sem  ON sem.id = r.semester_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY r.computed_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return r.rows;
}

async function updateResult(id, { ca_score, exam_score }) {
  const { computeTotal, scoreToGrade } = require('../utils/gradeCalculator');
  const total = computeTotal(ca_score, exam_score);
  const { grade, point } = scoreToGrade(total);
  await db.query(`
    UPDATE results SET
      ca_score = $2, exam_score = $3,
      total_score = $4, grade = $5, grade_point = $6,
      computed_at = NOW()
    WHERE id = $1
  `, [id, ca_score, exam_score, total, grade, point]);
}

async function publishResult(id, publish = true) {
  await db.query('UPDATE results SET is_published = $2 WHERE id = $1', [id, publish]);
}

async function deleteResult(id) {
  await db.query('DELETE FROM results WHERE id = $1', [id]);
}

module.exports = {
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, listHodCandidates,
  listProgrammes, createProgramme, updateProgramme, deleteProgramme,
  listStudents, countStudents, createStudent, updateStudent, deleteStudent,
  listLecturers, countLecturers, createLecturer, updateLecturer, deleteLecturer,
  listCourses, createCourse, updateCourse, deleteCourse,
  listSessions, createSession, updateSession, deleteSession,
  listSemesters, createSemester, updateSemester, deleteSemester,
  listRegistrations, updateRegistrationStatus, deleteRegistration,
  listAttendance, getAttendanceSummary,
  listResults, updateResult, publishResult, deleteResult,
};