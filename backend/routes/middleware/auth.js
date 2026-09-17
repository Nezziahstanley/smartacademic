// ============================================================
// SMARTACADEMIC — Authentication Middleware
// Verifies JWT from Authorization header (Bearer <token>),
// attaches req.user, and provides requireAuth / optionalAuth.
// ============================================================

'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('./errorHandler');
const db = require('../config/db');

/**
 * Extract a Bearer token from the Authorization header.
 */
function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Sign a JWT for a user.
 * Payload: { id, email, role }
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role_name || user.role,
    },
    env.JWT.secret,
    { expiresIn: env.JWT.expiresIn }
  );
}

/**
 * Verify a JWT and return its payload, or throw.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token expired. Please log in again.', 401);
    }
    throw new AppError('Invalid token.', 401);
  }
}

/**
 * Load the full user record from the DB.
 * Ensures the user still exists and is active.
 */
async function loadUser(userId) {
  const result = await db.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
            u.role_id, r.name AS role_name, u.photo_url
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    throw new AppError('User not found.', 401);
  }
  const user = result.rows[0];
  if (!user.is_active) {
    throw new AppError('Account is deactivated.', 403);
  }
  return user;
}

/**
 * requireAuth — protects a route. Attaches req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required.', 401);
    }
    const payload = verifyToken(token);
    const user = await loadUser(payload.id);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * optionalAuth — attaches req.user if a token is present,
 * otherwise continues without error. Useful for public routes
 * that show extra data when logged in.
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifyToken(token);
    req.user = await loadUser(payload.id);
    next();
  } catch {
    // Ignore invalid tokens on optional routes
    next();
  }
}

module.exports = {
  signToken,
  verifyToken,
  extractToken,
  requireAuth,
  optionalAuth,
};