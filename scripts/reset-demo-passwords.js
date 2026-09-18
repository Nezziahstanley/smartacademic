// ============================================================
// Reset all demo user passwords to their known values
// Usage: node scripts/reset-demo-passwords.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');

const USERS = [
  { email: 'admin@smartacademic.edu',         pw: 'Admin@123' },
  { email: 'hod.csc@smartacademic.edu',       pw: 'Hod@123' },
  { email: 'lecturer.csc1@smartacademic.edu', pw: 'Lect@123' },
  { email: 'student.a@smartacademic.edu',     pw: 'Student@123' },
  { email: 'student.b@smartacademic.edu',     pw: 'Student@123' },
  { email: 'student.c@smartacademic.edu',     pw: 'Student@123' },
  { email: 'student.d@smartacademic.edu',     pw: 'Student@123' },
];

(async () => {
  try {
    console.log('\n=== Reset Demo Passwords ===\n');

    let resetCount = 0;

    for (const u of USERS) {
      const hash = await bcrypt.hash(u.pw, 10);

      const r = await db.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
        [hash, u.email]
      );

      if (r.rowCount > 0) {
        console.log('✅ Reset:', u.email, '→', u.pw);
        resetCount++;
      } else {
        console.log('⚠️  Not found:', u.email);
      }
    }

    console.log(`\n🎉 Reset ${resetCount} password(s).\n`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
  } finally {
    await db.close();
    process.exit(0);
  }
})();