// ============================================================
// SMARTACADEMIC — Academic Controller
// Departments, Programmes, Students, Lecturers, Courses, ...
// Students' matric numbers are auto-generated when not provided.
// ============================================================

'use strict';

const bcrypt = require('bcryptjs');
const env = require('../config/env');
const db = require('../config/db');
const model = require('../models/academicModel');
const adminModel = require('../models/adminModel');
const { AppError } = require('../middleware/errorHandler');

const list = (fn) => async (req, res, next) => {
  try {
    const items = await fn(req.query);
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

/* ============ DEPARTMENTS ============ */
const listDepartments = list(q => model.listDepartments({
  search: q.search, limit: parseInt(q.limit || 100, 10), offset: parseInt(q.offset || 0, 10),
}));

async function getDepartment(req, res, next) {
  try {
    const d = await model.getDepartment(parseInt(req.params.id, 10));
    if (!d) throw new AppError('Department not found.', 404);
    res.json({ success: true, data: d });
  } catch (err) { next(err); }
}

async function createDepartment(req, res, next) {
  try {
    const r = await model.createDepartment(req.body);
    await adminModel.writeAudit({ user_id: req.user.id, action: 'create_department', module: 'departments', affected_record: `department:${r.id}` });
    res.status(201).json({ success: true, message: 'Department created.', data: r });
  } catch (err) { next(err); }
}

async function updateDepartment(req, res, next) {
  try {
    await model.updateDepartment(parseInt(req.params.id, 10), req.body);
    await adminModel.writeAudit({ user_id: req.user.id, action: 'update_department', module: 'departments', affected_record: `department:${req.params.id}` });
    res.json({ success: true, message: 'Department updated.' });
  } catch (err) { next(err); }
}

async function deleteDepartment(req, res, next) {
  try {
    await model.deleteDepartment(parseInt(req.params.id, 10));
    await adminModel.writeAudit({ user_id: req.user.id, action: 'delete_department', module: 'departments', affected_record: `department:${req.params.id}` });
    res.json({ success: true, message: 'Department deleted.' });
  } catch (err) { next(err); }
}

async function listHodCandidates(req, res, next) {
  try { res.json({ success: true, data: await model.listHodCandidates() }); }
  catch (err) { next(err); }
}

/* ============ PROGRAMMES ============ */
const listProgrammes = list(q => model.listProgrammes({
  departmentId: q.department_id ? parseInt(q.department_id, 10) : null,
  search: q.search, limit: parseInt(q.limit || 100, 10), offset: parseInt(q.offset || 0, 10),
}));

async function createProgramme(req, res, next) {
  try {
    const r = await model.createProgramme(req.body);
    await adminModel.writeAudit({ user_id: req.user.id, action: 'create_programme', module: 'programmes', affected_record: `programme:${r.id}` });
    res.status(201).json({ success: true, message: 'Programme created.', data: r });
  } catch (err) { next(err); }
}

async function updateProgramme(req, res, next) {
  try {
    await model.updateProgramme(parseInt(req.params.id, 10), req.body);
    res.json({ success: true, message: 'Programme updated.' });
  } catch (err) { next(err); }
}

async function deleteProgramme(req, res, next) {
  try {
    await model.deleteProgramme(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Programme deleted.' });
  } catch (err) { next(err); }
}

/* ============ STUDENTS ============ */
async function listStudents(req, res, next) {
  try {
    const { department_id, programme_id, level, search, page = 1, limit = 50 } = req.query;
    const filters = {
      departmentId: department_id ? parseInt(department_id, 10) : null,
      programmeId: programme_id ? parseInt(programme_id, 10) : null,
      level: level ? parseInt(level, 10) : null,
      search: search || null,
    };
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      model.listStudents({ ...filters, limit: parseInt(limit, 10), offset }),
      model.countStudents(filters),
    ]);
    res.json({ success: true, data: { items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) { next(err); }
}

/**
 * POST /api/admin/students
 * Auto-generates matric_no if not provided.
 */
async function createStudent(req, res, next) {
  try {
    const { password, matric_no, ...rest } = req.body;
    const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const client = await db.pool.connect();
    let studentId, generatedMatric;

    try {
      await client.query('BEGIN');

      const roleRow = await client.query("SELECT id FROM roles WHERE name = 'student'");
      const u = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [rest.full_name, rest.email.toLowerCase(), rest.phone || null,
         password_hash, roleRow.rows[0].id]
      );
      const userId = u.rows[0].id;

      const matricGenerator = require('../utils/matricGenerator');
      generatedMatric = matric_no || await matricGenerator.generateMatric({
        departmentId: rest.department_id,
        programmeId:  rest.programme_id,
        admissionYear: rest.admission_year || new Date().getFullYear(),
        client,
      });

      const s = await client.query(
        `INSERT INTO students
           (user_id, matric_no, department_id, programme_id, level, admission_year)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, generatedMatric, rest.department_id, rest.programme_id,
         rest.level, rest.admission_year || new Date().getFullYear()]
      );
      studentId = s.rows[0].id;

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') {
        return next(new AppError('Email or matric number already exists.', 409));
      }
      throw e;
    } finally {
      client.release();
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'create_student',
      module: 'students',
      affected_record: `student:${studentId}`,
      details: { matric_no: generatedMatric },
    });

    res.status(201).json({
      success: true,
      message: 'Student created.',
      data: { student_id: studentId, matric_no: generatedMatric },
    });
  } catch (err) { next(err); }
}

async function updateStudent(req, res, next) {
  try {
    const { password, ...rest } = req.body;
    await model.updateStudent(parseInt(req.params.id, 10), rest);
    if (password && password.length >= 6) {
      const s = await db.query('SELECT user_id FROM students WHERE id = $1', [req.params.id]);
      if (s.rows[0]) {
        const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, s.rows[0].user_id]);
      }
    }
    res.json({ success: true, message: 'Student updated.' });
  } catch (err) { next(err); }
}

async function deleteStudent(req, res, next) {
  try {
    await model.deleteStudent(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Student deleted.' });
  } catch (err) { next(err); }
}

/* ============ LECTURERS ============ */
async function listLecturers(req, res, next) {
  try {
    const { department_id, search, page = 1, limit = 50 } = req.query;
    const filters = {
      departmentId: department_id ? parseInt(department_id, 10) : null,
      search: search || null,
    };
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      model.listLecturers({ ...filters, limit: parseInt(limit, 10), offset }),
      model.countLecturers(filters),
    ]);
    res.json({ success: true, data: { items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) { next(err); }
}

async function createLecturer(req, res, next) {
  try {
    const { password, ...rest } = req.body;
    const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const r = await model.createLecturer({ ...rest, password_hash });
    await adminModel.writeAudit({ user_id: req.user.id, action: 'create_lecturer', module: 'lecturers', affected_record: `lecturer:${r.lecturer_id}` });
    res.status(201).json({ success: true, message: 'Lecturer created.', data: r });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('Email or staff ID already exists.', 409));
    next(err);
  }
}

async function updateLecturer(req, res, next) {
  try {
    const { password, ...rest } = req.body;
    await model.updateLecturer(parseInt(req.params.id, 10), rest);
    res.json({ success: true, message: 'Lecturer updated.' });
  } catch (err) { next(err); }
}

async function deleteLecturer(req, res, next) {
  try {
    await model.deleteLecturer(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Lecturer deleted.' });
  } catch (err) { next(err); }
}

/* ============ COURSES ============ */
async function listCourses(req, res, next) {
  try {
    const items = await model.listCourses({
      departmentId: req.query.department_id ? parseInt(req.query.department_id, 10) : null,
      lecturerId: req.query.lecturer_id ? parseInt(req.query.lecturer_id, 10) : null,
      level: req.query.level ? parseInt(req.query.level, 10) : null,
      search: req.query.search || null,
    });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
}

async function createCourse(req, res, next) {
  try {
    const r = await model.createCourse(req.body);
    await adminModel.writeAudit({ user_id: req.user.id, action: 'create_course', module: 'courses', affected_record: `course:${r.id}` });
    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
}

async function updateCourse(req, res, next) {
  try {
    await model.updateCourse(parseInt(req.params.id, 10), req.body);
    res.json({ success: true, message: 'Course updated.' });
  } catch (err) { next(err); }
}

async function deleteCourse(req, res, next) {
  try {
    await model.deleteCourse(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Course deleted.' });
  } catch (err) { next(err); }
}

/* ============ SESSIONS ============ */
async function listSessions(req, res, next) {
  try { res.json({ success: true, data: await model.listSessions() }); }
  catch (err) { next(err); }
}
async function createSession(req, res, next) {
  try {
    const r = await model.createSession(req.body);
    await adminModel.writeAudit({ user_id: req.user.id, action: 'create_session', module: 'sessions', affected_record: `session:${r.id}` });
    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
}
async function updateSession(req, res, next) {
  try { await model.updateSession(parseInt(req.params.id, 10), req.body); res.json({ success: true }); }
  catch (err) { next(err); }
}
async function deleteSession(req, res, next) {
  try { await model.deleteSession(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { next(err); }
}

/* ============ SEMESTERS ============ */
async function listSemesters(req, res, next) {
  try {
    const sid = req.query.session_id ? parseInt(req.query.session_id, 10) : null;
    res.json({ success: true, data: await model.listSemesters(sid) });
  } catch (err) { next(err); }
}
async function createSemester(req, res, next) {
  try {
    const r = await model.createSemester(req.body);
    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
}
async function updateSemester(req, res, next) {
  try { await model.updateSemester(parseInt(req.params.id, 10), req.body); res.json({ success: true }); }
  catch (err) { next(err); }
}
async function deleteSemester(req, res, next) {
  try { await model.deleteSemester(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { next(err); }
}

/* ============ REGISTRATIONS ============ */
async function listRegistrations(req, res, next) {
  try {
    const items = await model.listRegistrations({
      studentId: req.query.student_id ? parseInt(req.query.student_id, 10) : null,
      courseId: req.query.course_id ? parseInt(req.query.course_id, 10) : null,
      sessionId: req.query.session_id ? parseInt(req.query.session_id, 10) : null,
      semesterId: req.query.semester_id ? parseInt(req.query.semester_id, 10) : null,
    });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
}
async function updateRegistration(req, res, next) {
  try {
    await model.updateRegistrationStatus(parseInt(req.params.id, 10), req.body.status);
    res.json({ success: true });
  } catch (err) { next(err); }
}
async function deleteRegistration(req, res, next) {
  try { await model.deleteRegistration(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { next(err); }
}

/* ============ ATTENDANCE ============ */
async function listAttendance(req, res, next) {
  try {
    const items = await model.listAttendance({
      studentId: req.query.student_id ? parseInt(req.query.student_id, 10) : null,
      courseId: req.query.course_id ? parseInt(req.query.course_id, 10) : null,
      fromDate: req.query.from || null,
      toDate: req.query.to || null,
    });
    const summary = await model.getAttendanceSummary({
      courseId: req.query.course_id ? parseInt(req.query.course_id, 10) : null,
      studentId: req.query.student_id ? parseInt(req.query.student_id, 10) : null,
    });
    res.json({ success: true, data: { items, summary } });
  } catch (err) { next(err); }
}

/* ============ RESULTS ============ */
async function listResults(req, res, next) {
  try {
    const items = await model.listResults({
      studentId: req.query.student_id ? parseInt(req.query.student_id, 10) : null,
      courseId: req.query.course_id ? parseInt(req.query.course_id, 10) : null,
      sessionId: req.query.session_id ? parseInt(req.query.session_id, 10) : null,
      semesterId: req.query.semester_id ? parseInt(req.query.semester_id, 10) : null,
    });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
}
async function updateResult(req, res, next) {
  try {
    await model.updateResult(parseInt(req.params.id, 10), req.body);
    res.json({ success: true, message: 'Result updated.' });
  } catch (err) { next(err); }
}
async function publishResult(req, res, next) {
  try {
    await model.publishResult(parseInt(req.params.id, 10), req.body.is_published !== false);
    res.json({ success: true });
  } catch (err) { next(err); }
}
async function deleteResult(req, res, next) {
  try { await model.deleteResult(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { next(err); }
}

module.exports = {
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, listHodCandidates,
  listProgrammes, createProgramme, updateProgramme, deleteProgramme,
  listStudents, createStudent, updateStudent, deleteStudent,
  listLecturers, createLecturer, updateLecturer, deleteLecturer,
  listCourses, createCourse, updateCourse, deleteCourse,
  listSessions, createSession, updateSession, deleteSession,
  listSemesters, createSemester, updateSemester, deleteSemester,
  listRegistrations, updateRegistration, deleteRegistration,
  listAttendance,
  listResults, updateResult, publishResult, deleteResult,
};