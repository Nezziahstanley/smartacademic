// ============================================================
// Check if the lecturer password matches
// Usage: node scripts/check-lecturer-password.js
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');

(async () => {
  try {
    const email = 'lecturer.csc1@smartacademic.edu';

    const r = await db.query(
      'SELECT id, email, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );

    if (!r.rows[0]) {
      console.log('❌ User not found:', email);
      process.exit(0);
    }

    console.log('User found:');
    console.log('  id:       ', r.rows[0].id);
    console.log('  email:    ', r.rows[0].email);
    console.log('  is_active:', r.rows[0].is_active);

    const match = await bcrypt.compare('Lect@123', r.rows[0].password_hash);
    console.log('  password "Lect@123" matches:', match);

    if (!match) {
      console.log('\n⚠️  Password does NOT match. Run the reset script next.');
    } else {
      console.log('\n✅ Password is correct.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await db.close();
    process.exit(0);
  }
})();