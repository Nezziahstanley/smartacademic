// ============================================================
// SMARTACADEMIC — Risk & Intervention Controller
// ============================================================

'use strict';

const interventionService = require('../services/interventionService');
const model = require('../models/riskModel');
const adminModel = require('../models/adminModel');
const { AppError } = require('../middleware/errorHandler');
const db = require('../config/db');

/* ============ RISK ============ */
async function listRisk(req, res, next) {
  try {
    const { category, department_id, level, search, page = 1, limit = 50 } = req.query;
    const filters = {
      category: category || null,
      departmentId: department_id ? parseInt(department_id, 10) : null,
      level: level ? parseInt(level, 10) : null,
      search: search || null,
    };
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [items, total, summary] = await Promise.all([
      model.listRisk({ ...filters, limit: parseInt(limit, 10), offset }),
      model.countRisk(filters),
      model.getRiskSummary(),
    ]);
    res.json({ success: true, data: { items, total, summary } });
  } catch (err) { next(err); }
}

async function getRisk(req, res, next) {
  try {
    const item = await model.getRiskDetail(parseInt(req.params.id, 10));
    if (!item) throw new AppError('Risk assessment not found.', 404);
    const history = await model.getRiskHistory(item.student_id);
    res.json({ success: true, data: { assessment: item, history } });
  } catch (err) { next(err); }
}

async function getStudentRiskHistory(req, res, next) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    res.json({ success: true, data: await model.getRiskHistory(studentId) });
  } catch (err) { next(err); }
}

/* ============ INTERVENTIONS ============ */
async function listInterventions(req, res, next) {
  try {
    const { status, type, priority, assigned_to, student_id, search, page = 1, limit = 50 } = req.query;
    const filters = {
      status: status || null,
      type: type || null,
      priority: priority || null,
      assignedTo: assigned_to ? parseInt(assigned_to, 10) : null,
      studentId: student_id ? parseInt(student_id, 10) : null,
      search: search || null,
    };
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      model.listInterventions({ ...filters, limit: parseInt(limit, 10), offset }),
      model.countInterventions(filters),
    ]);
    res.json({ success: true, data: { items, total } });
  } catch (err) { next(err); }
}

async function getIntervention(req, res, next) {
  try {
    const item = await model.getIntervention(parseInt(req.params.id, 10));
    if (!item) throw new AppError('Intervention not found.', 404);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function createIntervention(req, res, next) {
  try {
    const r = await model.createIntervention({ ...req.body, created_by: req.user.id });
    await adminModel.writeAudit({
      user_id: req.user.id, action: 'create_intervention', module: 'interventions',
      affected_record: `intervention:${r.id}`,
    });

    // Create a notification for the assignee
    if (req.body.assigned_to) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES ($1, 'New intervention assigned', $2, 'intervention', $3)
      `, [req.body.assigned_to,
          `You have been assigned: ${req.body.title}`,
          r.id]);
    }

    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
}

async function updateIntervention(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const before = await model.getIntervention(id);
    if (!before) throw new AppError('Intervention not found.', 404);

    await model.updateIntervention(id, req.body);

    // Notify student if status changed to Completed/Closed
    if (req.body.status && req.body.status !== before.status) {
      const st = await db.query('SELECT user_id FROM students WHERE id = $1', [before.student_id]);
      if (st.rows[0]) {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, type, related_id)
          VALUES ($1, 'Intervention update', $2, 'intervention', $3)
        `, [st.rows[0].user_id, `Your intervention "${before.title}" is now ${req.body.status}.`, id]);
      }
    }

    await adminModel.writeAudit({ user_id: req.user.id, action: 'update_intervention', module: 'interventions', affected_record: `intervention:${id}` });
    res.json({ success: true, message: 'Updated.' });
  } catch (err) { next(err); }
}

async function deleteIntervention(req, res, next) {
  try {
    await model.deleteIntervention(parseInt(req.params.id, 10));
    await adminModel.writeAudit({ user_id: req.user.id, action: 'delete_intervention', module: 'interventions' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

/* ============ STAFF / STUDENT LOOKUPS ============ */
async function listStaff(req, res, next) {
  try { res.json({ success: true, data: await model.listStaffCandidates() }); }
  catch (err) { next(err); }
}
async function listStudentsSelect(req, res, next) {
  try { res.json({ success: true, data: await model.listStudentsForSelect() }); }
  catch (err) { next(err); }
}

const riskEngine = require('../services/riskEngine');

async function recompute(req, res, next) {
  try {
    const info = await riskEngine.fullRecompute({});
    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'recompute_risk',
      module: 'risk',
      details: { students: info.risk.count, results: info.results.updated },
    });
    res.json({ success: true, data: info });
  } catch (err) { next(err); }
}

async function autoIntervene(req, res, next) {
  try {
    const info = await interventionService.autoCreateForHighRisk({});
    await adminModel.writeAudit({
      user_id: req.user.id,
      action: 'auto_intervene',
      module: 'interventions',
      details: info,
    });
    res.json({ success: true, data: info });
  } catch (err) { next(err); }
}

module.exports = {
  listRisk, getRisk, getStudentRiskHistory,
  listInterventions, getIntervention, createIntervention, updateIntervention, deleteIntervention,
  listStaff, listStudentsSelect,
  recompute,
  autoIntervene,
};