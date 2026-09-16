// ============================================================
// SMARTACADEMIC — Express Server Entry Point
// Boots the API, wires middleware, serves the frontend,
// and gracefully shuts down on SIGINT/SIGTERM.
// ============================================================

'use strict';

const path        = require('path');
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');

const env         = require('./backend/config/env');
const db          = require('./backend/config/db');
const apiRoutes   = require('./backend/routes');
const {
  notFoundHandler,
  errorHandler,
} = require('./backend/middleware/errorHandler');
const { globalLimiter } = require('./backend/middleware/rateLimiter');

const app = express();

// ============================================================
// 1. SECURITY MIDDLEWARE
//    Content Security Policy configured to allow:
//      - Chart.js from CDN (jsdelivr)
//      - Google Fonts
//      - Data URLs (uploaded photos)
//      - Blob URLs (video playback)
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc:     ["'self'", "data:", "blob:", "https:"],
      mediaSrc:   ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
      baseUri:    ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: env.CLIENT_URL || true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));         // increase for base64 photos
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// 2. LOGGING
// ============================================================
if (env.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================================
// 3. RATE LIMITING (API only)
// ============================================================
app.use('/api', globalLimiter);

// ============================================================
// 4. API ROUTES → /api/*
// ============================================================
app.use('/api', apiRoutes);

// ============================================================
// 5. STATIC FRONTEND
// ============================================================
const frontendRoot = path.join(__dirname, 'frontend');

// Public site
app.use('/', express.static(path.join(frontendRoot, 'public')));

// Dashboard folders
app.use('/admin',    express.static(path.join(frontendRoot, 'admin')));
app.use('/hod',      express.static(path.join(frontendRoot, 'hod')));
app.use('/lecturer', express.static(path.join(frontendRoot, 'lecturer')));
app.use('/student',  express.static(path.join(frontendRoot, 'student')));

// Shared assets
app.use('/css',        express.static(path.join(frontendRoot, 'css')));
app.use('/js',         express.static(path.join(frontendRoot, 'js')));
app.use('/components', express.static(path.join(frontendRoot, 'components')));
app.use('/assets',     express.static(path.join(frontendRoot, 'public/assets')));

// ============================================================
// 6. 404 + ERROR HANDLERS (must be last)
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// 7. START SERVER
// ============================================================
const PORT = env.PORT;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  SMARTACADEMIC API');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Environment : ${env.NODE_ENV}`);
  console.log(`  URL         : http://localhost:${PORT}`);
  console.log(`  Health      : http://localhost:${PORT}/api/health`);
  console.log(`  Frontend    : http://localhost:${PORT}/`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
});

// ============================================================
// 8. GRACEFUL SHUTDOWN
// ============================================================
function shutdown(signal) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[server] HTTP server closed.');
    try {
      await db.close();
      console.log('[server] DB pool closed.');
    } catch (err) {
      console.error('[server] Error closing DB:', err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[server] Forcing exit after 10s.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err);
  shutdown('uncaughtException');
});

module.exports = app;