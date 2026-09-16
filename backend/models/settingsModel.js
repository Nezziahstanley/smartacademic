'use strict';
const db = require('../config/db');

async function listAll() {
  const r = await db.query('SELECT key, value, category, description, updated_at FROM settings ORDER BY category, key');
  return r.rows;
}

async function update(key, value, userId) {
  await db.query(`
    UPDATE settings SET value = $2, updated_by = $3, updated_at = NOW() WHERE key = $1
  `, [key, String(value), userId]);
}

async function upsert({ key, value, category = 'general', description = null }, userId) {
  await db.query(`
    INSERT INTO settings (key, value, category, description, updated_by)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           category = EXCLUDED.category,
           description = EXCLUDED.description,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
  `, [key, String(value), category, description, userId]);
}

async function remove(key) {
  await db.query('DELETE FROM settings WHERE key = $1', [key]);
}

module.exports = { listAll, update, upsert, remove };