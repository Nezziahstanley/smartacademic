// ============================================================
// Fix student's level/department so courses match
// Usage: node scripts/fix-student-for-courses.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

(async () => {
  try {
    // 1. Find CS department + programme
    const d = await db.query(`SELECT id, name, code FROM departments WHERE code = 'CSC' LIMIT 1`);
    const p = await db.query(`SELECT id, name, code FROM programmes WHERE code = 'CSC-BSC' LIMIT 1`);

    if (!d.rows[0]) { console.error('❌ CSC department missing. Run: npm run seed-db'); process.exit(1); }
    if (!p.rows[0]) { console.error('❌ CSC-BSC programme missing. Run: npm run seed-db'); process.exit(1); }

    const deptId = d.rows[0].id;
    const progId = p.rows[0].id;

    // 2. Find courses at Level 300 in CS
    const c = await db.query(`
      SELECT id, code, level FROM courses
       WHERE department_id = $1 AND level = 300
       ORDER BY code LIMIT 1
    `, [deptId]);

    if (!c.rows[0]) {
      console.error('❌ No Level 300 CS courses. Run: node scripts/add-level100-courses.js');
      process.exit(1);
    }

    const targetLevel = 300; // match the existing CSC3xx courses

    // 3. Update ALL students to CSC / B.Sc. CS / Level 300
    const r = await db.query(`
      UPDATE students
         SET department_id = $1,
             programme_id  = $2,
             level         = $3
       WHERE matric_no LIKE '%CS%' OR matric_no LIKE '%CSC%'
       RETURNING id, matric_no, level, department_id, programme_id
    `, [deptId, progId, targetLevel]);

    console.log('\n✅ Updated students:');
    console.table(r.rows);

    // 4. Show what they'll see now
    console.log('\n📚 Courses available at Level', targetLevel, ':');
    const available = await db.query(`
      SELECT code, title, units, level
        FROM courses
       WHERE department_id = $1 AND level = $2 AND is_active = TRUE
       ORDER BY code
    `, [deptId, targetLevel]);
    console.table(available.rows);

    console.log('\n🎉 Done! Refresh the My Courses page and click "+ Register Course".');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await db.close();
    process.exit(0);
  }
})();