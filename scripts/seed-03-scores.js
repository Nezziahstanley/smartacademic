// ============================================================
// SMARTACADEMIC — Seed Part 3: Assessments + Scores + Engines
// Usage: node scripts/seed-03-scores.js
// ============================================================

'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');
const { recomputeResults } = require('../backend/services/academicEngine');
const { assessAllStudents } = require('../backend/services/riskEngine');

const PER_PROGRAMME = 15;

const SCORE_PROFILE = {
  GREEN:  { caPct: [0.75, 0.90], examPct: [0.70, 0.88] },
  YELLOW: { caPct: [0.55, 0.70], examPct: [0.50, 0.68] },
  ORANGE: { caPct: [0.35, 0.55], examPct: [0.30, 0.48] },
  RED:    { caPct: [0.15, 0.35], examPct: [0.15, 0.35] },
};

function randBetween(min, max){ return min + Math.random() * (max - min); }

async function batchInsert(table, columns, rows, onConflict = '') {
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const nCols = columns.length;
    const values = []; const params = [];
    chunk.forEach((row, j) => {
      const base = j * nCols;
      values.push('(' + row.map((_, k) => `$${base + k + 1}`).join(',') + ')');
      params.push(...row);
    });
    await db.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values.join(',')} ${onConflict}`,
      params);
    process.stdout.write(`   ${table}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}\r`);
  }
  process.stdout.write('\n');
}

(async () => {
  const t0 = Date.now();
  console.log('\n=== Seed Part 3: Assessments + Scores + Engines ===\n');

  try {
    const currentSessionId = (await db.query('SELECT id FROM sessions WHERE is_active=TRUE LIMIT 1')).rows[0].id;
    const currentSemesterId = (await db.query('SELECT id FROM semesters WHERE is_active=TRUE LIMIT 1')).rows[0].id;
    const priorSessionId = (await db.query("SELECT id FROM sessions WHERE name='2025/2026'")).rows[0].id;
    const priorSemesterId = (await db.query("SELECT id FROM semesters WHERE session_id=$1 AND name='First'", [priorSessionId])).rows[0].id;

    const regs = (await db.query(`
      SELECT cr.student_id, cr.course_id, cr.session_id, cr.semester_id,
             c.code AS course_code
        FROM course_registrations cr
        JOIN courses c ON c.id = cr.course_id
    `)).rows;

    console.log(`Found ${regs.length} registrations`);

    // Same risk assignment logic as part 2
    const students = (await db.query('SELECT id FROM students ORDER BY id')).rows;
    const riskByStudent = {};
    const order = [...students].sort(() => Math.random() - 0.5);
    order.forEach((s, i) => {
      const r = i / students.length;
      const cat = r < 0.53 ? 'GREEN' : r < 0.80 ? 'YELLOW' : r < 0.93 ? 'ORANGE' : 'RED';
      riskByStudent[s.id] = cat;
    });

    // ---------- BUILD ASSESSMENTS ----------
    console.log('\nBuilding assessments...');
    const assessRows = [];
    const seenA = new Set();
    for (const r of regs) {
      for (const a of [
        { type: 'test', label: 'CA 1', max: 15, weight: 15 },
        { type: 'test', label: 'CA 2', max: 15, weight: 15 },
        { type: 'exam', label: 'Exam', max: 70, weight: 70 },
      ]) {
        const key = `${r.course_id}|${r.session_id}|${r.semester_id}|${a.label}`;
        if (seenA.has(key)) continue;
        seenA.add(key);
        assessRows.push([
          r.course_id, r.session_id, r.semester_id,
          a.type, `${r.course_code} — ${a.label}`, a.max, a.weight, 1
        ]);
      }
    }

    console.log(`   Inserting ${assessRows.length} assessments...`);
    await batchInsert(
      'assessments',
      ['course_id', 'session_id', 'semester_id', 'type', 'title', 'max_score', 'weight', 'created_by'],
      assessRows
    );

    // Load assessment IDs
    const assessMap = new Map();
    const aRows = (await db.query(
      'SELECT id, course_id, session_id, semester_id, title FROM assessments')).rows;
    aRows.forEach(a => assessMap.set(`${a.course_id}|${a.session_id}|${a.semester_id}|${a.title}`, a.id));

    // ---------- BUILD SCORES ----------
    console.log('\nBuilding scores...');
    const scoreRows = [];

    for (const r of regs) {
      const profile = SCORE_PROFILE[riskByStudent[r.student_id]] || SCORE_PROFILE.YELLOW;
      const isPrior = r.session_id === priorSessionId;

      for (const a of [
        { label: 'CA 1', max: 15, type: 'ca' },
        { label: 'CA 2', max: 15, type: 'ca' },
        { label: 'Exam', max: 70, type: 'exam' },
      ]) {
        const title = `${r.course_code} — ${a.label}`;
        const assessId = assessMap.get(`${r.course_id}|${r.session_id}|${r.semester_id}|${title}`);
        if (!assessId) continue;

        const [minP, maxP] = a.type === 'exam' ? profile.examPct : profile.caPct;
        let pct = randBetween(minP, maxP);
        // Prior semester slightly better — enables GPA decline
        if (isPrior) pct = Math.min(1, pct + 0.10);

        const score = +(pct * a.max).toFixed(2);
        scoreRows.push([assessId, r.student_id, score, 1]);
      }
    }

    console.log(`   Inserting ${scoreRows.length} scores (batched)...`);
    await batchInsert(
      'scores',
      ['assessment_id', 'student_id', 'score', 'entered_by'],
      scoreRows,
      'ON CONFLICT DO NOTHING'
    );

    // ---------- RUN ENGINES ----------
    console.log('\nRunning academic engine...');
    const r1 = await recomputeResults({});
    console.log(`   ✅ ${r1.updated} results computed`);

    await db.query('UPDATE results SET is_published = TRUE');
    console.log('   ✅ All results published');

    console.log('\nRunning risk engine...');
    const r2 = await assessAllStudents({});
    console.log(`   ✅ ${r2.count} students assessed`);

    // ---------- SUMMARY ----------
    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ SEED COMPLETE');
    console.log('══════════════════════════════════════════════════');

    const dist = await db.query(`
      SELECT ra.risk_category, COUNT(*)::int AS n
        FROM risk_assessments ra
       WHERE ra.assessed_at = (
         SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id
       )
       GROUP BY ra.risk_category
       ORDER BY CASE ra.risk_category
         WHEN 'GREEN' THEN 1 WHEN 'YELLOW' THEN 2
         WHEN 'ORANGE' THEN 3 WHEN 'RED' THEN 4 ELSE 5 END
    `);
    console.log('\n📊 Risk Distribution:');
    console.table(dist.rows);

    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM students)             AS students,
        (SELECT COUNT(*)::int FROM users WHERE role_id=(SELECT id FROM roles WHERE name='lecturer')) AS lecturers,
        (SELECT COUNT(*)::int FROM courses WHERE is_active=TRUE) AS courses,
        (SELECT COUNT(*)::int FROM course_registrations)  AS registrations,
        (SELECT COUNT(*)::int FROM class_sessions)        AS class_sessions,
        (SELECT COUNT(*)::int FROM attendance)            AS attendance,
        (SELECT COUNT(*)::int FROM assessments)           AS assessments,
        (SELECT COUNT(*)::int FROM scores)                AS scores,
        (SELECT COUNT(*)::int FROM results)               AS results,
        (SELECT COUNT(*)::int FROM risk_assessments)      AS risk_assessments
    `);
    console.log('\n📈 Totals:');
    console.table(counts.rows);
    console.log(`\n⏱️  Total time: ${((Date.now()-t0)/1000).toFixed(1)}s\n`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();