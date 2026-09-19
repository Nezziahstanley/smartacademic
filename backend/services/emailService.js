// ============================================================
// SMARTACADEMIC — Email Service
// Tries SMTP first (Gmail by default), then falls back to
// Resend's HTTPS API when SMTP is blocked or unavailable.
// ============================================================

'use strict';

const nodemailer = require('nodemailer');

/* ============================================================
   CONFIG
   ============================================================ */
const SMTP_USER = process.env.EMAIL_USER || '';
const SMTP_PASS = process.env.EMAIL_PASSWORD || '';
const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const SMTP_SECURE = process.env.EMAIL_SECURE === 'true'; // true only for port 465
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'SMARTACADEMIC';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || `SMARTACADEMIC <onboarding@resend.dev>`;

const useSmtp = !!(SMTP_USER && SMTP_PASS);

/* ============================================================
   SMTP TRANSPORTER (optional)
   ============================================================ */
const transporter = useSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      requireTLS: !SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      // Fail fast — we don't want to hang for 10s on a blocked port
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    })
  : null;

if (useSmtp) {
  transporter.verify((error) => {
    if (error) {
      console.warn('[email] SMTP unavailable, will fall back to Resend if configured:', error.message);
    } else {
      console.log('[email] ✅ SMTP server ready');
    }
  });
} else {
  console.warn('[email] EMAIL_USER / EMAIL_PASSWORD not set — SMTP disabled');
}

if (!RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY not set — Resend fallback disabled');
}

/* ============================================================
   CORE SEND
   ============================================================ */
/**
 * Send an email. Tries SMTP first, then Resend.
 * Throws if both fail.
 *
 * @param {object} opts
 * @param {string} opts.to       Recipient email
 * @param {string} opts.subject  Subject line
 * @param {string} [opts.text]   Plain-text body
 * @param {string} [opts.html]   HTML body
 * @returns {Promise<object>}    Provider response
 */
async function send({ to, subject, text, html }) {
  if (!to) throw new Error('No recipient email provided');
  if (!subject) throw new Error('No subject provided');

  const errors = [];

  // ---- 1. SMTP ----
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${SMTP_USER}>`,
        to,
        subject,
        text: text || '',
        html: html || `<p>${text || ''}</p>`,
      });
      console.log('[email] Sent via SMTP:', info.messageId);
      return { provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.warn('[email] SMTP failed:', err.message);
      errors.push(`smtp: ${err.message}`);
      // fall through to Resend
    }
  }

  // ---- 2. Resend (HTTPS) ----
  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [to],
          subject,
          text: text || undefined,
          html: html || `<p>${text || ''}</p>`,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || data?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      console.log('[email] Sent via Resend:', data?.id || 'ok');
      return { provider: 'resend', messageId: data?.id || 'ok' };
    } catch (err) {
      console.warn('[email] Resend failed:', err.message);
      errors.push(`resend: ${err.message}`);
    }
  }

  // Both failed
  throw new Error(`All email providers failed. Errors: ${errors.join(' | ') || 'none configured'}`);
}

/* ============================================================
   CONVENIENCE SENDERS
   ============================================================ */

/**
 * Send a one-time password.
 */
async function sendOTP(to, code, purpose = 'verification') {
  const subject = `SMARTACADEMIC — Your ${purpose} code`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#f8fafc;">
      <div style="background:#4f46e5;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">SMARTACADEMIC</h1>
      </div>
      <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
        <p style="color:#334155;font-size:15px;">Your ${purpose} code is:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#4f46e5;">${code}</span>
        </div>
        <p style="color:#64748b;font-size:13px;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#64748b;font-size:13px;">If you didn't request this, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
        <p style="color:#94a3b8;font-size:12px;text-align:center;">
          SMARTACADEMIC — Academic Early-Warning System<br>
          Contact: chosenmopol2003@gmail.com
        </p>
      </div>
    </div>`;
  return send({ to, subject, text: `Your ${purpose} code is: ${code}`, html });
}

/**
 * Send a risk alert to a lecturer/HOD/admin.
 */
async function sendRiskAlert(to, studentName, category, score) {
  const colors = { GREEN: '#10b981', YELLOW: '#f59e0b', ORANGE: '#f97316', RED: '#ef4444' };
  const color = colors[category] || '#64748b';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#f8fafc;">
      <div style="background:${color};padding:20px;border-radius:12px 12px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:18px;">⚠️ Risk Alert — ${category}</h2>
      </div>
      <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
        <p style="color:#334155;"><strong>${studentName}</strong> has been classified as <strong style="color:${color};">${category}</strong> with a risk score of <strong>${score}</strong>.</p>
        <p style="color:#64748b;font-size:13px;">Log in to SMARTACADEMIC to view details and create an intervention.</p>
      </div>
    </div>`;
  return send({ to, subject: `Risk Alert: ${studentName} is ${category}`, html });
}

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = { send, sendOTP, sendRiskAlert };