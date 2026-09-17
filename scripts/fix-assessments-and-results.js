// ============================================================
// SMARTACADEMIC — Fix Assessments + Results
// Wipes broken assessments, seeds fresh ones with session_id
// and semester_id, then computes results.
//
// Usage: node scripts/fix-assessments-and-results.js
// ============================================================

'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n══════════════════════════════════════════════');
    console.log('  Fix Assessments + Results');
    console.log('══════════════════════════════════════════════\n');

    /* 1. Get active session & semester */
    console.log('1. Loading active session & semester...');
    const sess = await db.query('SELECT id, name FROM sessions WHERE is_active = TRUE LIMIT 1');
    const sem  = await db.query('SELECT id, name FROM semesters WHERE is_active = TRUE LIMIT 1');

    if (!sess.rows[0] || !sem.rows[0]) {
      console.log('   ❌ No active session/semester.');
      process.exit(1);
    }
    const sessionId  = sess.rows[0].id;
    const semesterId = sem.rows[0].id;
    console.log(`   ✅ Session: ${sess.rows[0].name} (id=${sessionId})`);
    console.log(`   ✅ Semester: ${sem.rows[0].name} (id=${semesterId})`);

    /* 2. Fix existing assessments with NULL session_id/semester_id */
    console.log('\n2. Fixing assessments with NULL session/semester...');
    const fixed = await db.query(`
      UPDATE assessments
         SET session_id = $1, semester_id = $2
       WHERE session_id IS NULL OR semester_id IS NULL
       RETURNING id
    `, [sessionId, semesterId]);
    console.log(`   ✅ Fixed ${fixed.rowCount} assessment(s)`);

    /* 3. Check current assessments for the active session */
    const existing = await db.query(`
      SELECT COUNT(*)::int AS n
        FROM assessments
       WHERE session_id = $1 AND semester_id = $2
    `, [sessionId, semesterId]);
    console.log(`   Assessments in active session: ${existing.rows[0].n}`);

    /* 4. Seed assessments for courses that don't have them yet */
    console.log('\n4. Seeding assessments for CSC courses...');

    const courses = await db.query(`
      SELECT c.id, c.code
        FROM courses c
        JOIN programmes p ON p.id = c.programme_id
       WHERE p.code = 'CSC-ND'
         AND c.is_active = TRUE
         AND c.lecturer_id IS NOT NULL
       ORDER BY c.level, c.code
    `);
    console.log(`   Found ${courses.rows.length} CSC courses`);

    const students = await db.query('SELECT id FROM students ORDER BY id');
    console.log(`   Found ${students.rows.length} students`);

    let asmtAdded = 0, scoresAdded = 0;

    // Score profile by student index
    const profiles = [
      { ca: 78, exam: 75 },  // A — GREEN
      { ca: 58, exam: 55 },  // B — YELLOW
      { ca: 45, exam: 42 },  // C — ORANGE
      { ca: 30, exam: 28 },  // D — RED
      { ca: 65, exam: 60 },  // E — fallback
    ];

    for (const c of courses.rows) {
      const defs = [
        { type: 'test', title: `${c.code} CA 1`, max: 30, weight: 15 },
        { type: 'test', title: `${c.code} CA 2`, max: 30, weight: 15 },
        { type: 'exam', title: `${c.code} Exam`, max: 70, weight: 70 },
      ];

      for (const a of defs) {
        const exists = await db.query(
          'SELECT 1 FROM assessments WHERE course_id = $1 AND title = $2 AND session_id = $3',
          [c.id, a.title, sessionId]
        );
        if (exists.rows[0]) continue;

        const ins = await db.query(`
          INSERT INTO assessments
            (course_id, session_id, semester_id, type, title, max_score, weight)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [c.id, sessionId, semesterId, a.type, a.title, a.max, a.weight]);
        const asmtId = ins.rows[0].id;
        asmtAdded++;

        // Add scores for each student
        for (let i = 0; i < students.rows.length; i++) {
          const s = students.rows[i];
          const p = profiles[i % profiles.length];
          const basePct = a.type === 'exam' ? p.exam : p.ca;
          const variance = a.title.includes('CA 2') ? -3 : 2;
          const pct = Math.max(0, Math.min(100, basePct + variance));
          const score = +((pct / 100) * a.max).toFixed(2);

          await db.query(`
            INSERT INTO scores (assessment_id, student_id, score)
            VALUES ($1, $2, $3)
            ON CONFLICT (assessment_id, student_id) DO NOTHING
          `, [asmtId, s.id, score]);
          scoresAdded++;
        }
      }
    }

    console.log(`   ✅ Added ${asmtAdded} assessments, ${scoresAdded} scores`);

    /* 5. Recompute results */
    console.log('\n5. Recomputing results...');
    const { recomputeResults } = require('../backend/services/academicEngine');
    const r = await recomputeResults({});
    console.log(`   ✅ Recomputed ${r.updated} results`);

    /* 6. Summary */
    console.log('\n══════════════════════════════════════════════');
    console.log('  ✅ DONE');
    console.log('══════════════════════════════════════════════\n');

    const final = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM assessments) AS assessments,
        (SELECT COUNT(*)::int FROM scores)      AS scores,
        (SELECT COUNT(*)::int FROM results)     AS results
    `);
    console.table(final.rows);

    console.log('\n🎉 Results ready. Login as lecturer → Results to submit.\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();