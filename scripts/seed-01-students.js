// ============================================================
// SMARTACADEMIC — Seed Part 1: Students & Registrations
// Usage: node scripts/seed-01-students.js
// ============================================================

'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');

const BCRYPT_ROUNDS = 10;
const STUDENT_PASSWORD = 'Student@123';
const LECTURER_PASSWORD = 'Lect@123';
const PER_PROGRAMME = 15;

const FIRST_M = ['Chinedu','Emeka','Ikenna','Obinna','Nnamdi','Ifeanyi','Uchenna','Chukwuemeka','Tunde','Femi','Segun','Wale','Bola','Kunle','Ade','Sola','Ibrahim','Musa','Yusuf','Ahmed','Abdul','Sani','Bello','Aliyu','Etim','Okon','Effiong','Edet','Aniefiok','Ubong','Emmanuel','Samuel','Daniel','Michael','Joseph','David','Joshua','Peter','Paul','John'];
const FIRST_F = ['Chidinma','Ngozi','Adaeze','Nneka','Ifeoma','Amarachi','Chiamaka','Ogechi','Titi','Bola','Kemi','Funke','Yemi','Sade','Ronke','Bukola','Aisha','Fatima','Zainab','Halima','Maryam','Hauwa','Rukayat','Blessing','Nkoyo','Ekaete','Grace','Hope','Faith','Peace','Mercy','Sarah','Ruth','Esther','Deborah','Rebecca','Hannah','Rachel','Elizabeth'];
const LAST = ['Okafor','Okonkwo','Nwosu','Eze','Obi','Onyeka','Chukwu','Uche','Adeyemi','Adebayo','Ogunleye','Oyelaran','Fashola','Balogun','Olawale','Akinyemi','Ibrahim','Yusuf','Musa','Abubakar','Bello','Sani','Aliyu','Usman','Bassey','Etim','Okon','Effiong','Edet','Aniefiok','Ubong','Ekpo','Nwachukwu'];

const LECTURERS = {
  CEN: { name: 'Engr. Emeka Nwosu',  staff: 'FPU/CEN/L001' },
  CIV: { name: 'Engr. Bola Adeyemi', staff: 'FPU/CIV/L001' },
  EEE: { name: 'Engr. Musa Ibrahim', staff: 'FPU/EEE/L001' },
  CSC: { name: 'Dr. Chidinma Eze',   staff: 'FPU/CSC/L001' },
  STA: { name: 'Dr. Aisha Yusuf',    staff: 'FPU/STA/L001' },
  AIT: { name: 'Dr. Nnamdi Okafor',  staff: 'FPU/AIT/L001' },
  ARC: { name: 'Arc. Tunde Balogun', staff: 'FPU/ARC/L001' },
  BAM: { name: 'Dr. Funke Adebayo',  staff: 'FPU/BAM/L001' },
  PAD: { name: 'Dr. Ibrahim Sani',   staff: 'FPU/PAD/L001' },
  ACC: { name: 'Dr. Ngozi Okonkwo',  staff: 'FPU/ACC/L001' },
  LIS: { name: 'Dr. Kemi Oyelaran',  staff: 'FPU/LIS/L001' },
  HTM: { name: 'Mrs. Blessing Etim', staff: 'FPU/HTM/L001' },
};

const RISK_TARGETS = ['GREEN','GREEN','GREEN','GREEN','GREEN','GREEN','GREEN','GREEN','YELLOW','YELLOW','YELLOW','YELLOW','ORANGE','ORANGE','RED'];

function pick(a){return a[Math.floor(Math.random()*a.length)];}
function randInt(min,max){return Math.floor(min+Math.random()*(max-min+1));}
function slug(s){return s.toLowerCase().replace(/[^a-z]/g,'');}
function pad(n,l=3){return String(n).padStart(l,'0');}

(async () => {
  const t0 = Date.now();
  console.log('\n=== Seed Part 1: Students & Registrations ===\n');

  try {
    // ============ WIPE ============
    console.log('Wiping existing data...');
    await db.query('DELETE FROM interventions');
    await db.query('DELETE FROM risk_assessments');
    await db.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name='student'))");
    await db.query('DELETE FROM scores');
    await db.query('DELETE FROM assessments');
    await db.query('DELETE FROM attendance');
    await db.query('DELETE FROM class_sessions');
    await db.query('DELETE FROM results');
    await db.query('DELETE FROM course_registrations');
    await db.query("DELETE FROM users WHERE role_id = (SELECT id FROM roles WHERE name='student')");
    await db.query("DELETE FROM users WHERE role_id = (SELECT id FROM roles WHERE name='lecturer')");
    console.log('   ✅ Wiped\n');

    // ============ LECTURERS ============
    console.log('Creating lecturers...');
    const lecPw = await bcrypt.hash(LECTURER_PASSWORD, BCRYPT_ROUNDS);
    const lecRoleId = (await db.query("SELECT id FROM roles WHERE name='lecturer'")).rows[0].id;
    const lecturerMap = {};

    for (const [deptCode, info] of Object.entries(LECTURERS)) {
      const dept = await db.query('SELECT id FROM departments WHERE code = $1', [deptCode]);
      if (!dept.rows[0]) { console.log(`   ⚠️  Dept ${deptCode} missing`); continue; }
      const deptId = dept.rows[0].id;

      const email = `lecturer.${deptCode.toLowerCase()}@fpugep.edu.ng`;
      const exists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      let userId;
      if (exists.rows[0]) {
        userId = exists.rows[0].id;
        const l = await db.query('SELECT id FROM lecturers WHERE user_id = $1', [userId]);
        if (l.rows[0]) { lecturerMap[deptCode] = l.rows[0].id; continue; }
      } else {
        const u = await db.query(
          `INSERT INTO users (full_name, email, phone, password_hash, role_id, is_active)
           VALUES ($1, $2, '+2348000000100', $3, $4, TRUE) RETURNING id`,
          [info.name, email, lecPw, lecRoleId]);
        userId = u.rows[0].id;
      }
      const l = await db.query(
        `INSERT INTO lecturers (user_id, staff_id, department_id, title, is_active)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
        [userId, info.staff, deptId, info.name.split(' ')[0]]);
      lecturerMap[deptCode] = l.rows[0].id;
    }
    console.log(`   ✅ ${Object.keys(lecturerMap).length} lecturers\n`);

    // ============ PRIOR SESSION ============
    console.log('Ensuring prior session...');
    let priorSessionId, priorSemesterId;
    const ps = await db.query("SELECT id FROM sessions WHERE name='2025/2026'");
    if (ps.rows[0]) priorSessionId = ps.rows[0].id;
    else priorSessionId = (await db.query(
      `INSERT INTO sessions (name, start_date, end_date, is_active)
       VALUES ('2025/2026','2025-09-01','2026-07-31',FALSE) RETURNING id`)).rows[0].id;

    const psm = await db.query("SELECT id FROM semesters WHERE session_id=$1 AND name='First'", [priorSessionId]);
    if (psm.rows[0]) priorSemesterId = psm.rows[0].id;
    else priorSemesterId = (await db.query(
      `INSERT INTO semesters (session_id, name, start_date, end_date, is_active)
       VALUES ($1,'First','2025-09-01','2026-01-31',FALSE) RETURNING id`, [priorSessionId])).rows[0].id;
    console.log(`   ✅ Prior session ${priorSessionId}, semester ${priorSemesterId}\n`);

    // ============ LOOKUPS ============
    const currentSessionId = (await db.query('SELECT id FROM sessions WHERE is_active=TRUE LIMIT 1')).rows[0].id;
    const currentSemesterId = (await db.query('SELECT id FROM semesters WHERE is_active=TRUE LIMIT 1')).rows[0].id;
    const programmes = (await db.query('SELECT id, code, department_id FROM programmes')).rows;
    const courses = (await db.query(
      'SELECT id, code, level, semester_name, programme_id, department_id FROM courses WHERE is_active=TRUE')).rows;

    // ============ STUDENTS (batched) ============
    console.log('Creating students...');
    const stuPw = await bcrypt.hash(STUDENT_PASSWORD, BCRYPT_ROUNDS);
    const stuRoleId = (await db.query("SELECT id FROM roles WHERE name='student'")).rows[0].id;

    // Build all student rows as parameter arrays
    const studentRows = [];       // for users insert
    const studentMeta = [];        // parallel array: { programme, level, deptId, target, matric, email }
    let serialByProg = {};

    for (const prog of programmes) {
      const progCourses = courses.filter(c => c.programme_id === prog.id);
      if (!progCourses.length) continue;
      const level = prog.code.endsWith('-HND') ? 300 : 100;
      const targets = [...RISK_TARGETS];
      // shuffle
      for (let i = targets.length-1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [targets[i], targets[j]] = [targets[j], targets[i]];
      }
      const serial = serialByProg[prog.code] || 1;

      for (let i = 0; i < PER_PROGRAMME; i++) {
        const isF = Math.random() < 0.5;
        const fn = isF ? pick(FIRST_F) : pick(FIRST_M);
        const ln = pick(LAST);
        const fullName = `${fn} ${ln}`;
        const email = `${slug(fn)}.${slug(ln)}${randInt(1,999)}@student.fpugep.edu.ng`;
        const prefix = prog.code.split('-')[0];
        const tag = prog.code.endsWith('-HND') ? 'HND' : 'ND';
        const matric = `FPU/${prefix}/${tag}/26/${pad(serial + i,3)}`;

        studentRows.push([fullName, email, '+234800000' + pad(randInt(1000,9999),4), stuPw, stuRoleId]);
        studentMeta.push({ progId: prog.id, deptId: prog.department_id, level, target: targets[i], matric, email });
      }
      serialByProg[prog.code] = serial + PER_PROGRAMME;
    }

    // Batch INSERT users in chunks of 200
    const userIds = [];
    const CHUNK = 200;
    for (let i = 0; i < studentRows.length; i += CHUNK) {
      const chunk = studentRows.slice(i, i + CHUNK);
      const values = [];
      const params = [];
      chunk.forEach((row, j) => {
        const b = j * 5;
        values.push(`($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, TRUE)`);
        params.push(...row);
      });
      const r = await db.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role_id, is_active)
         VALUES ${values.join(',')} RETURNING id`,
        params);
      r.rows.forEach(x => userIds.push(x.id));
      process.stdout.write(`   users batch ${Math.floor(i/CHUNK)+1}: ${r.rowCount}\r`);
    }
    console.log(`\n   ✅ ${userIds.length} users created`);

    // Batch INSERT students
    const studentIdRows = userIds.map((uid, idx) => [
      uid, studentMeta[idx].matric, studentMeta[idx].deptId,
      studentMeta[idx].progId, studentMeta[idx].level
    ]);
    const studentIds = [];
    for (let i = 0; i < studentIdRows.length; i += CHUNK) {
      const chunk = studentIdRows.slice(i, i + CHUNK);
      const values = []; const params = [];
      chunk.forEach((row, j) => {
        const b = j * 5;
        values.push(`($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, 2026, TRUE)`);
        params.push(...row);
      });
      const r = await db.query(
        `INSERT INTO students (user_id, matric_no, department_id, programme_id, level, admission_year, is_active)
         VALUES ${values.join(',')} RETURNING id`,
        params);
      r.rows.forEach(x => studentIds.push(x.id));
    }
    console.log(`   ✅ ${studentIds.length} students created`);

    // ============ REGISTRATIONS (batched) ============
    console.log('Creating registrations...');
    const regRows = []; // [studentId, courseId, sessionId, semesterId]

    studentIds.forEach((sid, idx) => {
      const meta = studentMeta[idx];
      const progCourses = courses.filter(c => c.programme_id === meta.progId
        && c.level === meta.level && c.semester_name === 'First');
      for (const c of progCourses) {
        regRows.push([sid, c.id, currentSessionId, currentSemesterId]);
        regRows.push([sid, c.id, priorSessionId, priorSemesterId]);
      }
    });

    for (let i = 0; i < regRows.length; i += 500) {
      const chunk = regRows.slice(i, i + 500);
      const values = []; const params = [];
      chunk.forEach((row, j) => {
        const b = j * 4;
        values.push(`($${b+1}, $${b+2}, $${b+3}, $${b+4}, 'approved')`);
        params.push(...row);
      });
      await db.query(
        `INSERT INTO course_registrations (student_id, course_id, session_id, semester_id, status)
         VALUES ${values.join(',')} ON CONFLICT DO NOTHING`,
        params);
    }
    console.log(`   ✅ ${regRows.length} registrations`);

    console.log(`\n✅ Part 1 complete in ${((Date.now()-t0)/1000).toFixed(1)}s`);
    console.log('   Next: node scripts/seed-02-attendance.js\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();