// ============================================================
// SMARTACADEMIC — Matric Number Generator
// Format: FPU/<SCHOOL>/<DEPT>/<LEVEL>/<YY>/<SERIAL>
//   e.g. FPU/SST/CST/ND/26/001
// Serial is sequential within (school, dept, level, year).
// ============================================================

'use strict';

const db = require('../config/db');

/* ============================================================
   DEPARTMENT → (SCHOOL_CODE, DEPT_CODE)
   Matched by department name (case-insensitive).
   ============================================================ */
const DEPARTMENT_CODES = {
  'computer science':                       { school: 'SST',  dept: 'CST' },
  'mathematics':                            { school: 'SST',  dept: 'MTH' },
  'physics':                                { school: 'SST',  dept: 'PHY' },
  'statistics':                             { school: 'SST',  dept: 'STA' },
  'artificial intelligence':                { school: 'SST',  dept: 'AIT' },

  'computer engineering':                   { school: 'SET',  dept: 'CEN' },
  'civil engineering':                      { school: 'SET',  dept: 'CIV' },
  'electrical/electronics engineering':     { school: 'SET',  dept: 'EEE' },
  'electrical engineering':                 { school: 'SET',  dept: 'EEE' },
  'electrical & electronics engineering':   { school: 'SET',  dept: 'EEE' },
  'electrical and electronics engineering': { school: 'SET',  dept: 'EEE' },
  'mechatronics engineering':               { school: 'SET',  dept: 'MEC' },

  'architectural technology':               { school: 'SES',  dept: 'ARC' },
  'architecture':                           { school: 'SES',  dept: 'ARC' },

  'business administration and management': { school: 'SMSS', dept: 'BAM' },
  'business administration':                { school: 'SMSS', dept: 'BAM' },
  'public administration':                  { school: 'SMSS', dept: 'PAD' },
  'accountancy':                            { school: 'SMSS', dept: 'ACC' },
  'accounting':                             { school: 'SMSS', dept: 'ACC' },
  'library and information science':        { school: 'SMSS', dept: 'LIS' },
  'library & information science':          { school: 'SMSS', dept: 'LIS' },
  'hospitality and tourism management':     { school: 'SMSS', dept: 'HTM' },
  'hospitality & tourism management':       { school: 'SMSS', dept: 'HTM' },
  'hospitality management':                 { school: 'SMSS', dept: 'HTM' },
  'tourism management':                     { school: 'SMSS', dept: 'HTM' },
};

/* ============================================================
   Fallback: if the department name isn't in the map, derive
   codes from the `departments.code` field in the DB.
   ============================================================ */
function deriveSchoolFromDeptCode(code) {
  const c = String(code || '').toUpperCase();
  if (['CEN','CIV','EEE','MEC','CSC','CST'].includes(c)) {
    return c === 'CSC' || c === 'CST' ? 'SST' : 'SET';
  }
  if (['ARC'].includes(c))  return 'SES';
  if (['BAM','PAD','ACC','LIS','HTM'].includes(c)) return 'SMSS';
  if (['STA','AIT','MTH','PHY'].includes(c)) return 'SST';
  return 'SST';
}

function resolveDeptCodes(department) {
  const nameKey = String(department.name || '').trim().toLowerCase();

  // Try exact map first
  if (DEPARTMENT_CODES[nameKey]) return DEPARTMENT_CODES[nameKey];

  // Try stripping common prefixes
  const stripped = nameKey.replace(/^department of\s+/, '').replace(/^dept\.?\s+of\s+/, '');
  if (DEPARTMENT_CODES[stripped]) return DEPARTMENT_CODES[stripped];

  // Fallback from the department.code field
  const code = String(department.code || '').toUpperCase();
  return {
    school: deriveSchoolFromDeptCode(code),
    dept: code || 'GEN',
  };
}

/* ============================================================
   LEVEL TAG (ND / HND) from programme code
   ============================================================ */
function levelTagFromProgrammeCode(code) {
  const c = String(code || '').toUpperCase();
  if (c.endsWith('-HND')) return 'HND';
  if (c.endsWith('-ND'))  return 'ND';
  return 'ND';
}

/* ============================================================
   GENERATE
   ============================================================ */
/**
 * Generate the next matric number for a student.
 *
 * @param {object} opts
 * @param {number} opts.departmentId
 * @param {number} opts.programmeId
 * @param {number} opts.admissionYear   4-digit year
 * @param {object} [opts.client]        Optional pg client (transaction)
 * @returns {Promise<string>}           e.g. "FPU/SST/CST/ND/26/001"
 */
async function generateMatric({ departmentId, programmeId, admissionYear, client = null }) {
  const runner = client || db;

  // 1. Load department + programme
  const deptRes = await runner.query(
    'SELECT id, name, code FROM departments WHERE id = $1',
    [departmentId]
  );
  if (!deptRes.rows[0]) throw new Error('Department not found for matric generation');
  const department = deptRes.rows[0];

  const progRes = await runner.query(
    'SELECT id, code, name FROM programmes WHERE id = $1',
    [programmeId]
  );
  if (!progRes.rows[0]) throw new Error('Programme not found for matric generation');
  const programme = progRes.rows[0];

  // 2. Resolve codes
  const { school, dept } = resolveDeptCodes(department);
  const tag = levelTagFromProgrammeCode(programme.code);
  const yy  = String(admissionYear || new Date().getFullYear()).slice(-2);

  // 3. Find max serial in the same bucket
  const prefix = `FPU/${school}/${dept}/${tag}/${yy}/`;

  const maxRes = await runner.query(`
    SELECT matric_no
      FROM students
     WHERE matric_no LIKE $1 || '%'
     ORDER BY matric_no DESC
     LIMIT 1
  `, [prefix]);

  let nextSerial = 1;
  if (maxRes.rows[0]) {
    const tail = maxRes.rows[0].matric_no.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!isNaN(n)) nextSerial = n + 1;
  }

  // 4. Format with 3-digit zero-padding (001–999)
  const serial = String(nextSerial).padStart(3, '0');
  return `${prefix}${serial}`;
}

module.exports = {
  generateMatric,
  resolveDeptCodes,
  levelTagFromProgrammeCode,
  DEPARTMENT_CODES,
};