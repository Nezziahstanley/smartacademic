'use strict';
const db = require('../config/db');

async function list(req, res, next) {
  try {
    const { module: mod, user_id, search, page = 1, limit = 50 } = req.query;
    const params = []; const where = [];
    if (mod) { params.push(mod); where.push(`al.module = $${params.length}`); }
    if (user_id) { params.push(parseInt(user_id, 10)); where.push(`al.user_id = $${params.length}`); }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(al.action) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length} OR LOWER(al.affected_record) LIKE $${params.length})`);
    }
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    params.push(parseInt(limit, 10), offset);

    const sql = `
      SELECT al.id, al.action, al.module, al.affected_record, al.details, al.ip_address, al.created_at,
             u.id AS user_id, u.full_name, u.email
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const r = await db.query(sql, params);

    // Count
    const countParams = params.slice(0, params.length - 2);
    const countSql = `
      SELECT COUNT(*)::int AS n
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    `;
    const total = await db.query(countSql, countParams);

    res.json({ success: true, data: { items: r.rows, total: total.rows[0].n, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) { next(err); }
}

async function listModules(req, res, next) {
  try {
    const r = await db.query('SELECT DISTINCT module FROM audit_logs WHERE module IS NOT NULL ORDER BY module');
    res.json({ success: true, data: r.rows.map(x => x.module) });
  } catch (err) { next(err); }
}

module.exports = { list, listModules };