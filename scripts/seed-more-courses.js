// ============================================================
// Seed courses for all departments & levels
// Usage: node scripts/seed-more-courses.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

const COURSE_DATA = {
  CSC: {
    programme: 'CSC-BSC',
    courses: {
      100: [
        ['CSC101', 'Introduction to Computer Science', 3, 'First'],
        ['CSC102', 'Introduction to Programming',       3, 'Second'],
        ['CSC105', 'Discrete Mathematics',               3, 'First'],
        ['CSC106', 'Computer Hardware Fundamentals',     2, 'Second'],
      ],
      200: [
        ['CSC201', 'Object-Oriented Programming',        3, 'First'],
        ['CSC203', 'Data Structures',                    3, 'First'],
        ['CSC205', 'Computer Architecture',               3, 'Second'],
        ['CSC207', 'Systems Analysis & Design',          3, 'Second'],
      ],
      300: [
        ['CSC301', 'Data Structures & Algorithms',       3, 'First'],
        ['CSC303', 'Operating Systems',                  3, 'First'],
        ['CSC305', 'Database Management Systems',        3, 'First'],
        ['CSC307', 'Software Engineering',               3, 'First'],
        ['CSC309', 'Computer Networks',                  3, 'First'],
        ['CSC302', 'Algorithm Design & Analysis',        3, 'Second'],
        ['CSC304', 'Compiler Construction',              3, 'Second'],
      ],
      400: [
        ['CSC401', 'Artificial Intelligence',            3, 'First'],
        ['CSC403', 'Machine Learning',                   3, 'First'],
        ['CSC405', 'Advanced Database Systems',          3, 'First'],
        ['CSC402', 'Project Management',                 3, 'Second'],
        ['CSC404', 'Distributed Systems',                3, 'Second'],
      ],
    },
  },
  MTH: {
    programme: 'MTH-BSC',
    courses: {
      100: [
        ['MTH101', 'Elementary Mathematics I',           3, 'First'],
        ['MTH102', 'Elementary Mathematics II',          3, 'Second'],
        ['MTH103', 'Vectors & Geometry',                 3, 'First'],
      ],
      200: [
        ['MTH201', 'Mathematical Methods I',             3, 'First'],
        ['MTH203', 'Linear Algebra I',                   3, 'First'],
        ['MTH202', 'Real Analysis I',                    3, 'Second'],
      ],
      300: [
        ['MTH301', 'Abstract Algebra',                   3, 'First'],
        ['MTH303', 'Complex Analysis',                   3, 'First'],
        ['MTH305', 'Numerical Analysis I',               3, 'First'],
        ['MTH302', 'Topology',                           3, 'Second'],
      ],
      400: [
        ['MTH401', 'Functional Analysis',                3, 'First'],
        ['MTH403', 'Mathematical Modelling',             3, 'First'],
      ],
    },
  },
  PHY: {
    programme: 'PHY-BSC',
    courses: {
      100: [
        ['PHY101', 'General Physics I',                  3, 'First'],
        ['PHY102', 'General Physics II',                 3, 'Second'],
        ['PHY103', 'General Physics Practical I',        2, 'First'],
      ],
      200: [
        ['PHY201', 'Classical Mechanics',                3, 'First'],
        ['PHY203', 'Electricity & Magnetism',            3, 'First'],
        ['PHY202', 'Thermodynamics',                     3, 'Second'],
      ],
      300: [
        ['PHY301', 'Quantum Mechanics I',                3, 'First'],
        ['PHY303', 'Atomic & Nuclear Physics',           3, 'First'],
        ['PHY302', 'Solid State Physics',                3, 'Second'],
      ],
      400: [
        ['PHY401', 'Quantum Mechanics II',               3, 'First'],
        ['PHY403', 'Electromagnetic Theory',             3, 'First'],
      ],
    },
  },
  EEE: {
    programme: 'EEE-BENG',
    courses: {
      100: [
        ['EEE101', 'Basic Electrical Engineering',       3, 'First'],
        ['EEE102', 'Engineering Drawing',                2, 'Second'],
        ['EEE103', 'Applied Mechanics',                  3, 'First'],
      ],
      200: [
        ['EEE201', 'Circuit Theory I',                   3, 'First'],
        ['EEE203', 'Electronics I',                      3, 'First'],
        ['EEE202', 'Circuit Theory II',                  3, 'Second'],
      ],
      300: [
        ['EEE301', 'Power Systems I',                    3, 'First'],
        ['EEE303', 'Control Systems',                    3, 'First'],
        ['EEE302', 'Power Systems II',                   3, 'Second'],
      ],
      400: [
        ['EEE401', 'Power Electronics',                  3, 'First'],
        ['EEE403', 'Electrical Machines',                3, 'First'],
      ],
    },
  },
};

(async () => {
  try {
    // Load all departments
    const depts = await db.query('SELECT id, code FROM departments');
    const deptMap = Object.fromEntries(depts.rows.map(d => [d.code, d.id]));

    // Load all programmes
    const progs = await db.query('SELECT id, code FROM programmes');
    const progMap = Object.fromEntries(progs.rows.map(p => [p.code, p.id]));

    // Find a CS lecturer to assign (optional)
    const lecturerRow = await db.query(`
      SELECT l.id FROM lecturers l
        JOIN departments d ON d.id = l.department_id
       WHERE d.code = 'CSC' LIMIT 1
    `);
    const defaultLecturer = lecturerRow.rows[0]?.id || null;

    let added = 0, skipped = 0;

    for (const [deptCode, data] of Object.entries(COURSE_DATA)) {
      const deptId = deptMap[deptCode];
      const progId = progMap[data.programme];

      if (!deptId) { console.log(`⚠️  Department ${deptCode} not found, skipping`); continue; }
      if (!progId) { console.log(`⚠️  Programme ${data.programme} not found, skipping`); continue; }

      for (const [levelStr, courses] of Object.entries(data.courses)) {
        const level = parseInt(levelStr, 10);

        for (const [code, title, units, semester] of courses) {
          const exists = await db.query('SELECT 1 FROM courses WHERE code = $1', [code]);
          if (exists.rows.length > 0) { skipped++; continue; }

          await db.query(`
            INSERT INTO courses
              (code, title, units, department_id, programme_id, level, semester_name, lecturer_id, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
          `, [code, title, units, deptId, progId, level, semester, defaultLecturer]);

          console.log(`  ✅ ${code} — ${title} (L${level}, ${semester}, ${units}u)`);
          added++;
        }
      }
    }

    console.log(`\n✅ Done. Added ${added}, skipped ${skipped} (already existed).`);

    // Show summary
    const summary = await db.query(`
      SELECT d.code AS department, c.level, c.semester_name,
             COUNT(*)::int AS course_count,
             SUM(c.units)::int AS total_units
        FROM courses c
        JOIN departments d ON d.id = c.department_id
       WHERE c.is_active = TRUE
       GROUP BY d.code, c.level, c.semester_name
       ORDER BY d.code, c.level, c.semester_name
    `);
    console.log('\n📊 Summary:');
    console.table(summary.rows);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await db.close();
    process.exit(0);
  }
})();