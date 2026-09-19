// ============================================================
// SMARTACADEMIC — SMS Service (Termii)
// Sends SMS via Termii. Falls back to console logging in dev
// or when TERMII_API_KEY is not set.
// ============================================================

'use strict';

const env = require('../config/env');

const TERMII_KEY      = process.env.TERMII_API_KEY || '';
const TERMII_SENDER   = process.env.TERMII_SENDER_ID || 'SMARTACADEMIC';
const TERMII_CHANNEL  = process.env.TERMII_CHANNEL || 'generic';
const TERMII_BASE_URL = 'https://api.ng.termii.com/api';

const enabled = !!TERMII_KEY;

if (!enabled) {
  console.warn('[sms] TERMII_API_KEY not set — SMS will be logged to console only');
}

/**
 * Send an SMS. Never throws — returns { ok, skipped?, error? }.
 *
 * @param {object} opts
 * @param {string} opts.to       E.164 phone, e.g. +2348000000001
 * @param {string} opts.message  Body text
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function sendSMS({ to, message }) {
  if (!to) {
    return { ok: false, skipped: true, error: 'No phone number' };
  }
  if (!message) {
    return { ok: false, skipped: true, error: 'No message' };
  }

  // Normalize phone to +234... if it starts with 0
  const normalized = normalizePhone(to);
  if (!normalized) {
    return { ok: false, skipped: true, error: `Invalid phone: ${to}` };
  }

  // Dev mode / missing key — just log
  if (!enabled) {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  SMS (dev mode — not actually sent)');
    console.log('  To      :', normalized);
    console.log('  Message :', message);
    console.log('═══════════════════════════════════════════════');
    console.log('');
    return { ok: true, skipped: false };
  }

  // Termii
  try {
    const body = {
      to: normalized,
      from: TERMII_SENDER,
      sms: message,
      type: 'plain',
      channel: TERMII_CHANNEL,
      api_key: TERMII_KEY,
    };

    const res = await fetch(`${TERMII_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = data?.message || `HTTP ${res.status}`;
      console.error('[sms] Termii send failed:', errMsg);
      return { ok: false, error: errMsg };
    }

    console.log('[sms] Sent to', normalized, '· messageId:', data?.message_id || 'n/a');
    return { ok: true };
  } catch (err) {
    console.error('[sms] Network error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Convert a Nigerian phone number into E.164 (+234...).
 * Accepts:
 *   08012345678    → +2348012345678
 *   2348012345678  → +2348012345678
 *   +2348012345678 → +2348012345678 (unchanged)
 */
function normalizePhone(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/[^\d+]/g, '');

  if (s.startsWith('+234') && s.length >= 13) return s;
  if (s.startsWith('234')  && s.length >= 12) return '+' + s;
  if (s.startsWith('0')    && s.length >= 11) return '+234' + s.slice(1);

  // Nigerian mobile without leading 0 — e.g. "7041145338" or "8041234567"
  if (/^[789]\d{9}$/.test(s)) return '+234' + s;

  return null;
}

module.exports = {
  sendSMS,
  normalizePhone,
  isEnabled: () => enabled,
};