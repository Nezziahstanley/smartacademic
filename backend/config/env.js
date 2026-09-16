// ============================================================
// SMARTACADEMIC — Environment Loader
// Loads .env once and exports a typed, validated config object.
// ============================================================

'use strict';

const path = require('path');
const dotenv = require('dotenv');

// Load .env from the project root (one level above /backend)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Helper: read a required env var and fail fast if missing.
 */
function required(name) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Helper: read optional env var with a fallback.
 */
function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

/**
 * Helper: read env var as integer.
 */
function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`[env] Environment variable ${name} must be an integer`);
  }
  return n;
}

const env = {
  // ---------- App ----------
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: int('PORT', 5000),
  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:5000'),

  // ---------- Database ----------
  DB: {
    host: required('DB_HOST'),
    port: int('DB_PORT', 5432),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    name: required('DB_NAME'),
  },

  // ---------- JWT ----------
  JWT: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '1d'),
  },

  // ---------- Security ----------
  BCRYPT_ROUNDS: int('BCRYPT_ROUNDS', 10),
  RATE_LIMIT: {
    windowMinutes: int('RATE_LIMIT_WINDOW', 15),
    max: int('RATE_LIMIT_MAX', 100),
  },
};

// Convenience flag
env.isProduction = env.NODE_ENV === 'production';
env.isDevelopment = env.NODE_ENV === 'development';

// Fail fast in production if JWT secret is still the default
if (env.isProduction && env.JWT.secret === 'change_this_to_a_long_random_string') {
  throw new Error('[env] Refusing to start in production with default JWT_SECRET');
}

module.exports = env;