// ============================================================
// Add Level 100 Computer Science courses
// Usage: node scripts/add-level100-courses.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

const COURSES = [
  // [code, title, units, semester]
  ['CSC101', 'Introduction to Computer Science',  3, 'First'],
  ['CSC103', 'Introduction to Programming',        3, 'First'],
  ['CSC105', 'Discrete Mathematics',               3, 'First'],
  ['CSC107', 'Computer Hardware Fundamentals',     2, 'First'],
  ['MTH101', 'Elementary Mathematics I',           3, 'First'],
  ['PHY101', 'General Physics I',                  3, 'First'],
  ['GST101', 'Use of English I',                   2, 'First'],
  ['GST103', 'Nigerian Peoples and Culture',       2, 'First'],
];

(async () => {
  try {
    // Find CS department + programme
    const d = await db.query(`SELECT id FROM departments WHERE code = 'CSC' LIMIT 1`);
    const p = await db.query(`SELECT id FROM programmes WHERE code = 'CSC-BSC' LIMIT 1`);

    if (!d.rows[0]) {
      console.error('❌ CSC department not found. Run npm run seed-db first.');
      process.exit(1);
    }
    if (!p.rows[0]) {
      console.error('❌ CSC-BSC programme not found. Run npm run seed-db first.');
      process.exit(1);
    }

    const deptId = d.rows[0].id;
    const progId = p.rows[0].id;

    console.log(`Using department_id=${deptId}, programme_id=${progId}`);

    let added = 0;
    for (const [code, title, units, sem] of COURSES) {
      const exists = await db.query('SELECT 1 FROM courses WHERE code = $1', [code]);
      if (exists.rows.length > 0) {
        console.log(`  → ${code} already exists, skipping`);
        continue;
      }
      await db.query(`
        INSERT INTO courses (code, title, units, department_id, programme_id, level, semester_name, is_active)
        VALUES ($1, $2, $3, $4, $5, 100, $6, TRUE)
      `, [code, title, units, deptId, progId, sem]);
      console.log(`  ✅ Added ${code} — ${title} (${units}u)`);
      added++;
    }

    console.log(`\n✅ Done. Added ${added} new courses.`);

    // Show all Level 100 courses
    const r = await db.query(`
      SELECT code, title, units, semester_name
        FROM courses
       WHERE level = 100 AND department_id = $1
       ORDER BY code
    `, [deptId]);
    console.table(r.rows);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await db.close();
    process.exit(0);
  }
})();