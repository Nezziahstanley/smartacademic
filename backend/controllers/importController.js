// ============================================================
// SMARTACADEMIC — Bulk Import Controller
// Import students from CSV file.
// ============================================================

'use strict';

const { parse } = require('csv-parse/sync');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const env = require('../config/env');
const db = require('../config/db');
const adminModel = require('../models/adminModel');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');

/**
 * POST /api/admin/students/import
 * Body: { csv: "<base64 or raw CSV string>" }
 * Header row required: full_name,email,matric_no,department_code,programme_code,level,admission_year
 */
async function importStudents(req, res, next) {
  try {
    const { csv } = req.body;
    if (!csv) throw new AppError('No CSV data provided.', 400);

    // Parse CSV
    let rows;
    try {
      rows = parse(csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err) {
      throw new AppError('Invalid CSV format: ' + err.message, 400);
    }

    if (!rows.length) throw new AppError('CSV has no data rows.', 400);

    // Look up department + programme IDs by code
    const depts = await db.query('SELECT id, code FROM departments');
    const progs = await db.query('SELECT id, code FROM programmes');
    const deptMap = Object.fromEntries(depts.rows.map(r => [r.code.toUpperCase(), r.id]));
    const progMap = Object.fromEntries(progs.rows.map(r => [r.code.toUpperCase(), r.id]));
    const roleRow = await db.query("SELECT id FROM roles WHERE name = 'student'");
    const roleId = roleRow.rows[0].id;

    const results = {
      imported: 0,
      skipped: 0,
      errors: [],
      created: [], // for email invites
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 2; // +2 because header + 1-indexing

      try {
        // Validate required fields
        const required = ['full_name', 'email', 'matric_no', 'department_code', 'programme_code', 'level'];
        const missing = required.filter(k => !row[k]);
        if (missing.length) {
          results.errors.push({ line, error: `Missing: ${missing.join(', ')}` });
          results.skipped++;
          continue;
        }

        // Validate department + programme
        const deptId = deptMap[String(row.department_code).toUpperCase()];
        const progId = progMap[String(row.programme_code).toUpperCase()];
        if (!deptId) {
          results.errors.push({ line, error: `Unknown department_code: ${row.department_code}` });
          results.skipped++;
          continue;
        }
        if (!progId) {
          results.errors.push({ line, error: `Unknown programme_code: ${row.programme_code}` });
          results.skipped++;
          continue;
        }

        // Check email uniqueness
        const existing = await db.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [row.email]);
        if (existing.rows.length > 0) {
          results.errors.push({ line, error: `Email already exists: ${row.email}` });
          results.skipped++;
          continue;
        }

        // Check matric uniqueness
        const existingMatric = await db.query('SELECT 1 FROM students WHERE matric_no = $1', [row.matric_no]);
        if (existingMatric.rows.length > 0) {
          results.errors.push({ line, error: `Matric already exists: ${row.matric_no}` });
          results.skipped++;
          continue;
        }

        // Generate temp password
        const tempPassword = row.temp_password || 'Welcome@' + crypto.randomBytes(3).toString('hex');
        const password_hash = await bcrypt.hash(tempPassword, env.BCRYPT_ROUNDS);

        // Insert user + student in transaction
        const client = await db.pool.connect();
        try {
          await client.query('BEGIN');

          const u = await client.query(`
            INSERT INTO users (full_name, email, phone, password_hash, role_id, must_change_pw)
            VALUES ($1, $2, $3, $4, $5, TRUE)
            RETURNING id
          `, [row.full_name, row.email.toLowerCase(), row.phone || null, password_hash, roleId]);

          await client.query(`
            INSERT INTO students (user_id, matric_no, department_id, programme_id, level, admission_year)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [u.rows[0].id, row.matric_no, deptId, progId, parseInt(row.level, 10), parseInt(row.admission_year || new Date().getFullYear(), 10)]);

          await client.query('COMMIT');

          results.imported++;
          results.created.push({
            full_name: row.full_name,
            email: row.email,
            matric_no: row.matric_no,
            temp_password: tempPassword,
          });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        results.errors.push({ line, error: err.message });
        results.skipped++;
      }
    }

    // Audit
    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'bulk_import_students',
      module: 'students',
      details: { imported: results.imported, skipped: results.skipped },
      ip_address: req.ip,
    });

    // Optionally email each student their credentials
    if (req.body.send_emails !== false) {
      for (const s of results.created) {
        try {
          await emailService.send({
            to: s.email,
            subject: 'Welcome to SMARTACADEMIC — Your login details',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
                <div style="background:#4f46e5;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                  <h1 style="color:#fff;margin:0;">SMARTACADEMIC</h1>
                </div>
                <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
                  <p>Hi <strong>${s.full_name}</strong>,</p>
                  <p>Your SMARTACADEMIC student account has been created. Use these credentials to log in:</p>
                  <p style="background:#f8fafc;padding:14px;border-radius:8px;font-family:monospace;">
                    <strong>Email:</strong> ${s.email}<br>
                    <strong>Password:</strong> ${s.temp_password}
                  </p>
                  <p style="color:#64748b;font-size:13px;">You must change your password on first login.</p>
                  <p style="margin-top:20px;"><a href="${process.env.CLIENT_URL}/login.html" style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Log in now</a></p>
                </div>
              </div>`,
          });
        } catch (err) {
          console.error('[import] Failed to email', s.email, err.message);
        }
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.imported} students, ${results.skipped} skipped.`,
      data: results,
    });
  } catch (err) { next(err); }
}

/**
 * GET /api/admin/students/import/template
 * Downloads a CSV template.
 */
async function downloadTemplate(req, res) {
  const csv = [
    'full_name,email,phone,matric_no,department_code,programme_code,level,admission_year',
    'Jane Doe,jane.doe@example.edu,+2348000000001,2021/CSC/001,CSC,CSC-BSC,300,2021',
    'John Smith,john.smith@example.edu,+2348000000002,2021/CSC/002,CSC,CSC-BSC,300,2021',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="smartacademic-students-template.csv"');
  res.send(csv);
}

module.exports = { importStudents, downloadTemplate };