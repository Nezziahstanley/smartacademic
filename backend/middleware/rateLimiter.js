// ============================================================
// SMARTACADEMIC — Rate Limiters
// Protects sensitive endpoints (login, register, password reset)
// from brute force / abuse. Global limiter applies to all APIs.
// ============================================================

'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Global limiter — applies to all /api routes.
 * Uses env-configurable window and max.
 */
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT.windowMinutes * 60 * 1000, // minutes → ms
  max: env.RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

/**
 * Strict limiter — for auth endpoints (login, register, reset).
 * 10 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful logins
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes and try again.',
  },
});

/**
 * Very strict limiter — for password reset requests.
 * 5 attempts per hour per IP.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
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