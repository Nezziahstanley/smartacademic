// ============================================================
// SMARTACADEMIC — Seed ND 1/2 + HND 1/2 Courses
// Federal Polytechnic, Ugep
//
// Usage:   node scripts/seed-courses.js
//
// Idempotent — safe to re-run. Uses ON CONFLICT DO NOTHING on
// (code, programme_id, level, semester_name) so re-running will
// only insert new rows.
//
// Requires: departments + programmes to already exist.
//           Run `node scripts/seed-ugep.js` first if unsure.
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

// ============================================================
// COURSE DATA
// Format: [code, title, units, level, semester]
// Levels: 100 / 200 = ND 1 / ND 2  |  300 / 400 = HND 1 / HND 2
// Semesters: 'First' | 'Second'
// ============================================================

const COURSES = {

  /* ==========================================================
     ND COMPUTER SCIENCE  (CSC-ND)
     ========================================================== */
  'CSC-ND': [
    // ---- ND 1 / First ----
    ['COM 111', 'Introduction to Computing',            3, 100, 'First'],
    ['COM 112', 'Introduction to Digital Electronics',  3, 100, 'First'],
    ['COM 113', 'Introduction to Programming',          4, 100, 'First'],
    ['COM 114', 'Statistics for Computing I',           2, 100, 'First'],
    ['COM 115', 'Computer Application Packages I',      3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             2, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],
    // ---- ND 1 / Second ----
    ['COM 121', 'Computer Application Packages II',     3, 100, 'Second'],
    ['COM 122', 'Programming in C',                     4, 100, 'Second'],
    ['COM 123', 'Statistics for Computing II',          2, 100, 'Second'],
    ['COM 124', 'Computer Hardware I',                  3, 100, 'Second'],
    ['COM 125', 'Introduction to Web Technology',       3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],
    // ---- ND 2 / First ----
    ['COM 211', 'Programming Language using Java II',   4, 200, 'First'],
    ['COM 212', 'Introduction to Systems Programming',  2, 200, 'First'],
    ['COM 213', 'Unified Modelling Language (UML)',     3, 200, 'First'],
    ['COM 214', 'Computer Systems Troubleshooting',     3, 200, 'First'],
    ['COM 215', 'Computer Application Packages II',     3, 200, 'First'],
    ['COM 216', 'Statistics for Computing II',          2, 200, 'First'],
    ['GNS 201', 'Use of English II',                    2, 200, 'First'],
    ['EED 216', 'Practice of Entrepreneurship',         2, 200, 'First'],
    // ---- ND 2 / Second ----
    ['COM 221', 'Basic Computer Networking',            3, 200, 'Second'],
    ['COM 222', 'Seminar on Computer and Society',      2, 200, 'Second'],
    ['COM 223', 'Basic Hardware Maintenance',           2, 200, 'Second'],
    ['COM 224', 'Management Information System',        2, 200, 'Second'],
    ['COM 225', 'Web Technology',                       3, 200, 'Second'],
    ['COM 226', 'File Organisation and Management',     2, 200, 'Second'],
    ['COM 227', 'Project',                              6, 200, 'Second'],
    ['GNS 204', 'Communication in English II',          2, 200, 'Second'],
  ],

  /* ==========================================================
     ND COMPUTER ENGINEERING  (CEN-ND)
     ========================================================== */
  'CEN-ND': [
    ['COM 111', 'Introduction to Computing',            3, 100, 'First'],
    ['COM 112', 'Computer Hardware I',                  3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['COM 121', 'Computer Hardware II',                 3, 100, 'Second'],
    ['COM 122', 'Introduction to Programming',          3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['COM 211', 'Digital Electronics',                  3, 200, 'First'],
    ['COM 212', 'Microprocessor Systems',               3, 200, 'First'],
    ['COM 213', 'Computer Programming I',               3, 200, 'First'],
    ['EEC 211', 'Electrical Principles',                3, 200, 'First'],

    ['COM 221', 'Computer Architecture',                3, 200, 'Second'],
    ['COM 222', 'Computer Programming II',              3, 200, 'Second'],
    ['COM 223', 'Data Communication',                   3, 200, 'Second'],
    ['EEC 221', 'Electronic Circuits',                  3, 200, 'Second'],
  ],

  /* ==========================================================
     ND CIVIL ENGINEERING  (CIV-ND)
     ========================================================== */
  'CIV-ND': [
    ['CIV 111', 'Introduction to Civil Engineering',    3, 100, 'First'],
    ['CIV 112', 'Engineering Drawing I',                3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['CIV 121', 'Building Construction I',              3, 100, 'Second'],
    ['CIV 122', 'Engineering Drawing II',               3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['CIV 211', 'Structural Mechanics I',               3, 200, 'First'],
    ['CIV 212', 'Soil Mechanics I',                     3, 200, 'First'],
    ['CIV 213', 'Fluid Mechanics I',                    3, 200, 'First'],

    ['CIV 221', 'Structural Mechanics II',              3, 200, 'Second'],
    ['CIV 222', 'Soil Mechanics II',                    3, 200, 'Second'],
    ['CIV 223', 'Fluid Mechanics II',                   3, 200, 'Second'],
  ],

  /* ==========================================================
     ND ELECTRICAL/ELECTRONIC ENGINEERING  (EEE-ND)
     ========================================================== */
  'EEE-ND': [
    ['EEE 111', 'Introduction to Electrical Engineering', 3, 100, 'First'],
    ['EEE 112', 'Electrical Drawing I',                   3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',               3, 100, 'First'],
    ['GNS 101', 'Use of English I',                       2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',                2, 100, 'First'],

    ['EEE 121', 'Electrical Circuits I',                  3, 100, 'Second'],
    ['EEE 122', 'Electrical Drawing II',                  3, 100, 'Second'],
    ['MTH 121', 'Calculus',                               3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                      2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',               2, 100, 'Second'],

    ['EEE 211', 'Electrical Machines I',                  3, 200, 'First'],
    ['EEE 212', 'Electronics I',                          3, 200, 'First'],
    ['EEE 213', 'Electrical Measurements',                3, 200, 'First'],

    ['EEE 221', 'Electrical Machines II',                 3, 200, 'Second'],
    ['EEE 222', 'Electronics II',                         3, 200, 'Second'],
    ['EEE 223', 'Power Systems I',                        3, 200, 'Second'],
  ],

  /* ==========================================================
     ND STATISTICS  (STA-ND)
     ========================================================== */
  'STA-ND': [
    ['STA 111', 'Introduction to Statistics',           3, 100, 'First'],
    ['STA 112', 'Descriptive Statistics',               3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['STA 121', 'Probability Theory I',                 3, 100, 'Second'],
    ['STA 122', 'Statistical Computing',                3, 100, 'Second'],
    ['MTH 121', 'Calculus',                             3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['STA 211', 'Probability Distributions',            3, 200, 'First'],
    ['STA 212', 'Sampling Theory',                      3, 200, 'First'],
    ['STA 213', 'Regression Analysis',                  3, 200, 'First'],

    ['STA 221', 'Statistical Inference',                3, 200, 'Second'],
    ['STA 222', 'Design of Experiments',                3, 200, 'Second'],
    ['STA 223', 'Time Series Analysis',                 3, 200, 'Second'],
  ],

  /* ==========================================================
     ND ARTIFICIAL INTELLIGENCE  (AIT-ND)  — newly accredited
     ========================================================== */
  'AIT-ND': [
    ['AIT 111', 'Introduction to Artificial Intelligence', 3, 100, 'First'],
    ['AIT 112', 'Python Programming I',                    3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',                3, 100, 'First'],
    ['GNS 101', 'Use of English I',                        2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',                 2, 100, 'First'],

    ['AIT 121', 'Python Programming II',                   3, 100, 'Second'],
    ['AIT 122', 'Data Science Fundamentals',               3, 100, 'Second'],
    ['MTH 121', 'Calculus',                                3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                       2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',                2, 100, 'Second'],

    ['AIT 211', 'Machine Learning I',                      3, 200, 'First'],
    ['AIT 212', 'Neural Networks',                         3, 200, 'First'],
    ['AIT 213', 'Data Mining',                             3, 200, 'First'],

    ['AIT 221', 'Machine Learning II',                     3, 200, 'Second'],
    ['AIT 222', 'Natural Language Processing',             3, 200, 'Second'],
    ['AIT 223', 'Computer Vision',                         3, 200, 'Second'],
  ],

  /* ==========================================================
     ND ARCHITECTURAL TECHNOLOGY  (ARC-ND)
     ========================================================== */
  'ARC-ND': [
    ['ARC 111', 'Introduction to Architecture',         3, 100, 'First'],
    ['ARC 112', 'Architectural Drawing I',              3, 100, 'First'],
    ['ARC 113', 'Building Materials I',                 3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['ARC 121', 'Architectural Drawing II',             3, 100, 'Second'],
    ['ARC 122', 'Building Materials II',                3, 100, 'Second'],
    ['ARC 123', 'Freehand Sketching',                   2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['ARC 211', 'Architectural Design I',               3, 200, 'First'],
    ['ARC 212', 'Building Construction I',              3, 200, 'First'],
    ['ARC 213', 'Computer Aided Design',                3, 200, 'First'],

    ['ARC 221', 'Architectural Design II',              3, 200, 'Second'],
    ['ARC 222', 'Building Construction II',             3, 200, 'Second'],
    ['ARC 223', 'Site Planning',                        3, 200, 'Second'],
  ],

  /* ==========================================================
     ND BUSINESS ADMINISTRATION  (BAM-ND)
     ========================================================== */
  'BAM-ND': [
    ['BAM 111', 'Introduction to Business',             3, 100, 'First'],
    ['BAM 112', 'Principles of Management',             3, 100, 'First'],
    ['BAM 113', 'Elements of Accounting I',             3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['BAM 121', 'Principles of Marketing',              3, 100, 'Second'],
    ['BAM 122', 'Elements of Accounting II',            3, 100, 'Second'],
    ['BAM 123', 'Business Communication',               2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['BAM 211', 'Business Statistics',                  3, 200, 'First'],
    ['BAM 212', 'Human Resource Management',            3, 200, 'First'],
    ['BAM 213', 'Entrepreneurship Development',         3, 200, 'First'],

    ['BAM 221', 'Business Law',                         3, 200, 'Second'],
    ['BAM 222', 'Organisational Behaviour',             3, 200, 'Second'],
    ['BAM 223', 'Financial Management',                 3, 200, 'Second'],
  ],

  /* ==========================================================
     ND PUBLIC ADMINISTRATION  (PAD-ND)
     ========================================================== */
  'PAD-ND': [
    ['PAD 111', 'Introduction to Public Administration', 3, 100, 'First'],
    ['PAD 112', 'Elements of Government',                3, 100, 'First'],
    ['PAD 113', 'Principles of Management',              3, 100, 'First'],
    ['GNS 101', 'Use of English I',                      2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',               2, 100, 'First'],

    ['PAD 121', 'Nigerian Government and Politics',      3, 100, 'Second'],
    ['PAD 122', 'Public Personnel Administration',       3, 100, 'Second'],
    ['PAD 123', 'Business Communication',                2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                     2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',              2, 100, 'Second'],

    ['PAD 211', 'Administrative Theory',                 3, 200, 'First'],
    ['PAD 212', 'Public Finance',                        3, 200, 'First'],
    ['PAD 213', 'Local Government Administration',       3, 200, 'First'],

    ['PAD 221', 'Public Policy Analysis',                3, 200, 'Second'],
    ['PAD 222', 'Comparative Public Administration',     3, 200, 'Second'],
    ['PAD 223', 'Development Administration',            3, 200, 'Second'],
  ],

  /* ==========================================================
     ND ACCOUNTANCY  (ACC-ND)
     ========================================================== */
  'ACC-ND': [
    ['ACC 111', 'Principles of Accounting I',           3, 100, 'First'],
    ['ACC 112', 'Introduction to Business',             3, 100, 'First'],
    ['ACC 113', 'Business Mathematics',                 3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['ACC 121', 'Principles of Accounting II',          3, 100, 'Second'],
    ['ACC 122', 'Business Communication',               2, 100, 'Second'],
    ['ACC 123', 'Economics I',                          3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['ACC 211', 'Intermediate Accounting I',            3, 200, 'First'],
    ['ACC 212', 'Cost Accounting I',                    3, 200, 'First'],
    ['ACC 213', 'Business Statistics',                  3, 200, 'First'],

    ['ACC 221', 'Intermediate Accounting II',           3, 200, 'Second'],
    ['ACC 222', 'Cost Accounting II',                   3, 200, 'Second'],
    ['ACC 223', 'Taxation I',                           3, 200, 'Second'],
  ],

  /* ==========================================================
     ND LIBRARY & INFORMATION SCIENCE  (LIS-ND)
     ========================================================== */
  'LIS-ND': [
    ['LIS 111', 'Introduction to Library Science',      3, 100, 'First'],
    ['LIS 112', 'Reference Services',                   3, 100, 'First'],
    ['LIS 113', 'Classification and Cataloguing I',     3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['LIS 121', 'Classification and Cataloguing II',    3, 100, 'Second'],
    ['LIS 122', 'Information Sources and Services',     3, 100, 'Second'],
    ['LIS 123', 'Library and Society',                  2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['LIS 211', 'Information Technology in Libraries',  3, 200, 'First'],
    ['LIS 212', 'Collection Development',               3, 200, 'First'],

    ['LIS 221', 'Library Management',                   3, 200, 'Second'],
    ['LIS 222', 'Information Retrieval',                3, 200, 'Second'],
  ],

  /* ==========================================================
     ND HOSPITALITY & TOURISM  (HTM-ND)
     ========================================================== */
  'HTM-ND': [
    ['HTM 111', 'Introduction to Hospitality',          3, 100, 'First'],
    ['HTM 112', 'Introduction to Tourism',              3, 100, 'First'],
    ['HTM 113', 'Food and Beverage Production I',       3, 100, 'First'],
    ['GNS 101', 'Use of English I',                     2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',              2, 100, 'First'],

    ['HTM 121', 'Food and Beverage Production II',      3, 100, 'Second'],
    ['HTM 122', 'Hospitality Marketing',                3, 100, 'Second'],
    ['HTM 123', 'Travel and Tour Operations',           2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                    2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',             2, 100, 'Second'],

    ['HTM 211', 'Front Office Operations',              3, 200, 'First'],
    ['HTM 212', 'Housekeeping Management',              3, 200, 'First'],

    ['HTM 221', 'Tourism Planning and Development',     3, 200, 'Second'],
    ['HTM 222', 'Event Management',                     3, 200, 'Second'],
  ],

  /* ==========================================================
     HND SOFTWARE & WEB DEVELOPMENT  (SWD-HND)
     ========================================================== */
  'SWD-HND': [
    // ---- HND 1 / First ----
    ['SWD 311', 'Advanced Web Development',             3, 300, 'First'],
    ['SWD 312', 'Software Architecture',                3, 300, 'First'],
    ['SWD 313', 'Database Systems',                     3, 300, 'First'],
    ['SWD 314', 'Server-Side Programming',              3, 300, 'First'],
    // ---- HND 1 / Second ----
    ['SWD 321', 'Front-End Frameworks',                 3, 300, 'Second'],
    ['SWD 322', 'API Design and Development',           3, 300, 'Second'],
    ['SWD 323', 'Cloud-Based Applications',             3, 300, 'Second'],
    ['SWD 324', 'Mobile App Development',               3, 300, 'Second'],
    // ---- HND 2 / First ----
    ['SWD 411', 'DevOps and Deployment',                3, 400, 'First'],
    ['SWD 412', 'Software Testing and QA',              3, 400, 'First'],
    ['SWD 413', 'Research Methods',                     3, 400, 'First'],
    // ---- HND 2 / Second ----
    ['SWD 421', 'Final Year Project',                   6, 400, 'Second'],
    ['SWD 422', 'Software Project Management',          3, 400, 'Second'],
  ],

  /* ==========================================================
     HND NETWORKING & CLOUD COMPUTING  (NCC-HND)
     ========================================================== */
  'NCC-HND': [
    // ---- HND 1 / First ----
    ['NCC 311', 'Advanced Networking',                  3, 300, 'First'],
    ['NCC 312', 'Cloud Computing Fundamentals',         3, 300, 'First'],
    ['NCC 313', 'Network Security',                     3, 300, 'First'],
    ['NCC 314', 'Linux Administration',                 3, 300, 'First'],
    // ---- HND 1 / Second ----
    ['NCC 321', 'Virtualisation Technologies',          3, 300, 'Second'],
    ['NCC 322', 'Cloud Architecture',                   3, 300, 'Second'],
    ['NCC 323', 'Wireless Networks',                    3, 300, 'Second'],
    ['NCC 324', 'Network Design and Management',        3, 300, 'Second'],
    // ---- HND 2 / First ----
    ['NCC 411', 'DevOps for Cloud',                     3, 400, 'First'],
    ['NCC 412', 'IoT and Edge Computing',               3, 400, 'First'],
    ['NCC 413', 'Research Methods',                     3, 400, 'First'],
    // ---- HND 2 / Second ----
    ['NCC 421', 'Final Year Project',                   6, 400, 'Second'],
    ['NCC 422', 'Cloud Security and Compliance',        3, 400, 'Second'],
  ],
};

// ============================================================
// MAIN
// ============================================================
(async () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Seeding ND / HND Courses — Federal Polytechnic, Ugep');
  console.log('══════════════════════════════════════════════════\n');

  try {
    // Pre-load programme map (code → id)
    const progRows = await db.query('SELECT id, code, department_id FROM programmes');
    const progMap  = Object.fromEntries(progRows.rows.map(p => [p.code, p]));

    let inserted = 0;
    let skipped  = 0;
    const missingProgrammes = [];

    for (const [progCode, list] of Object.entries(COURSES)) {
      const prog = progMap[progCode];

      if (!prog) {
        console.log(`⚠️  Programme ${progCode} not found — skipping ${list.length} courses`);
        missingProgrammes.push(progCode);
        continue;
      }

      console.log(`\n📖 ${progCode} — inserting ${list.length} course(s)...`);

      for (const [code, title, units, level, semester] of list) {
        // Check for existing by unique key (programme, code, level, semester)
        const exists = await db.query(
          `SELECT 1 FROM courses
            WHERE code = $1 AND programme_id = $2
              AND level = $3 AND semester_name = $4`,
          [code, prog.id, level, semester]
        );

        if (exists.rows.length) {
          skipped++;
          continue;
        }

        await db.query(
          `INSERT INTO courses
             (code, title, units, department_id, programme_id,
              level, semester_name, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
          [code, title, units, prog.department_id, prog.id, level, semester]
        );

        inserted++;
        console.log(`   + [L${level} ${semester.padEnd(6)}] ${code.padEnd(10)} — ${title}`);
      }
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ DONE');
    console.log('══════════════════════════════════════════════════');
    console.log(`  Inserted : ${inserted}`);
    console.log(`  Skipped  : ${skipped}  (already existed)`);

    if (missingProgrammes.length) {
      console.log(`\n  ⚠️  Missing programmes: ${missingProgrammes.join(', ')}`);
      console.log('      Run `node scripts/seed-ugep.js` first, then re-run this.');
    }

    // Show a per-level summary
    const summary = await db.query(`
      SELECT
        p.code AS programme,
        c.level,
        c.semester_name,
        COUNT(*)::int AS courses,
        SUM(c.units)::int AS total_units
      FROM courses c
      JOIN programmes p ON p.id = c.programme_id
      WHERE p.code = ANY($1)
      GROUP BY p.code, c.level, c.semester_name
      ORDER BY p.code, c.level, c.semester_name
    `, [Object.keys(COURSES)]);

    console.log('\n📊 Course Summary:');
    console.table(summary.rows);

    // Grand totals
    const totals = await db.query(`
      SELECT
        COUNT(*)::int AS total_courses,
        SUM(units)::int AS total_units
      FROM courses
    `);
    console.log(`\n🎓 Total active courses in system: ${totals.rows[0].total_courses}`);
    console.log(`📚 Total units in system:          ${totals.rows[0].total_units}`);
    console.log('');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    if (err.hint)   console.error('   Hint:',   err.hint);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();