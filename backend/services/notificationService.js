// ============================================================
// SMARTACADEMIC — Notification Service
// Central API for creating notifications anywhere in the app.
// ============================================================

'use strict';

const db = require('../config/db');

async function create({ userId, title, message, type = 'system', relatedId = null }) {
  const r = await db.query(`
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [userId, title, message, type, relatedId]);
  return r.rows[0];
}

async function createMany(userIds, payload) {
  let count = 0;
  for (const uid of userIds) {
    await create({ ...payload, userId: uid });
    count++;
  }
  return { count };
}

async function broadcastToRoles(roles, { title, message, type = 'announcement' }) {
  const r = await db.query(`
    INSERT INTO notifications (user_id, title, message, type)
    SELECT u.id, $1, $2, $3
      FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = TRUE AND r.name = ANY($4)
    RETURNING id
  `, [title, message, type, roles]);
  return { count: r.rowCount };
}

module.exports = { create, createMany, broadcastToRoles };