// Auto-audit mutating requests (POST/PUT/PATCH/DELETE).
'use strict';
const db = require('../config/db');

function audit(action, module, recordFn) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      // Log after response is prepared but before sending
      if (res.statusCode < 400 && req.user) {
        try {
          const record = typeof recordFn === 'function' ? recordFn(req, body) : null;
          await db.query(`
            INSERT INTO audit_logs (user_id, action, module, affected_record, details, ip_address)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [req.user.id, action, module, record, JSON.stringify(req.body).slice(0, 1000), req.ip]);
        } catch (e) { console.error('[audit]', e.message); }
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { audit };