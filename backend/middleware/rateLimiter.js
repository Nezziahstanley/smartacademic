// ============================================================
// SMARTACADEMIC — Rate Limiters
// Protects sensitive endpoints from brute force / abuse.
// /api/auth/me is exempt because it's called on every page load.
// ============================================================

'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Global limiter — applies to all /api routes.
 * Skips GET /api/auth/me so that dashboard reloads don't trip the limit.
 */
const globalLimiter = rateLimit({
  windowMs: (env.RATE_LIMIT.windowMinutes || 15) * 60 * 1000,
  max: env.RATE_LIMIT.max || 1000, // bumped from 100 to be safe in demo
  standardHeaders: true,
  legacyHeaders: false,
  // Skip the following paths from being rate-limited
  skip: (req) => {
    // /api/auth/me is used by topbar on every page load → exempt
    if (req.method === 'GET' && req.path === '/auth/me') return true;
    // Static-ish endpoints
    if (req.method === 'GET' && req.path === '/health') return true;
    return false;
  },
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

/**
 * Strict limiter — for auth endpoints (login, register, reset).
 * 20 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes and try again.',
  },
});

/**
 * Very strict limiter — for password reset requests.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password reset requests. Please try again in an hour.',
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
  passwordResetLimiter,
};