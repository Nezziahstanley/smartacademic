// ============================================================
// SMARTACADEMIC — Global Error Handler
// Converts thrown errors into consistent JSON responses.
// In production, stack traces are hidden.
// ============================================================

'use strict';

const env = require('../config/env');

/**
 * Custom application error with HTTP status.
 * Usage: throw new AppError('User not found', 404);
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * Wrap async route handlers so thrown errors reach Express.
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * 404 handler — runs when no route matched.
 */
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Final error handler — must have 4 args for Express.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let message    = err.message || 'Internal Server Error';
  let details    = err.details || null;

  // Handle PostgreSQL unique violation
  if (err.code === '23505') {
    statusCode = 409;
    message = 'A record with that value already exists';
    details = err.detail;
  }
  // Foreign key violation
  else if (err.code === '23503') {
    statusCode = 400;
    message = 'Related record not found';
    details = err.detail;
  }
  // Not null violation
  else if (err.code === '23502') {
    statusCode = 400;
    message = `Missing required field: ${err.column}`;
  }
  // Invalid input syntax (bad cast)
  else if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid input format';
  }

  // Log in dev
  if (env.isDevelopment) {
    console.error('[error]', {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      message,
      stack: err.stack,
    });
  } else {
    console.error('[error]', statusCode, message);
  }

  const body = {
    success: false,
    error: message,
  };
  if (details) body.details = details;
  if (env.isDevelopment && err.stack) body.stack = err.stack.split('\n');

  res.status(statusCode).json(body);
}

module.exports = {
  AppError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};