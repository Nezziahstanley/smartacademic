// ============================================================
// SMARTACADEMIC — Fix Results Workflow
// 1. Verifies submission_status columns exist
// 2. Seeds demo assessments + scores (if missing)
// 3. Recomputes all results
// 4. Assigns lecturers to courses (if unassigned)
// 5. Prints a full summary
//
// Usage: node scripts/fix-results-workflow.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('\n══════════════════════════════════════════════');
    console.log('  SMARTACADEMIC — Fix Results Workflow');
    console.log('══════════════════════════════════════════════\n');

    /* ============================================================
       STEP 1 — Ensure submission_status columns exist
       ============================================================ */
    console.log('1. Verifying results table columns...');
    await db.query(`
      ALTER TABLE results
        ADD COLUMN IF NOT EXISTS submission_status VARCHAR(15) NOT NULL DEFAULT 'draft'
          CHECK (submission_status IN ('draft', 'submitted', 'approved', 'returned')),
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS submitted_by INT,
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS approved_by INT,
        ADD COLUMN IF NOT EXISTS return_reason TEXT
    `);
    console.log('   ✅ Submission columns present');

    const cols = await db.query(`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_name = 'results'
         AND column_name IN ('submission_status','submitted_at','approved_at','return_reason')
       ORDER BY column_name
    `);
    console.log('   Columns found:', cols.rows.map(r => r.column_name).join(', '));

    /* ============================================================
       STEP 2 — Get active session/semester
       ============================================================ */
    console.log('\n2. Loading active session & semester...');
    const sess = await db.query('SELECT id, name FROM sessions WHERE is_active = TRUE LIMIT 1');
    const sem  = await db.query('SELECT id, name FROM semesters WHERE is_active = TRUE LIMIT 1');

    if (!sess.rows[0] || !sem.rows[0]) {
      console.log('   ❌ No active session/semester.');
      console.log('   Run: node scripts/seed-demo-data.js');
      process.exit(1);
    }
    const sessionId = sess.rows[0].id;
    const semesterId = sem.rows[0].id;
    console.log(`   ✅ Session: ${sess.rows[0].name} (id=${sessionId})`);
    console.log(`   ✅ Semester: ${sem.rows[0].name} (id=${semesterId})`);

    /* ============================================================
       STEP 3 — Check existing data
       ============================================================ */
    console.log('\n3. Checking existing data...');
    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM students)     AS students,
        (SELECT COUNT(*)::int FROM courses WHERE is_active = TRUE) AS courses,
        (SELECT COUNT(*)::int FROM assessments)  AS assessments,
        (SELECT COUNT(*)::int FROM scores)       AS scores,
        (SELECT COUNT(*)::int FROM results)      AS results
    `);
    console.log('   ', counts.rows[0]);

    const studentCount = counts.rows[0].students;
    const courseCount = counts.rows[0].courses;

    if (studentCount === 0) {
      console.log('   ❌ No students. Run seed-demo-users.js first.');
      process.exit(1);
    }
    if (courseCount === 0) {
      console.log('   ❌ No courses. Run seed-nbte-fpu.js first.');
      process.exit(1);
    }

    /* ============================================================
       STEP 4 — Assign lecturers to courses with no lecturer
       ============================================================ */
    console.log('\n4. Ensuring all courses have a lecturer...');
    const lecturerRow = await db.query('SELECT id FROM lecturers LIMIT 1');
    if (lecturerRow.rows[0]) {
      const lecturerId = lecturerRow.rows[0].id;
      const upd = await db.query(`
        UPDATE courses SET lecturer_id = $1
         WHERE lecturer_id IS NULL AND is_active = TRUE
         RETURNING id
      `, [lecturerId]);
      console.log(`   ✅ Assigned lecturer to ${upd.rowCount} course(s)`);
    } else {
      console.log('   ⚠️  No lecturers found — skipping');
    }

    /* ============================================================
       STEP 5 — Seed assessments + scores if missing
       ============================================================ */
    if (counts.rows[0].assessments === 0 || counts.rows[0].scores === 0) {
      console.log('\n5. Seeding assessments + scores...');

      const courses = await db.query(`
        SELECT id, code, lecturer_id FROM courses
         WHERE is_active = TRUE
         ORDER BY code
      `);
      const students = await db.query('SELECT id FROM students ORDER BY id');

      let asmtAdded = 0;
      let scoresAdded = 0;

      // Score profiles per student index (Student A/B/C/D)
      const profiles = [
        { ca: 78, exam: 75 },  // Student A — GREEN
        { ca: 58, exam: 55 },  // Student B — YELLOW
        { ca: 45, exam: 42 },  // Student C — ORANGE
        { ca: 30, exam: 28 },  // Student D — RED
      ];

      for (const c of courses.rows) {
        const asmtDefs = [
          { type: 'test', title: `${c.code} CA 1`, max: 30, weight: 15 },
          { type: 'test', title: `${c.code} CA 2`, max: 30, weight: 15 },
          { type: 'exam', title: `${c.code} Exam`, max: 70, weight: 70 },
        ];

        for (const a of asmtDefs) {
          const exists = await db.query(
            'SELECT 1 FROM assessments WHERE course_id = $1 AND title = $2',
            [c.id, a.title]
          );
          if (exists.rows[0]) continue;

          const ins = await db.query(`
            INSERT INTO assessments
              (course_id, session_id, semester_id, type, title, max_score, weight)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [c.id, sessionId, semesterId, a.type, a.title, a.max, a.weight]);
          const assessId = ins.rows[0].id;
          asmtAdded++;

          // Scores for each student
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
            `, [assessId, s.id, score]);
            scoresAdded++;
          }
        }
      }

      console.log(`   ✅ Added ${asmtAdded} assessments, ${scoresAdded} scores`);
    } else {
      console.log('\n5. Assessments & scores already exist — skipping');
    }

    /* ============================================================
       STEP 6 — Recompute results from scores
       ============================================================ */
    console.log('\n6. Recomputing results from scores...');
    const { recomputeResults } = require('../backend/services/academicEngine');
    const result = await recomputeResults({});
    console.log(`   ✅ Recomputed ${result.updated} results`);

    /* ============================================================
       STEP 7 — Final summary
       ============================================================ */
    console.log('\n══════════════════════════════════════════════');
    console.log('  ✅ DONE');
    console.log('══════════════════════════════════════════════\n');

    const final = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM students)     AS students,
        (SELECT COUNT(*)::int FROM courses WHERE is_active = TRUE) AS courses,
        (SELECT COUNT(*)::int FROM assessments)  AS assessments,
        (SELECT COUNT(*)::int FROM scores)       AS scores,
        (SELECT COUNT(*)::int FROM results)      AS results
    `);
    console.table(final.rows);

    const statusBreakdown = await db.query(`
      SELECT submission_status, COUNT(*)::int AS n
        FROM results
       GROUP BY submission_status
       ORDER BY submission_status
    `);
    console.log('\nResults by submission_status:');
    console.table(statusBreakdown.rows);

    console.log('\n🎉 Results workflow is now ready.');
    console.log('   Next: log in as a lecturer and open Results.\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();