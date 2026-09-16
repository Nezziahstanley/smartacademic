// ============================================================
// SMARTACADEMIC — Settings Controller
// Handles system settings (institution info, thresholds, etc.)
// ============================================================

'use strict';

const model = require('../models/settingsModel');
const adminModel = require('../models/adminModel');
const { AppError } = require('../middleware/errorHandler');

/* ============================================================
   LIST ALL SETTINGS
   ============================================================ */
async function list(req, res, next) {
  try {
    const data = await model.listAll();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/* ============================================================
   UPDATE ONE SETTING (upsert)
   ============================================================ */
async function update(req, res, next) {
  try {
    const { key, value, category, description } = req.body;
    if (!key) throw new AppError('Key is required.', 400);

    await model.upsert({ key, value, category, description }, req.user.id);

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'update_setting',
      module: 'settings',
      affected_record: `setting:${key}`,
      details: { value },
    });

    res.json({ success: true, message: 'Setting saved.' });
  } catch (err) { next(err); }
}

/* ============================================================
   BULK UPDATE — { items: [{ key, value }, ...] }
   ============================================================ */
async function bulkUpdate(req, res, next) {
  try {
    const items = req.body.items || [];
    if (!Array.isArray(items)) {
      throw new AppError('items must be an array.', 400);
    }
    if (!items.length) {
      return res.json({ success: true, message: 'No changes to save.' });
    }

    for (const item of items) {
      if (!item.key) continue;
      await model.update(item.key, item.value, req.user.id);
    }

    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'bulk_update_settings',
      module: 'settings',
      details: { count: items.length, keys: items.map(i => i.key).slice(0, 10) },
    });

    res.json({ success: true, message: `${items.length} settings saved.` });
  } catch (err) { next(err); }
}

/* ============================================================
   DELETE A SETTING
   ============================================================ */
async function remove(req, res, next) {
  try {
    await model.remove(req.params.key);
    res.json({ success: true, message: 'Setting removed.' });
  } catch (err) { next(err); }
}

module.exports = {
  list,
  update,
  bulkUpdate,
  remove,
};