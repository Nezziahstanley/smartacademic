// ============================================================
// Reset the admin login to a known password.
// Usage: node scripts/reset-admin.js
//   or:  node scripts/reset-admin.js newemail@x.com NewPassword123
// ============================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');

const DEFAULT_EMAIL = 'admin@smartacademic.edu';
const DEFAULT_PASSWORD = 'Admin@123';

(async () => {
  const email    = (process.argv[2] || DEFAULT_EMAIL).toLowerCase().trim();
  const password = process.argv[3] || DEFAULT_PASSWORD;

  console.log('\n=== Reset Admin Login ===\n');

  try {
    // Find any admin user, or the specific email if given
    let user;
    if (process.argv[2]) {
      const r = await db.query(
        `SELECT u.id, u.email, r.name AS role_name
           FROM users u JOIN roles r ON r.id = u.role_id
          WHERE LOWER(u.email) = LOWER($1)`,
        [email]
      );
      user = r.rows[0];
    } else {
      const r = await db.query(
        `SELECT u.id, u.email, r.name AS role_name
           FROM users u JOIN roles r ON r.id = u.role_id
          WHERE r.name = 'admin'
          ORDER BY u.id
          LIMIT 1`
      );
      user = r.rows[0];
    }

    if (!user) {
      console.error(`❌ No admin user found for email: ${email}`);
      console.log('   Existing admins:');
      const all = await db.query(
        `SELECT u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin'`
      );
      all.rows.forEach(x => console.log('   -', x.email));
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);

    await db.query(
      `UPDATE users
          SET password_hash  = $1,
              is_active      = TRUE,
              must_change_pw = FALSE,
              updated_at     = NOW()
        WHERE id = $2`,
      [hash, user.id]
    );

    console.log('✅ Admin credentials reset:');
    console.log('   Email    :', user.email);
    console.log('   Password :', password);
    console.log('   Role     :', user.role_name);
    console.log('\n   Log in at /login.html\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  } finally {
    await db.close();
  }
})();