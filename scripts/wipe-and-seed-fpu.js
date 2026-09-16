// ============================================================
// SMARTACADEMIC — Complete Reset to Federal Polytechnic, Ugep
// Wipes ALL academic data (departments, programmes, courses,
// registrations, attendance, results, risk) and re-seeds with
// the correct FPU data.
//
// Usage: node scripts/wipe-and-seed-fpu.js
//
// ⚠️  Preserves: users (admins, lecturers, HODs)
// ⚠️  Deletes:   students, departments, programmes, courses,
//               registrations, attendance, results, risk, etc.
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

/* ============================================================
   DEPARTMENTS (Schools + Programme Departments)
   ============================================================ */
const DEPARTMENTS = [
  // Schools
  { code: 'SET',  name: 'School of Engineering and Technology' },
  { code: 'SST',  name: 'School of Science and Technology' },
  { code: 'SES',  name: 'School of Environmental Studies' },
  { code: 'SMSS', name: 'School of Management and Social Sciences' },

  // Programme departments
  { code: 'CEN', name: 'Computer Engineering' },
  { code: 'CIV', name: 'Civil Engineering' },
  { code: 'EEE', name: 'Electrical/Electronics Engineering' },
  { code: 'CSC', name: 'Computer Science' },
  { code: 'STA', name: 'Statistics' },
  { code: 'AIT', name: 'Artificial Intelligence' },
  { code: 'ARC', name: 'Architectural Technology' },
  { code: 'BAM', name: 'Business Administration and Management' },
  { code: 'PAD', name: 'Public Administration' },
  { code: 'ACC', name: 'Accountancy' },
  { code: 'LIS', name: 'Library and Information Science' },
  { code: 'HTM', name: 'Hospitality and Tourism Management' },
];

/* ============================================================
   PROGRAMMES
   ============================================================ */
const PROGRAMMES = [
  // ND (Level 100 / 200)
  { code: 'CEN-ND', name: 'ND Computer Engineering',                deptCode: 'CEN', duration: 2 },
  { code: 'CIV-ND', name: 'ND Civil Engineering',                   deptCode: 'CIV', duration: 2 },
  { code: 'EEE-ND', name: 'ND Electrical/Electronics Engineering',  deptCode: 'EEE', duration: 2 },
  { code: 'CSC-ND', name: 'ND Computer Science',                    deptCode: 'CSC', duration: 2 },
  { code: 'STA-ND', name: 'ND Statistics',                          deptCode: 'STA', duration: 2 },
  { code: 'AIT-ND', name: 'ND Artificial Intelligence',             deptCode: 'AIT', duration: 2 },
  { code: 'ARC-ND', name: 'ND Architectural Technology',            deptCode: 'ARC', duration: 2 },
  { code: 'BAM-ND', name: 'ND Business Administration and Management', deptCode: 'BAM', duration: 2 },
  { code: 'PAD-ND', name: 'ND Public Administration',               deptCode: 'PAD', duration: 2 },
  { code: 'ACC-ND', name: 'ND Accountancy',                         deptCode: 'ACC', duration: 2 },
  { code: 'LIS-ND', name: 'ND Library and Information Science',     deptCode: 'LIS', duration: 2 },
  { code: 'HTM-ND', name: 'ND Hospitality and Tourism Management',  deptCode: 'HTM', duration: 2 },

  // HND (Level 300 / 400)
  { code: 'SWD-HND', name: 'HND Software and Web Development',      deptCode: 'CSC', duration: 2 },
  { code: 'NCC-HND', name: 'HND Networking and Cloud Computing',    deptCode: 'CSC', duration: 2 },
];

/* ============================================================
   COURSES — Correct Federal Polytechnic Ugep codes
   Format: [code, title, units, level, semester]
   ============================================================ */
const COURSES = {
  // ========== ND COMPUTER ENGINEERING (CEN-ND) ==========
  'CEN-ND': [
    // Level 100 — First
    ['COM 111', 'Introduction to Computing',          3, 100, 'First'],
    ['COM 112', 'Computer Hardware I',                 3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',            3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    // Level 100 — Second
    ['COM 121', 'Computer Hardware II',                3, 100, 'Second'],
    ['COM 122', 'Introduction to Programming',         3, 100, 'Second'],
    ['MTH 121', 'Calculus',                            3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    // Level 200 — First
    ['COM 211', 'Digital Electronics',                 3, 200, 'First'],
    ['COM 212', 'Microprocessor Systems',              3, 200, 'First'],
    ['COM 213', 'Computer Programming I',              3, 200, 'First'],
    ['EEC 211', 'Electrical Principles',               3, 200, 'First'],
    // Level 200 — Second
    ['COM 221', 'Computer Architecture',               3, 200, 'Second'],
    ['COM 222', 'Computer Programming II',             3, 200, 'Second'],
    ['COM 223', 'Data Communication',                  3, 200, 'Second'],
    ['EEC 221', 'Electronic Circuits',                 3, 200, 'Second'],
  ],

  // ========== ND CIVIL ENGINEERING (CIV-ND) ==========
  'CIV-ND': [
    ['CIV 111', 'Introduction to Civil Engineering',   3, 100, 'First'],
    ['CIV 112', 'Engineering Drawing I',               3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',            3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    ['CIV 121', 'Building Construction I',             3, 100, 'Second'],
    ['CIV 122', 'Engineering Drawing II',              3, 100, 'Second'],
    ['MTH 121', 'Calculus',                            3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    ['CIV 211', 'Structural Mechanics I',              3, 200, 'First'],
    ['CIV 212', 'Soil Mechanics I',                    3, 200, 'First'],
    ['CIV 213', 'Fluid Mechanics I',                   3, 200, 'First'],
    ['CIV 221', 'Structural Mechanics II',             3, 200, 'Second'],
    ['CIV 222', 'Soil Mechanics II',                   3, 200, 'Second'],
    ['CIV 223', 'Fluid Mechanics II',                  3, 200, 'Second'],
  ],

  // ========== ND ELECTRICAL/ELECTRONICS ENGINEERING (EEE-ND) ==========
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

  // ========== ND COMPUTER SCIENCE (CSC-ND) ==========
  'CSC-ND': [
    // Level 100 — First
    ['COM 111', 'Introduction to Computing',              3, 100, 'First'],
    ['COM 112', 'Computer Hardware I',                     3, 100, 'First'],
    ['COM 113', 'Introduction to Programming',             3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',                3, 100, 'First'],
    ['GNS 101', 'Use of English I',                        2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',                 2, 100, 'First'],
    // Level 100 — Second
    ['COM 121', 'Computer Hardware II',                    3, 100, 'Second'],
    ['COM 122', 'Programming in C',                        3, 100, 'Second'],
    ['COM 123', 'Desktop Publishing',                      2, 100, 'Second'],
    ['MTH 121', 'Calculus',                                3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                       2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',                2, 100, 'Second'],
    // Level 200 — First
    ['COM 211', 'Data Structures and Algorithms',          3, 200, 'First'],
    ['COM 212', 'Object-Oriented Programming',             3, 200, 'First'],
    ['COM 213', 'Database Design and Management',          3, 200, 'First'],
    ['COM 214', 'Web Development I',                       3, 200, 'First'],
    ['COM 215', 'Operating Systems',                       3, 200, 'First'],
    // Level 200 — Second
    ['COM 221', 'Web Development II',                      3, 200, 'Second'],
    ['COM 222', 'Computer Networks',                       3, 200, 'Second'],
    ['COM 223', 'Software Engineering',                    3, 200, 'Second'],
    ['COM 224', 'Systems Analysis and Design',             3, 200, 'Second'],
    ['COM 225', 'File Organisation and Management',        3, 200, 'Second'],
  ],

  // ========== ND STATISTICS (STA-ND) ==========
  'STA-ND': [
    ['STA 111', 'Introduction to Statistics',          3, 100, 'First'],
    ['STA 112', 'Descriptive Statistics',              3, 100, 'First'],
    ['MTH 111', 'Logic and Linear Algebra',            3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    ['STA 121', 'Probability Theory I',                3, 100, 'Second'],
    ['STA 122', 'Statistical Computing',               3, 100, 'Second'],
    ['MTH 121', 'Calculus',                            3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    ['STA 211', 'Probability Distributions',           3, 200, 'First'],
    ['STA 212', 'Sampling Theory',                     3, 200, 'First'],
    ['STA 213', 'Regression Analysis',                 3, 200, 'First'],
    ['STA 221', 'Statistical Inference',               3, 200, 'Second'],
    ['STA 222', 'Design of Experiments',               3, 200, 'Second'],
    ['STA 223', 'Time Series Analysis',                3, 200, 'Second'],
  ],

  // ========== ND ARTIFICIAL INTELLIGENCE (AIT-ND) ==========
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

  // ========== ND ARCHITECTURAL TECHNOLOGY (ARC-ND) ==========
  'ARC-ND': [
    ['ARC 111', 'Introduction to Architecture',        3, 100, 'First'],
    ['ARC 112', 'Architectural Drawing I',             3, 100, 'First'],
    ['ARC 113', 'Building Materials I',                3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    ['ARC 121', 'Architectural Drawing II',            3, 100, 'Second'],
    ['ARC 122', 'Building Materials II',               3, 100, 'Second'],
    ['ARC 123', 'Freehand Sketching',                  2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    ['ARC 211', 'Architectural Design I',              3, 200, 'First'],
    ['ARC 212', 'Building Construction I',             3, 200, 'First'],
    ['ARC 213', 'Computer Aided Design',               3, 200, 'First'],
    ['ARC 221', 'Architectural Design II',             3, 200, 'Second'],
    ['ARC 222', 'Building Construction II',            3, 200, 'Second'],
    ['ARC 223', 'Site Planning',                       3, 200, 'Second'],
  ],

  // ========== ND BUSINESS ADMINISTRATION (BAM-ND) ==========
  'BAM-ND': [
    ['BAM 111', 'Introduction to Business',            3, 100, 'First'],
    ['BAM 112', 'Principles of Management',            3, 100, 'First'],
    ['BAM 113', 'Elements of Accounting I',            3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    ['BAM 121', 'Principles of Marketing',             3, 100, 'Second'],
    ['BAM 122', 'Elements of Accounting II',           3, 100, 'Second'],
    ['BAM 123', 'Business Communication',              2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    ['BAM 211', 'Business Statistics',                 3, 200, 'First'],
    ['BAM 212', 'Human Resource Management',           3, 200, 'First'],
    ['BAM 213', 'Entrepreneurship Development',        3, 200, 'First'],
    ['BAM 221', 'Business Law',                        3, 200, 'Second'],
    ['BAM 222', 'Organisational Behaviour',            3, 200, 'Second'],
    ['BAM 223', 'Financial Management',                3, 200, 'Second'],
  ],

  // ========== ND PUBLIC ADMINISTRATION (PAD-ND) ==========
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

  // ========== ND ACCOUNTANCY (ACC-ND) ==========
  'ACC-ND': [
    ['ACC 111', 'Principles of Accounting I',          3, 100, 'First'],
    ['ACC 112', 'Introduction to Business',            3, 100, 'First'],
    ['ACC 113', 'Business Mathematics',                3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    ['ACC 121', 'Principles of Accounting II',         3, 100, 'Second'],
    ['ACC 122', 'Business Communication',              2, 100, 'Second'],
    ['ACC 123', 'Economics I',                         3, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    ['ACC 211', 'Intermediate Accounting I',           3, 200, 'First'],
    ['ACC 212', 'Cost Accounting I',                   3, 200, 'First'],
    ['ACC 213', 'Business Statistics',                 3, 200, 'First'],
    ['ACC 221', 'Intermediate Accounting II',          3, 200, 'Second'],
    ['ACC 222', 'Cost Accounting II',                  3, 200, 'Second'],
    ['ACC 223', 'Taxation I',                          3, 200, 'Second'],
  ],

  // ========== ND LIBRARY & INFORMATION SCIENCE (LIS-ND) ==========
  'LIS-ND': [
    ['LIS 111', 'Introduction to Library Science',     3, 100, 'First'],
    ['LIS 112', 'Reference Services',                  3, 100, 'First'],
    ['LIS 113', 'Classification and Cataloguing I',    3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    ['LIS 121', 'Classification and Cataloguing II',   3, 100, 'Second'],
    ['LIS 122', 'Information Sources and Services',    3, 100, 'Second'],
    ['LIS 123', 'Library and Society',                 2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    ['LIS 211', 'Information Technology in Libraries', 3, 200, 'First'],
    ['LIS 212', 'Collection Development',              3, 200, 'First'],
    ['LIS 221', 'Library Management',                  3, 200, 'Second'],
    ['LIS 222', 'Information Retrieval',               3, 200, 'Second'],
  ],

  // ========== ND HOSPITALITY & TOURISM (HTM-ND) ==========
  'HTM-ND': [
    ['HTM 111', 'Introduction to Hospitality',         3, 100, 'First'],
    ['HTM 112', 'Introduction to Tourism',             3, 100, 'First'],
    ['HTM 113', 'Food and Beverage Production I',      3, 100, 'First'],
    ['GNS 101', 'Use of English I',                    2, 100, 'First'],
    ['GNS 103', 'Citizenship Education I',             2, 100, 'First'],
    ['HTM 121', 'Food and Beverage Production II',     3, 100, 'Second'],
    ['HTM 122', 'Hospitality Marketing',               3, 100, 'Second'],
    ['HTM 123', 'Travel and Tour Operations',          2, 100, 'Second'],
    ['GNS 102', 'Use of English II',                   2, 100, 'Second'],
    ['GNS 104', 'Citizenship Education II',            2, 100, 'Second'],
    ['HTM 211', 'Front Office Operations',             3, 200, 'First'],
    ['HTM 212', 'Housekeeping Management',             3, 200, 'First'],
    ['HTM 221', 'Tourism Planning and Development',    3, 200, 'Second'],
    ['HTM 222', 'Event Management',                    3, 200, 'Second'],
  ],

  // ========== HND SOFTWARE & WEB DEVELOPMENT (SWD-HND) ==========
  'SWD-HND': [
    ['SWD 311', 'Advanced Web Development',             3, 300, 'First'],
    ['SWD 312', 'Software Architecture',                3, 300, 'First'],
    ['SWD 313', 'Database Systems',                     3, 300, 'First'],
    ['SWD 314', 'Server-Side Programming',              3, 300, 'First'],
    ['SWD 321', 'Front-End Frameworks',                 3, 300, 'Second'],
    ['SWD 322', 'API Design and Development',           3, 300, 'Second'],
    ['SWD 323', 'Cloud-Based Applications',             3, 300, 'Second'],
    ['SWD 324', 'Mobile App Development',               3, 300, 'Second'],
    ['SWD 411', 'DevOps and Deployment',                3, 400, 'First'],
    ['SWD 412', 'Software Testing and QA',              3, 400, 'First'],
    ['SWD 413', 'Research Methods',                     3, 400, 'First'],
    ['SWD 421', 'Final Year Project',                   6, 400, 'Second'],
    ['SWD 422', 'Software Project Management',          3, 400, 'Second'],
  ],

  // ========== HND NETWORKING & CLOUD COMPUTING (NCC-HND) ==========
  'NCC-HND': [
    ['NCC 311', 'Advanced Networking',                  3, 300, 'First'],
    ['NCC 312', 'Cloud Computing Fundamentals',         3, 300, 'First'],
    ['NCC 313', 'Network Security',                     3, 300, 'First'],
    ['NCC 314', 'Linux Administration',                 3, 300, 'First'],
    ['NCC 321', 'Virtualisation Technologies',          3, 300, 'Second'],
    ['NCC 322', 'Cloud Architecture',                   3, 300, 'Second'],
    ['NCC 323', 'Wireless Networks',                    3, 300, 'Second'],
    ['NCC 324', 'Network Design and Management',        3, 300, 'Second'],
    ['NCC 411', 'DevOps for Cloud',                     3, 400, 'First'],
    ['NCC 412', 'IoT and Edge Computing',               3, 400, 'First'],
    ['NCC 413', 'Research Methods',                     3, 400, 'First'],
    ['NCC 421', 'Final Year Project',                   6, 400, 'Second'],
    ['NCC 422', 'Cloud Security and Compliance',        3, 400, 'Second'],
  ],
};

/* ============================================================
   MAIN
   ============================================================ */
(async () => {
  try {
    console.log('\n══════════════════════════════════════════════════');
    console.log('  WIPE & SEED — Federal Polytechnic, Ugep');
    console.log('══════════════════════════════════════════════════\n');

    /* ============================================================
       STEP 1 — Wipe all academic data (keep admins/lecturers/HODs)
       ============================================================ */
    console.log('1. Wiping existing academic data...');

    // Delete dependent records first
    await db.query('DELETE FROM audit_logs WHERE module IN (\'courses\',\'students\',\'risk\',\'attendance\',\'results\')');
    await db.query('TRUNCATE TABLE risk_assessments RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE results RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE scores RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE assessments RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE attendance RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE class_sessions RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE course_registrations RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE interventions RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE courses RESTART IDENTITY CASCADE');

    // Delete students (not users — keep admins, lecturers, HODs)
    await db.query('DELETE FROM students');
    console.log('   ✅ Cleared: risk, results, scores, assessments, attendance, sessions,');
    console.log('              registrations, interventions, courses, students');

    // Delete old departments and programmes (except seeded ones we might reuse)
    // First detach any users from departments
    await db.query('UPDATE users SET role_id = role_id'); // no-op, ensures connection
    await db.query('TRUNCATE TABLE programmes RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE departments RESTART IDENTITY CASCADE');
    console.log('   ✅ Cleared: departments, programmes');

    /* ============================================================
       STEP 2 — Departments
       ============================================================ */
    console.log('\n2. Creating departments...');
    const deptMap = {};
    for (const d of DEPARTMENTS) {
      const r = await db.query(
        'INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id',
        [d.name, d.code]
      );
      deptMap[d.code] = r.rows[0].id;
      console.log(`   + ${d.code.padEnd(5)} — ${d.name}`);
    }

    /* ============================================================
       STEP 3 — Programmes
       ============================================================ */
    console.log('\n3. Creating programmes...');
    const progMap = {};
    for (const p of PROGRAMMES) {
      const r = await db.query(
        'INSERT INTO programmes (name, code, department_id, duration_years) VALUES ($1, $2, $3, $4) RETURNING id',
        [p.name, p.code, deptMap[p.deptCode], p.duration]
      );
      progMap[p.code] = r.rows[0].id;
      console.log(`   + ${p.code.padEnd(10)} — ${p.name}`);
    }

    /* ============================================================
       STEP 4 — Courses
       ============================================================ */
    console.log('\n4. Creating courses...');
    let total = 0;
    for (const [progCode, list] of Object.entries(COURSES)) {
      const progId = progMap[progCode];
      const progRow = await db.query('SELECT department_id FROM programmes WHERE id = $1', [progId]);
      const deptId = progRow.rows[0].department_id;

      for (const [code, title, units, level, semester] of list) {
        await db.query(`
          INSERT INTO courses
            (code, title, units, department_id, programme_id, level, semester_name, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        `, [code, title, units, deptId, progId, level, semester]);
        total++;
      }
      console.log(`   + ${progCode.padEnd(10)}: ${list.length} courses`);
    }

    /* ============================================================
       STEP 5 — Assign HODs and Lecturers (optional)
       ============================================================ */
    console.log('\n5. Assigning HODs to departments...');
    // Find any user with role = hod and assign them to a department
    const hods = await db.query(`
      SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'hod' LIMIT 5
    `);
    if (hods.rows.length) {
      // Assign first HOD to Computer Science department
      await db.query(
        'UPDATE departments SET hod_id = $1 WHERE code = $2',
        [hods.rows[0].id, 'CSC']
      );
      console.log(`   + ${hods.rows[0].full_name} → Computer Science (CSC)`);
    } else {
      console.log('   ⚠️  No HOD user found — skip. Create one via admin → Users.');
    }

    // Assign lecturers to departments (if any exist)
    const lects = await db.query(`
      SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'lecturer' LIMIT 5
    `);
    if (lects.rows.length) {
      // Assign first two lecturers to Computer Science
      const cscId = deptMap['CSC'];
      for (let i = 0; i < Math.min(2, lects.rows.length); i++) {
        await db.query(`
          INSERT INTO lecturers (user_id, staff_id, department_id, is_active)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (user_id) DO UPDATE SET department_id = $3
        `, [lects.rows[i].id, `FPU-STAFF-${1000 + i}`, cscId]);
        console.log(`   + ${lects.rows[i].full_name} → Computer Science lecturer`);
      }
    } else {
      console.log('   ⚠️  No lecturer users found — skip.');
    }

    /* ============================================================
       SUMMARY
       ============================================================ */
    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ DONE');
    console.log('══════════════════════════════════════════════════');

    const summary = await db.query(`
      SELECT d.code AS department, p.code AS programme, c.level, c.semester_name,
             COUNT(*)::int AS courses, SUM(c.units)::int AS units
        FROM courses c
        JOIN departments d ON d.id = c.department_id
        JOIN programmes p ON p.id = c.programme_id
       GROUP BY d.code, p.code, c.level, c.semester_name
       ORDER BY d.code, c.level, c.semester_name
    `);
    console.log('\n📊 Course Summary:');
    console.table(summary.rows);

    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM departments) AS departments,
        (SELECT COUNT(*)::int FROM programmes)  AS programmes,
        (SELECT COUNT(*)::int FROM courses WHERE is_active = TRUE) AS courses,
        (SELECT COUNT(*)::int FROM users) AS users
    `);
    console.log('\n📈 Totals:');
    console.table(counts.rows);

    console.log('\n🎉 Federal Polytechnic, Ugep data is now live!');
    console.log('   Next: Register students via Admin → Students.');
    console.log('   Example matric format: FPU/CSC/ND/24/001\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    if (err.hint) console.error('   Hint:', err.hint);
  } finally {
    await db.close();
    process.exit(0);
  }
})();