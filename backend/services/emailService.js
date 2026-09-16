// ============================================================
// SMARTACADEMIC — Email Service (Nodemailer)
// Sends OTP codes, notifications, and intervention alerts.
// ============================================================

'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  connectionTimeout: 10000, // 10s timeout
  greetingTimeout: 5000,
  socketTimeout: 15000,
});

transporter.verify((error) => {
  if (error) {
    console.warn('[email] SMTP connection failed:', error.message);
  } else {
    console.log('[email] ✅ SMTP server ready');
  }
});

async function send({ to, subject, text, html }) {
  const info = await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'SMARTACADEMIC'}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: text || '',
    html: html || `<p>${text}</p>`,
  });
  console.log('[email] Sent:', info.messageId);
  return info;
}

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

module.exports = { send, sendOTP, sendRiskAlert };