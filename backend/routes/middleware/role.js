// ============================================================
// SMARTACADEMIC — Role & Scope Middleware
// Enforces role-based access control and department/course
// scoping for HOD, Lecturer, and Student access.
// Must be used AFTER requireAuth.
// ============================================================

'use strict';

const { AppError } = require('./errorHandler');
const db = require('../config/db');

/**
 * requireRole('admin') or requireRole(['admin','hod'])
 * Blocks the request unless req.user.role_name is in the allowed list.
 */
function requireRole(...allowed) {
  const roles = allowed.flat();
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    if (!roles.includes(req.user.role_name)) {
      return next(new AppError(
        `Access denied. Required role: ${roles.join(' or ')}.`,
        403
      ));
    }
    next();
  };
}

/**
 * requireSelfOrRoles — allows the resource owner OR the listed roles.
 * Compares req.params.id (or req.params.userId) against req.user.id.
 */
function requireSelfOrRoles(paramName, ...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required.', 401));
    const targetId = parseInt(req.params[paramName], 10);
    if (req.user.id === targetId || roles.includes(req.user.role_name)) {
      return next();
    }
    next(new AppError('Access denied.', 403));
  };
}

/**
 * requireDepartmentAccess — HOD-only scoping.
 * Attaches req.departmentId (from the HOD's department) so controllers
 * can filter queries by department.
 */
async function requireDepartmentAccess(req, res, next) {
  try {
    if (!req.user) return next(new AppError('Authentication required.', 401));

    // Admin bypasses department scoping
    if (req.user.role_name === 'admin') {
      req.departmentId = null; // means "all departments"
      return next();
    }

    // HOD: find their department
    if (req.user.role_name === 'hod') {
      const result = await db.query(
        'SELECT id FROM departments WHERE hod_id = $1 AND is_active = TRUE',
        [req.user.id]
      );
      if (result.rows.length === 0) {
        return next(new AppError('You are not assigned as HOD of any department.', 403));
      }
      req.departmentId = result.rows[0].id;
      return next();
    }

    // Lecturers and students: attach their own department
    if (req.user.role_name === 'lecturer') {
      const r = await db.query(
        'SELECT department_id FROM lecturers WHERE user_id = $1',
        [req.user.id]
      );
      if (r.rows.length > 0) req.departmentId = r.rows[0].department_id;
      return next();
    }

    if (req.user.role_name === 'student') {
      const r = await db.query(
        'SELECT department_id FROM students WHERE user_id = $1',
        [req.user.id]
      );
      if (r.rows.length > 0) req.departmentId = r.rows[0].department_id;
      return next();
    }

    next(new AppError('Access denied.', 403));
  } catch (err) {
    next(err);
  }
}

/**
 * requireStudent — attaches req.studentId (the student profile id)
 * for the logged-in user.
 */
async function requireStudent(req, res, next) {
  try {
    if (!req.user) return next(new AppError('Authentication required.', 401));
    if (req.user.role_name !== 'student') {
      return next(new AppError('Student access only.', 403));
    }
    const r = await db.query(
      'SELECT id, department_id, programme_id, level FROM students WHERE user_id = $1',
      [req.user.id]
    );
    if (r.rows.length === 0) {
      return next(new AppError('Student profile not found.', 404));
    }
    req.studentId     = r.rows[0].id;
    req.departmentId  = r.rows[0].department_id;
    req.programmeId   = r.rows[0].programme_id;
    req.level         = r.rows[0].level;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireLecturer — attaches req.lecturerId for the logged-in user.
 */
async function requireLecturer(req, res, next) {
  try {
    if (!req.user) return next(new AppError('Authentication required.', 401));
    if (req.user.role_name !== 'lecturer') {
      return next(new AppError('Lecturer access only.', 403));
    }
    const r = await db.query(
      'SELECT id, department_id FROM lecturers WHERE user_id = $1',
      [req.user.id]
    );
    if (r.rows.length === 0) {
      return next(new AppError('Lecturer profile not found.', 404));
    }
    req.lecturerId   = r.rows[0].id;
    req.departmentId = r.rows[0].department_id;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireCourseAccess — checks that the logged-in lecturer owns the course
 * identified by req.params.courseId. Admin/HOD bypass.
 */
async function requireCourseAccess(req, res, next) {
  try {
    if (!req.user) return next(new AppError('Authentication required.', 401));

    const courseId = parseInt(req.params.courseId || req.params.id, 10);
    if (!courseId) return next(new AppError('Course ID required.', 400));

    if (req.user.role_name === 'admin') return next();

    if (req.user.role_name === 'hod') {
      const r = await db.query(
        `SELECT 1 FROM courses c
          JOIN departments d ON d.id = c.department_id
         WHERE c.id = $1 AND d.hod_id = $2`,
        [courseId, req.user.id]
      );
      if (r.rows.length === 0) {
        return next(new AppError('You do not have access to this course.', 403));
      }
      return next();
    }

    if (req.user.role_name === 'lecturer') {
      const r = await db.query(
        `SELECT 1 FROM courses c
          JOIN lecturers l ON l.id = c.lecturer_id
         WHERE c.id = $1 AND l.user_id = $2`,
        [courseId, req.user.id]
      );
      if (r.rows.length === 0) {
        return next(new AppError('You do not teach this course.', 403));
      }
      return next();
    }

    next(new AppError('Access denied.', 403));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireRole,
  requireSelfOrRoles,
  requireDepartmentAccess,
  requireStudent,
  requireLecturer,
  requireCourseAccess,
};