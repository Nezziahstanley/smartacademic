// ============================================================
// SMARTACADEMIC — Notification Dispatcher
// Sends a message across email + SMS + in-app, and logs every
// attempt to the notification_log table.
// ============================================================

'use strict';

const db = require('../config/db');
const emailService = require('./emailService');
const smsService = require('./smsService');

/**
 * Dispatch a notification across all requested channels.
 *
 * @param {object} opts
 * @param {number} opts.userId          Optional — links the log entry
 * @param {string} opts.email           Recipient email
 * @param {string} opts.phone           Recipient phone (may be null → SMS skipped)
 * @param {string} opts.subject         Email subject
 * @param {string} opts.emailHtml       HTML body for the email
 * @param {string} opts.smsText         SMS body (usually shorter)
 * @param {string} opts.inAppTitle      In-app notification title
 * @param {string} opts.inAppMessage    In-app notification body
 * @param {string} opts.inAppType       'system' | 'result' | 'intervention' | etc.
 * @returns {Promise<{ email: object, sms: object, inApp: object }>}
 */
async function notify({
  userId = null,
  email = null,
  phone = null,
  subject = null,
  emailHtml = null,
  smsText = null,
  inAppTitle = null,
  inAppMessage = null,
  inAppType = 'system',
}) {
  const result = { email: null, sms: null, inApp: null };

  // ---- Email ----
  if (email && emailHtml) {
    try {
      await emailService.send({ to: email, subject, html: emailHtml });
      result.email = { ok: true };
      await log({ userId, channel: 'email', recipient: email, subject, status: 'sent' });
    } catch (err) {
      console.error('[dispatch] Email failed:', err.message);
      result.email = { ok: false, error: err.message };
      await log({ userId, channel: 'email', recipient: email, subject, status: 'failed', error: err.message });
    }
  } else if (email) {
    result.email = { ok: false, skipped: true, error: 'No HTML body' };
    await log({ userId, channel: 'email', recipient: email, subject, status: 'skipped', error: 'No HTML body' });
  }

  // ---- SMS ----
  if (phone && smsText) {
    const r = await smsService.sendSMS({ to: phone, message: smsText });
    result.sms = r;
    await log({
      userId, channel: 'sms', recipient: phone, subject: null,
      status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
      error: r.error || null,
    });
  } else {
    result.sms = { ok: false, skipped: true, error: phone ? 'No SMS body' : 'No phone number' };
    // Only log skip if we have a user — otherwise it's noise
    if (userId) {
      await log({
        userId, channel: 'sms', recipient: phone || '(none)', subject: null,
        status: 'skipped', error: result.sms.error,
      });
    }
  }

  // ---- In-app ----
  if (userId && inAppTitle && inAppMessage) {
    try {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, $2, $3, $4)
      `, [userId, inAppTitle, inAppMessage, inAppType]);
      result.inApp = { ok: true };
      await log({
        userId, channel: 'inapp', recipient: `user:${userId}`,
        subject: inAppTitle, status: 'sent',
      });
    } catch (err) {
      console.error('[dispatch] In-app failed:', err.message);
      result.inApp = { ok: false, error: err.message };
      await log({
        userId, channel: 'inapp', recipient: `user:${userId}`,
        subject: inAppTitle, status: 'failed', error: err.message,
      });
    }
  }

  return result;
}

/**
 * Write a row to notification_log. Never throws.
 */
async function log({ userId, channel, recipient, subject, status, error }) {
  try {
    await db.query(`
      INSERT INTO notification_log (user_id, channel, recipient, subject, status, error)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, channel, recipient, subject, status, error]);
  } catch (err) {
    console.error('[dispatch] Log write failed:', err.message);
  }
}

module.exports = { notify };