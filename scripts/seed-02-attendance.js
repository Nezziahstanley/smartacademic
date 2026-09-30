// ============================================================
// SMARTACADEMIC — Seed Part 2: Class Sessions + Attendance
// Usage: node scripts/seed-02-attendance.js
// ============================================================

'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

// Attendance rate by risk target — the same profile used in Part 3
const ATTENDANCE_RATE = {
  GREEN:  0.92,
  YELLOW: 0.72,
  ORANGE: 0.55,
  RED:    0.35,
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function batchInsert(table, columns, rows, onConflict = '') {
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const nCols = columns.length;
    const values = [];
    const params = [];
    chunk.forEach((row, j) => {
      const base = j * nCols;
      values.push('(' + row.map((_, k) => `$${base + k + 1}`).join(',') + ')');
      for (const v of row) params.push(v);
    });
    await db.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values.join(',')} ${onConflict}`,
      params
    );
    process.stdout.write(`   ${table}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}\r`);
  }
  process.stdout.write('\n');
}

(async () => {
  const t0 = Date.now();
  console.log('\n=== Seed Part 2: Class Sessions + Attendance ===\n');

  try {
    const currentSessionId  = (await db.query('SELECT id FROM sessions WHERE is_active = TRUE LIMIT 1')).rows[0].id;
    const currentSemesterId = (await db.query('SELECT id FROM semesters WHERE is_active = TRUE LIMIT 1')).rows[0].id;
    const priorSessionRow   = (await db.query("SELECT id FROM sessions WHERE name = '2025/2026'")).rows[0];
    if (!priorSessionRow) throw new Error("Prior session 2025/2026 not found — run seed-01 first");
    const priorSessionId = priorSessionRow.id;
    const priorSemesterRow = (await db.query(
      "SELECT id FROM semesters WHERE session_id = $1 AND name = 'First'",
      [priorSessionId]
    )).rows[0];
    if (!priorSemesterRow) throw new Error("Prior semester not found — run seed-01 first");
    const priorSemesterId = priorSemesterRow.id;

    console.log(`Current session ${currentSessionId}, semester ${currentSemesterId}`);
    console.log(`Prior session   ${priorSessionId}, semester ${priorSemesterId}\n`);

    // ---------- LOAD REGISTRATIONS ----------
    const regs = (await db.query(`
      SELECT cr.student_id, cr.course_id, cr.session_id, cr.semester_id,
             c.code AS course_code
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
    `)).rows;

    if (!regs.length) throw new Error('No registrations found — run seed-01 first');
    console.log(`Found ${regs.length} registrations to process\n`);

    // ---------- ASSIGN RISK CATEGORY PER STUDENT ----------
    // Same distribution logic as seed-03 so attendance and scores are consistent
    const students = (await db.query('SELECT id FROM students ORDER BY id')).rows;
    const riskByStudent = {};
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    shuffled.forEach((s, i) => {
      const r = i / students.length;
      const cat = r < 0.53 ? 'GREEN' : r < 0.80 ? 'YELLOW' : r < 0.93 ? 'ORANGE' : 'RED';
      riskByStudent[s.id] = cat;
    });
    console.log(`Assigned risk categories across ${students.length} students\n`);

    // ---------- CLEAR EXISTING SESSIONS + ATTENDANCE ----------
    // Idempotent re-run: wipe and rebuild
    console.log('Clearing previous class sessions and attendance...');
    await db.query('DELETE FROM attendance');
    await db.query('DELETE FROM class_sessions');
    console.log('   Cleared\n');

    // ---------- BUILD CLASS SESSIONS ----------
    console.log('Building class sessions...');
    const sessionKeys = new Set();
    const sessionsToInsert = [];

    for (const r of regs) {
      const isCurrent = r.session_id === currentSessionId;
      for (let w = 0; w < 12; w++) {
        const daysBack = isCurrent ? 7 * (12 - w) : 400 + 7 * (12 - w);
        const date = daysAgo(daysBack);
        const key = `${r.course_id}|${date}`;
        if (sessionKeys.has(key)) continue;
        sessionKeys.add(key);
        sessionsToInsert.push([
          r.course_id,
          date,
          '09:00',
          '11:00',
          `Week ${w + 1}`,
          1,
        ]);
      }
    }

    console.log(`   Inserting ${sessionsToInsert.length} unique class sessions...`);
    await batchInsert(
      'class_sessions',
      ['course_id', 'session_date', 'start_time', 'end_time', 'topic', 'created_by'],
      sessionsToInsert
    );

    // ---------- LOAD BACK SESSION IDS ----------
    // Cast session_date to text so keys match the daysAgo() string format
    const csRows = (await db.query(
      "SELECT id, course_id, TO_CHAR(session_date, 'YYYY-MM-DD') AS d FROM class_sessions"
    )).rows;
    const csMap = new Map();
    csRows.forEach(c => csMap.set(`${c.course_id}|${c.d}`, c.id));
    console.log(`   ${csMap.size} class session keys loaded\n`);

    // ---------- BUILD ATTENDANCE ----------
    console.log('Building attendance records...');
    const attendanceRows = [];

    for (const r of regs) {
      const rate = ATTENDANCE_RATE[riskByStudent[r.student_id]] || 0.75;
      const isCurrent = r.session_id === currentSessionId;

      for (let w = 0; w < 12; w++) {
        const daysBack = isCurrent ? 7 * (12 - w) : 400 + 7 * (12 - w);
        const date = daysAgo(daysBack);
        const csId = csMap.get(`${r.course_id}|${date}`);
        if (!csId) continue;

        const roll = Math.random();
        const status = roll < rate ? 'present' : (roll < rate + 0.05 ? 'excused' : 'absent');
        attendanceRows.push([csId, r.student_id, status, 1]);
      }
    }

    console.log(`   Inserting ${attendanceRows.length} attendance records (batched)...`);
    await batchInsert(
      'attendance',
      ['class_session_id', 'student_id', 'status', 'recorded_by'],
      attendanceRows,
      'ON CONFLICT DO NOTHING'
    );

    // ---------- VERIFY ----------
    const verify = (await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM class_sessions) AS sessions,
        (SELECT COUNT(*)::int FROM attendance)     AS attendance
    `)).rows[0];
    console.log('\n📊 Verify:');
    console.table([verify]);

    console.log(`\n✅ Part 2 complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log('   Next: node scripts/seed-03-scores.js\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();