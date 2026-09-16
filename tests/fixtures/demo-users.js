'use strict';

/**
 * Shared demo credentials used by all integration tests.
 * Matches what `npm run seed-db` inserts.
 */
module.exports = {
  admin:    { email: 'admin@smartacademic.edu',         password: 'Admin@123' },
  hod:      { email: 'hod.csc@smartacademic.edu',       password: 'Hod@123' },
  lecturer: { email: 'lecturer.csc1@smartacademic.edu', password: 'Lect@123' },
  students: {
    green:  { email: 'student.a@smartacademic.edu', password: 'Student@123', expected: 'GREEN' },
    yellow: { email: 'student.b@smartacademic.edu', password: 'Student@123', expected: 'YELLOW' },
    orange: { email: 'student.c@smartacademic.edu', password: 'Student@123', expected: 'ORANGE' },
    red:    { email: 'student.d@smartacademic.edu', password: 'Student@123', expected: 'RED' },
  },
};