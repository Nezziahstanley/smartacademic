// ============================================================
// SMARTACADEMIC — One-time migration: renumber existing matric numbers
// Usage: node scripts/renumber-matrics.js
// ⚠️ DESTRUCTIVE — back up your DB first.
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');
const { resolveDeptCodes, levelTagFromProgrammeCode } = require('../backend/utils/matricGenerator');

(async () => {
  try {
    console.log('\n=== Renumbering matric numbers ===\n');

    const students = await db.query(`
      SELECT s.id, s.matric_no, s.admission_year,
             d.id AS department_id, d.name AS department_name, d.code AS department_code,
             p.id AS programme_id,  p.code AS programme_code
        FROM students s
        JOIN departments d ON d.id = s.department_id
        JOIN programmes p  ON p.id = s.programme_id
       ORDER BY s.department_id, s.admission_year, s.id
    `);

    console.log(`Found ${students.rows.length} student(s).`);

    // Track serial per bucket
    const counters = new Map(); // `${school}/${dept}/${tag}/${yy}` -> next serial

    let updated = 0;

    for (const s of students.rows) {
      const { school, dept } = resolveDeptCodes({
        name: s.department_name,
        code: s.department_code,
      });
      const tag = levelTagFromProgrammeCode(s.programme_code);
      const yy  = String(s.admission_year || new Date().getFullYear()).slice(-2);
      const bucketKey = `${school}/${dept}/${tag}/${yy}`;

      let next = counters.get(bucketKey) || 1;
      counters.set(bucketKey, next + 1);

      const newMatric = `FPU/${bucketKey}/${String(next).padStart(3, '0')}`;

      if (newMatric === s.matric_no) {
        console.log(`  ↷ ${s.matric_no} (unchanged)`);
        continue;
      }

      await db.query(
        'UPDATE students SET matric_no = $1, updated_at = NOW() WHERE id = $2',
        [newMatric, s.id]
      );
      console.log(`  ✅ ${s.matric_no}  →  ${newMatric}`);
      updated++;
    }

    console.log(`\n🎉 Renumbered ${updated} student(s).`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();