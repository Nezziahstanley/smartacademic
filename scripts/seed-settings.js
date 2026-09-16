// ============================================================
// Seed all default system settings
// Usage: node scripts/seed-settings.js
// ============================================================

'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../backend/config/db');

const SETTINGS = [
  // General
  ['institution_name', 'SMARTACADEMIC University', 'general', 'Institution name'],
  ['institution_email', 'chosenmopol2003@gmail.com', 'general', 'Contact email'],
  ['institution_phone', '+234 704 114 5338', 'general', 'Contact phone'],
  ['institution_address', 'Lagos, Nigeria', 'general', 'Institution address'],
  ['timezone', 'Africa/Lagos', 'general', 'Default timezone'],

  // Academic
  ['max_credit_units', '24', 'academic', 'Max units per semester'],
  ['min_credit_units', '15', 'academic', 'Min units per semester'],
  ['registration_window_days', '14', 'academic', 'Registration window'],
  ['allow_late_registration', 'true', 'academic', 'Allow late registration'],

  // Grading
  ['grade_a_min', '70', 'grading', 'A grade minimum'],
  ['grade_b_min', '60', 'grading', 'B grade minimum'],
  ['grade_c_min', '50', 'grading', 'C grade minimum'],
  ['grade_d_min', '45', 'grading', 'D grade minimum'],
  ['grade_e_min', '40', 'grading', 'E grade minimum'],
  ['grade_point_scale', '5', 'grading', 'Grade point scale'],
  ['ca_weight', '30', 'grading', 'CA weight percentage'],
  ['exam_weight', '70', 'grading', 'Exam weight percentage'],

  // Attendance
  ['attendance_threshold', '75', 'attendance', 'Attendance threshold'],
  ['attendance_warning', '70', 'attendance', 'Attendance warning'],
  ['attendance_critical', '50', 'attendance', 'Attendance critical'],
  ['excused_as_present', 'false', 'attendance', 'Count excused as present'],

  // Risk
  ['risk_weight_attendance', '25', 'risk', 'Attendance weight'],
  ['risk_weight_ca', '20', 'risk', 'CA weight'],
  ['risk_weight_exam', '20', 'risk', 'Exam weight'],
  ['risk_weight_failed', '20', 'risk', 'Failed courses weight'],
  ['risk_weight_gpa_decline', '15', 'risk', 'GPA decline weight'],
  ['risk_yellow_min', '25', 'risk', 'Yellow minimum'],
  ['risk_orange_min', '50', 'risk', 'Orange minimum'],
  ['risk_red_min', '75', 'risk', 'Red minimum'],

  // Notifications
  ['email_notifications_enabled', 'true', 'notifications', 'Email notifications'],
  ['risk_alerts_enabled', 'true', 'notifications', 'Risk alerts'],
  ['attendance_alerts_enabled', 'true', 'notifications', 'Attendance alerts'],
  ['auto_interventions_enabled', 'true', 'notifications', 'Auto interventions'],
  ['notification_retention_days', '90', 'notifications', 'Retention days'],

  // Advanced
  ['system_name', 'SMARTACADEMIC', 'advanced', 'System name'],
  ['support_email', 'chosenmopol2003@gmail.com', 'advanced', 'Support email'],
  ['self_registration_enabled', 'true', 'advanced', 'Self registration'],
  ['require_approval_on_register', 'true', 'advanced', 'Require approval'],
  ['session_timeout_minutes', '60', 'advanced', 'Session timeout'],
  ['jwt_expiry_hours', '24', 'advanced', 'JWT expiry'],
  ['maintenance_mode', 'false', 'advanced', 'Maintenance mode'],
  ['maintenance_message', "We'll be back soon. Please check back later.", 'advanced', 'Maintenance message'],
];

(async () => {
  try {
    let added = 0, updated = 0;
    for (const [key, value, category, description] of SETTINGS) {
      const exists = await db.query('SELECT 1 FROM settings WHERE key = $1', [key]);
      if (exists.rows.length === 0) {
        await db.query(
          `INSERT INTO settings (key, value, category, description) VALUES ($1, $2, $3, $4)`,
          [key, value, category, description]
        );
        added++;
      } else {
        await db.query(
          `UPDATE settings SET category = $2, description = $3 WHERE key = $1`,
          [key, category, description]
        );
        updated++;
      }
    }
    console.log(`✅ Settings: ${added} added, ${updated} updated`);

    const r = await db.query('SELECT key, value, category FROM settings ORDER BY category, key');
    console.log(`\nTotal settings: ${r.rows.length}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await db.close();
    process.exit(0);
  }
})();