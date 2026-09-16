// ============================================================
// SMARTACADEMIC — Federal Polytechnic, Ugep
// NBTE-Compliant Curriculum Seed
// Usage: node scripts/seed-nbte-fpu.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

/* ============================================================
   DEPARTMENTS
   ============================================================ */
const DEPARTMENTS = [
  { code: 'SET',  name: 'School of Engineering and Technology' },
  { code: 'SST',  name: 'School of Science and Technology' },
  { code: 'SES',  name: 'School of Environmental Studies' },
  { code: 'SMSS', name: 'School of Management and Social Sciences' },
  { code: 'CEN',  name: 'Computer Engineering' },
  { code: 'CIV',  name: 'Civil Engineering' },
  { code: 'EEE',  name: 'Electrical/Electronics Engineering' },
  { code: 'CSC',  name: 'Computer Science' },
  { code: 'STA',  name: 'Statistics' },
  { code: 'AIT',  name: 'Artificial Intelligence' },
  { code: 'ARC',  name: 'Architectural Technology' },
  { code: 'BAM',  name: 'Business Administration and Management' },
  { code: 'PAD',  name: 'Public Administration' },
  { code: 'ACC',  name: 'Accountancy' },
  { code: 'LIS',  name: 'Library and Information Science' },
  { code: 'HTM',  name: 'Hospitality and Tourism Management' },
];

/* ============================================================
   PROGRAMMES
   ============================================================ */
const PROGRAMMES = [
  { code: 'CEN-ND', name: 'ND Computer Engineering', deptCode: 'CEN', duration: 2 },
  { code: 'CIV-ND', name: 'ND Civil Engineering', deptCode: 'CIV', duration: 2 },
  { code: 'EEE-ND', name: 'ND Electrical/Electronics Engineering', deptCode: 'EEE', duration: 2 },
  { code: 'CSC-ND', name: 'ND Computer Science', deptCode: 'CSC', duration: 2 },
  { code: 'STA-ND', name: 'ND Statistics', deptCode: 'STA', duration: 2 },
  { code: 'AIT-ND', name: 'ND Artificial Intelligence', deptCode: 'AIT', duration: 2 },
  { code: 'ARC-ND', name: 'ND Architectural Technology', deptCode: 'ARC', duration: 2 },
  { code: 'BAM-ND', name: 'ND Business Administration and Management', deptCode: 'BAM', duration: 2 },
  { code: 'PAD-ND', name: 'ND Public Administration', deptCode: 'PAD', duration: 2 },
  { code: 'ACC-ND', name: 'ND Accountancy', deptCode: 'ACC', duration: 2 },
  { code: 'LIS-ND', name: 'ND Library and Information Science', deptCode: 'LIS', duration: 2 },
  { code: 'HTM-ND', name: 'ND Hospitality and Tourism Management', deptCode: 'HTM', duration: 2 },
  { code: 'SWD-HND', name: 'HND Software and Web Development', deptCode: 'CSC', duration: 2 },
  { code: 'NCC-HND', name: 'HND Networking and Cloud Computing', deptCode: 'CSC', duration: 2 },
];

/* ============================================================
   COURSES — NBTE-Compliant (keys MUST be in quotes)
   Format: [code, title, units, category]
   ============================================================ */
const COURSES = {
  'CSC-ND': {
    '100_First': [
      ['COM 111', 'Introduction to Computing',              3, 'Foundation'],
      ['COM 112', 'Introduction to Digital Electronics',   3, 'Foundation'],
      ['COM 113', 'Introduction to Programming',           4, 'Professional'],
      ['COM 114', 'Statistics for Computing I',            2, 'Foundation'],
      ['COM 115', 'Computer Application Packages I',       3, 'Professional'],
      ['MTH 111', 'Logic and Linear Algebra',              2, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['COM 121', 'Computer Application Packages II',      3, 'Professional'],
      ['COM 122', 'Programming in C',                      4, 'Professional'],
      ['COM 123', 'Statistics for Computing II',           2, 'Foundation'],
      ['COM 124', 'Computer Hardware I',                   3, 'Professional'],
      ['COM 125', 'Introduction to Web Technology',        3, 'Professional'],
      ['MTH 121', 'Calculus',                              3, 'Foundation'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['COM 211', 'Programming Language using Java II',    4, 'Professional'],
      ['COM 212', 'Introduction to Systems Programming',   2, 'Professional'],
      ['COM 213', 'Unified Modelling Language (UML)',      3, 'Professional'],
      ['COM 214', 'Computer Systems Troubleshooting',      3, 'Professional'],
      ['COM 215', 'Computer Application Packages II',      3, 'Professional'],
      ['COM 216', 'Statistics for Computing II',           2, 'Foundation'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
    ],
    '200_Second': [
      ['COM 221', 'Basic Computer Networking',             3, 'Professional'],
      ['COM 222', 'Seminar on Computer and Society',       2, 'Professional'],
      ['COM 223', 'Basic Hardware Maintenance',            2, 'Professional'],
      ['COM 224', 'Management Information System',         2, 'Professional'],
      ['COM 225', 'Web Technology',                        3, 'Professional'],
      ['COM 226', 'File Organisation and Management',      2, 'Professional'],
      ['COM 227', 'Project',                               6, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
    ],
  },

  'CEN-ND': {
    '100_First': [
      ['COM 111', 'Introduction to Computer',              3, 'Foundation'],
      ['CTE 101', 'Introduction to Software Engineering',  2, 'Professional'],
      ['EEC 112', 'Electrical Engineering Science',        3, 'Foundation'],
      ['EEC 116', 'Electrical Workshop Practice I',        2, 'Professional'],
      ['MEC 101', 'Technical Drawing',                     3, 'Foundation'],
      ['MEC 104', 'Mechanical Workshop Tech. & Practice',  2, 'Professional'],
      ['MTH 112', 'Algebra and Elementary Trigonometry',   3, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 127', 'Citizenship Education',                 2, 'GNS'],
      ['STA 111', 'Introduction to Statistics',            3, 'Foundation'],
    ],
    '100_Second': [
      ['COM 122', 'Computer Operations',                   3, 'Professional'],
      ['COM 221', 'Computer Programming (FORTRAN)',        3, 'Professional'],
      ['CTE 121', 'Digital Computer Fundamentals I',       3, 'Professional'],
      ['CTE 222', 'Computer Workshop Practice II',         2, 'Professional'],
      ['CTE 102', 'Introduction to Network Engineering I', 2, 'Professional'],
      ['EEC 124', 'Electronics I',                         3, 'Foundation'],
      ['EEC 126', 'Electrical Workshop Practice II',       2, 'Professional'],
      ['EEC 128', 'Electrical Instrumentation & Measurement I', 3, 'Professional'],
      ['GNS 102', 'Communication in English I',            2, 'GNS'],
      ['GNS 125', 'Economics',                             2, 'GNS'],
      ['MEC 102', 'Descriptive Geometry',                  3, 'Foundation'],
      ['MEC 108', 'Introduction to Thermodynamics',        3, 'Foundation'],
      ['MTH 211', 'Calculus',                              3, 'Foundation'],
    ],
    '200_First': [
      ['CTE 211', 'Micro Computer Fundamentals',           3, 'Professional'],
      ['CTE 213', 'Digital Computer Fundamentals II',      3, 'Professional'],
      ['CTE 214', 'Computer Architecture',                 3, 'Professional'],
      ['CTE 201', 'Introduction to System Design Eng. I',  3, 'Professional'],
      ['EEC 232', 'Electrical Circuit Theory I',           3, 'Professional'],
      ['EEC 234', 'Electronics II',                        3, 'Professional'],
      ['EEC 235', 'Electrical Instrumentation & Measurement II', 3, 'Professional'],
      ['EEC 237', 'Electrical/Electronic Maintenance & Repair',  3, 'Professional'],
      ['EED 217', 'Entrepreneurship Practical I',          2, 'GNS'],
      ['GNS 228', 'Research Methods',                      2, 'GNS'],
      ['MTH 202', 'Logic and Linear Algebra',              2, 'Foundation'],
    ],
    '200_Second': [
      ['CTE 202', 'Introduction to System Design Eng. II', 3, 'Professional'],
      ['CTE 204', 'Computer Workshop Practice III',        2, 'Professional'],
      ['CTE 206', 'Microprocessor & Interfacing',          3, 'Professional'],
      ['EEC 242', 'Electrical Circuit Theory II',          3, 'Professional'],
      ['EED 227', 'Entrepreneurship Practical II',         2, 'GNS'],
      ['GNS 202', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'CIV-ND': {
    '100_First': [
      ['CEC 101', 'Structural Mechanics',                  3, 'Professional'],
      ['CEC 103', 'Workshop Technology I',                 2, 'Professional'],
      ['CEC 105', 'Civil Engineering Construction I',      3, 'Professional'],
      ['CEC 107', 'Introduction to Fluid Mechanics',       3, 'Professional'],
      ['MEC 101', 'Technical Drawing',                     3, 'Foundation'],
      ['MTH 112', 'Algebra and Elementary Trigonometry',   3, 'Foundation'],
      ['STA 111', 'Introduction to Statistics',            2, 'Foundation'],
      ['SUG 101', 'Basic Principles in Surveying I',       3, 'Professional'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 111', 'Citizenship Education I',               2, 'GNS'],
      ['GNS 221', 'Physical and Health Education',         1, 'GNS'],
    ],
    '100_Second': [
      ['CEC 102', 'Introductory Hydrology',                3, 'Professional'],
      ['CEC 104', 'Science and Properties of Materials',   3, 'Professional'],
      ['CEC 106', 'Strength of Materials',                 3, 'Professional'],
      ['CEC 108', 'Engineering Geology and Basic Soil Mechanics', 3, 'Professional'],
      ['CEC 110', 'Civil Engineering Construction II',     3, 'Professional'],
      ['MEC 102', 'Descriptive Geometry',                  3, 'Foundation'],
      ['MTH 211', 'Calculus',                              3, 'Foundation'],
      ['SUG 102', 'Basic Principles in Surveying II',      3, 'Professional'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
      ['SDV 210', 'Entrepreneurship Development I',        2, 'GNS'],
    ],
    '200_First': [
      ['CEC 201', 'Hydraulics and Hydrology',              3, 'Professional'],
      ['CEC 203', 'Workshop Technology II',                2, 'Professional'],
      ['CEC 205', 'Theory of Structures I',                3, 'Professional'],
      ['CEC 207', 'Hydrogeology',                          3, 'Professional'],
      ['CEC 209', 'Civil Engineering Drawing I',           3, 'Professional'],
      ['CEC 211', 'Civil Engineering Construction III',    3, 'Professional'],
      ['MTH 122', 'Trigonometry and Analytical Geometry',  3, 'Foundation'],
      ['SUG 208', 'Engineering Survey I',                  3, 'Professional'],
      ['ICT 201', 'Introduction to Computing',             2, 'Foundation'],
      ['SDV 211', 'Entrepreneurship Development II',       2, 'GNS'],
    ],
    '200_Second': [
      ['CEC 202', 'Water Supply and Sanitary Engineering', 3, 'Professional'],
      ['CEC 204', 'Introduction to Highway Engineering',   3, 'Professional'],
      ['CEC 206', 'Introduction to Structural Design',     3, 'Professional'],
      ['CEC 208', 'Soil Science and Irrigation Engineering', 3, 'Professional'],
      ['CEC 210', 'Civil Engineering Drawing II',          3, 'Professional'],
      ['CEC 212', 'Soil Mechanics I',                      3, 'Professional'],
      ['CEC 214', 'Engineering Measurement & Evaluation',  2, 'Professional'],
      ['CEC 216', 'Construction Management',               2, 'Professional'],
      ['CEC 242', 'Technical Report Writing',              2, 'GNS'],
      ['GIT 201', 'Elements of Geo-informatics',           3, 'Foundation'],
      ['ICT 102', 'Introduction to Programming Using Q-Basic', 3, 'Foundation'],
    ],
  },

  'EEE-ND': {
    '100_First': [
      ['EEE 111', 'Introduction to Electrical Engineering', 3, 'Professional'],
      ['EEE 112', 'Electrical Drawing I',                  3, 'Foundation'],
      ['EEE 113', 'Electrical Workshop Practice I',        2, 'Professional'],
      ['EEE 114', 'Applied Mechanics',                     3, 'Foundation'],
      ['MTH 112', 'Algebra and Elementary Trigonometry',   3, 'Foundation'],
      ['MEC 101', 'Technical Drawing',                     3, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 127', 'Citizenship Education',                 2, 'GNS'],
    ],
    '100_Second': [
      ['EEE 121', 'Electrical Circuits I',                 3, 'Professional'],
      ['EEE 122', 'Electrical Drawing II',                 3, 'Foundation'],
      ['EEE 123', 'Electrical Workshop Practice II',       2, 'Professional'],
      ['EEE 124', 'Electronics I',                         3, 'Professional'],
      ['MTH 211', 'Calculus',                              3, 'Foundation'],
      ['MEC 102', 'Descriptive Geometry',                  3, 'Foundation'],
      ['GNS 102', 'Communication in English I',            2, 'GNS'],
      ['GNS 125', 'Economics',                             2, 'GNS'],
    ],
    '200_First': [
      ['EEE 211', 'Electrical Machines I',                 3, 'Professional'],
      ['EEE 212', 'Electronics II',                        3, 'Professional'],
      ['EEE 213', 'Electrical Measurements',               3, 'Professional'],
      ['EEE 214', 'Electrical Circuit Theory',             3, 'Professional'],
      ['EEE 215', 'Electrical/Electronic Maintenance',     3, 'Professional'],
      ['MTH 202', 'Logic and Linear Algebra',              2, 'Foundation'],
      ['EED 217', 'Entrepreneurship Practical I',          2, 'GNS'],
      ['GNS 228', 'Research Methods',                      2, 'GNS'],
    ],
    '200_Second': [
      ['EEE 221', 'Electrical Machines II',                3, 'Professional'],
      ['EEE 222', 'Power Systems I',                       3, 'Professional'],
      ['EEE 223', 'Electronics III',                       3, 'Professional'],
      ['EEE 224', 'Electrical Installation',               3, 'Professional'],
      ['EED 227', 'Entrepreneurship Practical II',         2, 'GNS'],
      ['GNS 202', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'STA-ND': {
    '100_First': [
      ['STA 111', 'Introduction to Statistics',            3, 'Foundation'],
      ['STA 112', 'Descriptive Statistics',                3, 'Foundation'],
      ['MTH 111', 'Logic and Linear Algebra',              3, 'Foundation'],
      ['MTH 112', 'Algebra and Elementary Trigonometry',   3, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['STA 121', 'Probability Theory I',                  3, 'Foundation'],
      ['STA 122', 'Statistical Computing',                 3, 'Foundation'],
      ['MTH 121', 'Calculus',                              3, 'Foundation'],
      ['MTH 122', 'Trigonometry and Analytical Geometry',  3, 'Foundation'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['STA 211', 'Probability Distributions',             3, 'Professional'],
      ['STA 212', 'Sampling Theory',                       3, 'Professional'],
      ['STA 213', 'Regression Analysis',                   3, 'Professional'],
      ['MTH 202', 'Logic and Linear Algebra',              2, 'Foundation'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['STA 221', 'Statistical Inference',                 3, 'Professional'],
      ['STA 222', 'Design of Experiments',                 3, 'Professional'],
      ['STA 223', 'Time Series Analysis',                  3, 'Professional'],
      ['STA 224', 'Statistics Project',                    3, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'AIT-ND': {
    '100_First': [
      ['AIT 111', 'Introduction to Artificial Intelligence', 3, 'Professional'],
      ['AIT 112', 'Python Programming I',                  3, 'Professional'],
      ['AIT 113', 'Mathematics for AI',                    3, 'Foundation'],
      ['COM 111', 'Introduction to Computing',             3, 'Foundation'],
      ['MTH 111', 'Logic and Linear Algebra',              2, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['AIT 121', 'Python Programming II',                 3, 'Professional'],
      ['AIT 122', 'Data Science Fundamentals',             3, 'Professional'],
      ['AIT 123', 'Introduction to Machine Learning',      3, 'Professional'],
      ['MTH 121', 'Calculus',                              3, 'Foundation'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['AIT 211', 'Machine Learning I',                    3, 'Professional'],
      ['AIT 212', 'Neural Networks',                       3, 'Professional'],
      ['AIT 213', 'Data Mining',                           3, 'Professional'],
      ['AIT 214', 'AI Tools and Frameworks',               3, 'Professional'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['AIT 221', 'Machine Learning II',                   3, 'Professional'],
      ['AIT 222', 'Natural Language Processing',           3, 'Professional'],
      ['AIT 223', 'Computer Vision',                       3, 'Professional'],
      ['AIT 224', 'AI Project',                            4, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'ARC-ND': {
    '100_First': [
      ['ARC 111', 'Introduction to Architecture',          3, 'Professional'],
      ['ARC 112', 'Architectural Drawing I',               3, 'Professional'],
      ['ARC 113', 'Building Materials I',                  3, 'Professional'],
      ['ARC 114', 'Freehand Sketching',                    2, 'Professional'],
      ['MTH 112', 'Algebra and Elementary Trigonometry',   3, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['ARC 121', 'Architectural Drawing II',              3, 'Professional'],
      ['ARC 122', 'Building Materials II',                 3, 'Professional'],
      ['ARC 123', 'Architectural Design I',                3, 'Professional'],
      ['ARC 124', 'Model Making',                          2, 'Professional'],
      ['MTH 121', 'Calculus',                              3, 'Foundation'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['ARC 211', 'Architectural Design II',               4, 'Professional'],
      ['ARC 212', 'Building Construction I',               3, 'Professional'],
      ['ARC 213', 'Computer Aided Design',                 3, 'Professional'],
      ['ARC 214', 'Site Planning',                         3, 'Professional'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['ARC 221', 'Architectural Design III',              4, 'Professional'],
      ['ARC 222', 'Building Construction II',              3, 'Professional'],
      ['ARC 223', 'Architectural Project',                 4, 'Professional'],
      ['ARC 224', 'Landscape Design',                      3, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'BAM-ND': {
    '100_First': [
      ['BAM 111', 'Introduction to Business I',            3, 'Professional'],
      ['BAM 112', 'Business Mathematics I',                3, 'Foundation'],
      ['BAM 113', 'Principles of Law',                     3, 'Professional'],
      ['BAM 114', 'Principles of Economics I',             3, 'Professional'],
      ['ACC 111', 'Principles of Accounts I',              4, 'Professional'],
      ['BAM 115', 'Principles of Marketing',               3, 'Professional'],
      ['BAM 116', 'Elements of Public Administration',     3, 'Professional'],
      ['GNS 111', 'Citizenship Education',                 2, 'GNS'],
    ],
    '100_Second': [
      ['BAM 121', 'Introduction to Business II',           3, 'Professional'],
      ['BAM 122', 'Business Mathematics II',               3, 'Foundation'],
      ['BAM 124', 'Principles of Economics II',            3, 'Professional'],
      ['BAM 126', 'Introduction to Entrepreneurship',      3, 'GNS'],
      ['ACC 121', 'Principles of Accounts II',             4, 'Professional'],
      ['BAM 123', 'Introduction to Social Psychology',     3, 'Professional'],
      ['OTM 112', 'Technical English I',                   4, 'GNS'],
      ['GNS 131', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['BAM 211', 'Business Statistics',                   3, 'Foundation'],
      ['BAM 212', 'Human Resource Management',             3, 'Professional'],
      ['BAM 213', 'Entrepreneurship Development',          3, 'GNS'],
      ['BAM 214', 'Business Finance I',                    3, 'Professional'],
      ['BAM 215', 'Organisational Behaviour',              3, 'Professional'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['BAM 221', 'Business Law',                          3, 'Professional'],
      ['BAM 222', 'Financial Management',                  3, 'Professional'],
      ['BAM 223', 'Marketing Management',                  3, 'Professional'],
      ['BAM 224', 'Business Project',                      4, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'PAD-ND': {
    '100_First': [
      ['PAD 111', 'Introduction to Public Administration', 3, 'Professional'],
      ['PAD 112', 'Elements of Government',                3, 'Professional'],
      ['PAD 113', 'Principles of Management',              3, 'Professional'],
      ['PAD 114', 'Principles of Economics',               3, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['PAD 121', 'Nigerian Government and Politics',      3, 'Professional'],
      ['PAD 122', 'Public Personnel Administration',       3, 'Professional'],
      ['PAD 123', 'Business Communication',                2, 'GNS'],
      ['PAD 124', 'Introduction to Sociology',             3, 'Foundation'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['PAD 211', 'Administrative Theory',                 3, 'Professional'],
      ['PAD 212', 'Public Finance',                        3, 'Professional'],
      ['PAD 213', 'Local Government Administration',       3, 'Professional'],
      ['PAD 214', 'Comparative Public Administration',     3, 'Professional'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['PAD 221', 'Public Policy Analysis',                3, 'Professional'],
      ['PAD 222', 'Development Administration',            3, 'Professional'],
      ['PAD 223', 'Public Administration Project',         4, 'Professional'],
      ['PAD 224', 'International Administration',          3, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'ACC-ND': {
    '100_First': [
      ['ACC 111', 'Principles of Accounting I',            4, 'Professional'],
      ['ACC 112', 'Introduction to Business',              3, 'Professional'],
      ['ACC 113', 'Business Mathematics',                  3, 'Foundation'],
      ['ACC 114', 'Principles of Economics',               3, 'Foundation'],
      ['ACC 115', 'Business Law',                          3, 'Professional'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['ACC 121', 'Principles of Accounting II',           4, 'Professional'],
      ['ACC 122', 'Business Communication',                2, 'GNS'],
      ['ACC 123', 'Economics I',                           3, 'Foundation'],
      ['ACC 124', 'Information Technology',                3, 'Foundation'],
      ['ACC 125', 'Cost Accounting I',                     3, 'Professional'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['ACC 211', 'Intermediate Accounting I',             4, 'Professional'],
      ['ACC 212', 'Cost Accounting II',                    3, 'Professional'],
      ['ACC 213', 'Business Statistics',                   3, 'Foundation'],
      ['ACC 214', 'Taxation I',                            3, 'Professional'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['ACC 221', 'Intermediate Accounting II',            4, 'Professional'],
      ['ACC 222', 'Cost Accounting III',                   3, 'Professional'],
      ['ACC 223', 'Taxation II',                           3, 'Professional'],
      ['ACC 224', 'Auditing Principles',                   3, 'Professional'],
      ['ACC 225', 'Accounting Project',                    4, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'LIS-ND': {
    '100_First': [
      ['LIS 111', 'Introduction to Library Science',       3, 'Professional'],
      ['LIS 112', 'Reference Services',                    3, 'Professional'],
      ['LIS 113', 'Classification and Cataloguing I',      3, 'Professional'],
      ['COM 111', 'Introduction to Computing',             3, 'Foundation'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['LIS 121', 'Classification and Cataloguing II',     3, 'Professional'],
      ['LIS 122', 'Information Sources and Services',      3, 'Professional'],
      ['LIS 123', 'Library and Society',                   2, 'Professional'],
      ['COM 122', 'Computer Application Packages',         3, 'Foundation'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['LIS 211', 'Information Technology in Libraries',   3, 'Professional'],
      ['LIS 212', 'Collection Development',                3, 'Professional'],
      ['LIS 213', 'Indexing and Abstracting',              3, 'Professional'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['LIS 221', 'Library Management',                    3, 'Professional'],
      ['LIS 222', 'Information Retrieval',                 3, 'Professional'],
      ['LIS 223', 'Library Project',                       4, 'Professional'],
      ['LIS 224', 'Digital Libraries',                     3, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'HTM-ND': {
    '100_First': [
      ['HTM 111', 'Introduction to Hospitality',           3, 'Professional'],
      ['HTM 112', 'Introduction to Tourism',               3, 'Professional'],
      ['HTM 113', 'Food and Beverage Production I',        3, 'Professional'],
      ['HTM 114', 'Front Office Operations I',             3, 'Professional'],
      ['GNS 101', 'Use of English I',                      2, 'GNS'],
      ['GNS 103', 'Citizenship Education I',               2, 'GNS'],
    ],
    '100_Second': [
      ['HTM 121', 'Food and Beverage Production II',       3, 'Professional'],
      ['HTM 122', 'Hospitality Marketing',                 3, 'Professional'],
      ['HTM 123', 'Travel and Tour Operations',            3, 'Professional'],
      ['HTM 124', 'Housekeeping Operations',               3, 'Professional'],
      ['GNS 102', 'Use of English II',                     2, 'GNS'],
      ['GNS 104', 'Citizenship Education II',              2, 'GNS'],
    ],
    '200_First': [
      ['HTM 211', 'Front Office Operations II',            3, 'Professional'],
      ['HTM 212', 'Housekeeping Management',               3, 'Professional'],
      ['HTM 213', 'Food and Beverage Management',          3, 'Professional'],
      ['EED 216', 'Practice of Entrepreneurship',          2, 'GNS'],
      ['GNS 201', 'Use of English II',                     2, 'GNS'],
    ],
    '200_Second': [
      ['HTM 221', 'Tourism Planning and Development',      3, 'Professional'],
      ['HTM 222', 'Event Management',                      3, 'Professional'],
      ['HTM 223', 'Hospitality Project',                   4, 'Professional'],
      ['HTM 224', 'Cultural Tourism',                      3, 'Professional'],
      ['GNS 204', 'Communication in English II',           2, 'GNS'],
      ['SIW 219', 'SIWES',                                 4, 'Professional'],
    ],
  },

  'SWD-HND': {
    '300_First': [
      ['SWD 311', 'Advanced Web Development',              3, 'Professional'],
      ['SWD 312', 'Software Architecture',                 3, 'Professional'],
      ['SWD 313', 'Database Systems',                      3, 'Professional'],
      ['SWD 314', 'Server-Side Programming',               3, 'Professional'],
      ['SWD 315', 'Research Methodology',                  2, 'GNS'],
      ['GNS 301', 'Technical Report Writing',              2, 'GNS'],
    ],
    '300_Second': [
      ['SWD 321', 'Front-End Frameworks',                  3, 'Professional'],
      ['SWD 322', 'API Design and Development',            3, 'Professional'],
      ['SWD 323', 'Cloud-Based Applications',              3, 'Professional'],
      ['SWD 324', 'Mobile App Development',                3, 'Professional'],
      ['SWD 325', 'Software Testing',                      3, 'Professional'],
      ['GNS 302', 'Communication in English III',          2, 'GNS'],
    ],
    '400_First': [
      ['SWD 411', 'DevOps and Deployment',                 3, 'Professional'],
      ['SWD 412', 'Software Testing and QA',               3, 'Professional'],
      ['SWD 413', 'Advanced Database Systems',             3, 'Professional'],
      ['SWD 414', 'Research Methods',                      2, 'GNS'],
    ],
    '400_Second': [
      ['SWD 421', 'Final Year Project',                    6, 'Professional'],
      ['SWD 422', 'Software Project Management',           3, 'Professional'],
      ['SWD 423', 'Professional Practice',                 3, 'Professional'],
      ['GNS 402', 'Research Project',                      2, 'GNS'],
    ],
  },

  'NCC-HND': {
    '300_First': [
      ['NCC 311', 'Advanced Networking',                   3, 'Professional'],
      ['NCC 312', 'Cloud Computing Fundamentals',          3, 'Professional'],
      ['NCC 313', 'Network Security',                      3, 'Professional'],
      ['NCC 314', 'Linux Administration',                  3, 'Professional'],
      ['NCC 315', 'Research Methodology',                  2, 'GNS'],
      ['GNS 301', 'Technical Report Writing',              2, 'GNS'],
    ],
    '300_Second': [
      ['NCC 321', 'Virtualisation Technologies',           3, 'Professional'],
      ['NCC 322', 'Cloud Architecture',                    3, 'Professional'],
      ['NCC 323', 'Wireless Networks',                     3, 'Professional'],
      ['NCC 324', 'Network Design and Management',         3, 'Professional'],
      ['NCC 325', 'Cloud Security',                        3, 'Professional'],
      ['GNS 302', 'Communication in English III',          2, 'GNS'],
    ],
    '400_First': [
      ['NCC 411', 'DevOps for Cloud',                      3, 'Professional'],
      ['NCC 412', 'IoT and Edge Computing',                3, 'Professional'],
      ['NCC 413', 'Enterprise Networking',                 3, 'Professional'],
      ['NCC 414', 'Research Methods',                      2, 'GNS'],
    ],
    '400_Second': [
      ['NCC 421', 'Final Year Project',                    6, 'Professional'],
      ['NCC 422', 'Cloud Security and Compliance',         3, 'Professional'],
      ['NCC 423', 'Professional Practice',                 3, 'Professional'],
      ['GNS 402', 'Research Project',                      2, 'GNS'],
    ],
  },
};

/* ============================================================
   MAIN
   ============================================================ */
(async () => {
  try {
    console.log('\n══════════════════════════════════════════════════');
    console.log('  NBTE-Compliant Seed — Federal Polytechnic, Ugep');
    console.log('══════════════════════════════════════════════════\n');

    // 1. Wipe academic data
    console.log('1. Wiping existing academic data...');
    await db.query('TRUNCATE TABLE risk_assessments RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE results RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE scores RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE assessments RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE attendance RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE class_sessions RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE course_registrations RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE interventions RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE courses RESTART IDENTITY CASCADE');
    await db.query('DELETE FROM students');
    await db.query('TRUNCATE TABLE programmes RESTART IDENTITY CASCADE');
    await db.query('TRUNCATE TABLE departments RESTART IDENTITY CASCADE');
    console.log('   ✅ Cleared');

    // 2. Departments
    console.log('\n2. Creating departments...');
    const deptMap = {};
    for (const d of DEPARTMENTS) {
      const r = await db.query(
        'INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id',
        [d.name, d.code]
      );
      deptMap[d.code] = r.rows[0].id;
    }
    console.log(`   ✅ ${DEPARTMENTS.length} departments`);

    // 3. Programmes
    console.log('\n3. Creating programmes...');
    const progMap = {};
    for (const p of PROGRAMMES) {
      const r = await db.query(
        'INSERT INTO programmes (name, code, department_id, duration_years) VALUES ($1, $2, $3, $4) RETURNING id',
        [p.name, p.code, deptMap[p.deptCode], p.duration]
      );
      progMap[p.code] = r.rows[0].id;
    }
    console.log(`   ✅ ${PROGRAMMES.length} programmes`);

    // 4. Courses
    console.log('\n4. Creating courses (NBTE-compliant)...');
    let totalCourses = 0;
    const semReport = [];

    for (const [progCode, semesters] of Object.entries(COURSES)) {
      const progId = progMap[progCode];
      const progRow = await db.query('SELECT department_id FROM programmes WHERE id = $1', [progId]);
      const deptId = progRow.rows[0].department_id;

      for (const [semKey, courses] of Object.entries(semesters)) {
        const [levelStr, semester] = semKey.split('_');
        const level = parseInt(levelStr, 10);

        for (const [code, title, units] of courses) {
          await db.query(`
            INSERT INTO courses
              (code, title, units, department_id, programme_id, level, semester_name, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
          `, [code, title, units, deptId, progId, level, semester]);
          totalCourses++;
        }

        const semUnits = courses.reduce((s, c) => s + c[2], 0);
        semReport.push({
          Programme: progCode,
          Level: level,
          Semester: semester,
          Courses: courses.length,
          Units: semUnits,
        });
      }
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ SEED COMPLETE');
    console.log('══════════════════════════════════════════════════');

    console.log('\n📊 Course Summary:');
    console.table(semReport);

    const totals = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM departments) AS departments,
        (SELECT COUNT(*)::int FROM programmes)  AS programmes,
        (SELECT COUNT(*)::int FROM courses WHERE is_active = TRUE) AS courses
    `);
    console.log('\n📈 Totals:');
    console.table(totals.rows);

    console.log('\n🎓 FPU data seeded successfully!\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();