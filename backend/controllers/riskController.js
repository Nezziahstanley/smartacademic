// ============================================================
// SMARTACADEMIC — Risk & Intervention Controller
// Includes background job tracking for the recompute operation.
// ============================================================

'use strict';

const interventionService = require('../services/interventionService');
const model = require('../models/riskModel');
const adminModel = require('../models/adminModel');
const { AppError } = require('../middleware/errorHandler');
const db = require('../config/db');

/* ============================================================
   RECOMPUTE JOB TRACKING
   In-memory — fine for a single-process demo.
   For multi-instance, migrate to a `risk_jobs` table.
   ============================================================ */
const recomputeJobs = new Map();

function makeJobId() {
  return 'rj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

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

    if (req.body.status && req.body.status !== before.status) {
      const st = await db.query('SELECT user_id FROM students WHERE id = $1', [before.student_id]);
      if (st.rows[0]) {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, type, related_id)
          VALUES ($1, 'Intervention update', $2, 'intervention', $3)
        `, [st.rows[0].user_id, `Your intervention "${before.title}" is now ${req.body.status}.`, id]);
      }
    }

    await adminModel.writeAudit({
      user_id: req.user.id, action: 'update_intervention', module: 'interventions',
      affected_record: `intervention:${id}`,
    });
    res.json({ success: true, message: 'Updated.' });
  } catch (err) { next(err); }
}

async function deleteIntervention(req, res, next) {
  try {
    await model.deleteIntervention(parseInt(req.params.id, 10));
    await adminModel.writeAudit({
      user_id: req.user.id, action: 'delete_intervention', module: 'interventions',
    });
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

/* ============================================================
   RECOMPUTE RISK — background job
   Returns immediately with a jobId. Frontend polls status.
   ============================================================ */
async function recompute(req, res, next) {
  try {
    const jobId = makeJobId();

    recomputeJobs.set(jobId, {
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      result: null,
      error: null,
    });

    // Capture user id and ip for the audit log at the end
    const userId = req.user.id;
    const userIp = req.ip;

    // Fire-and-forget
    (async () => {
      const job = recomputeJobs.get(jobId);
      try {
        // Stage 1 — recompute results from scores
        job.progress = 10;
        const academicEngine = require('../services/academicEngine');
        const resultsInfo = await academicEngine.recomputeResults({});
        job.progress = 40;

        // Stage 2 — recompute risk for all students
        const riskEngine = require('../services/riskEngine');
        const riskInfo = await riskEngine.assessAllStudents({});
        job.progress = 95;

        job.result = { results: resultsInfo, risk: riskInfo };
        job.progress = 100;
        job.status = 'complete';
        job.finishedAt = new Date().toISOString();

        await adminModel.writeAudit({
          user_id: userId,
          action: 'recompute_risk',
          module: 'risk',
          details: { students: riskInfo.count, results: resultsInfo.updated },
          ip_address: userIp,
        });
      } catch (err) {
        console.error('[recompute job]', err);
        job.status = 'error';
        job.error = err.message;
        job.finishedAt = new Date().toISOString();
      }

      // Auto-clean after 10 minutes
      setTimeout(() => recomputeJobs.delete(jobId), 10 * 60 * 1000);
    })();

    res.json({ success: true, data: { jobId, status: 'running' } });
  } catch (err) { next(err); }
}

async function recomputeStatus(req, res, next) {
  try {
    const job = recomputeJobs.get(req.params.jobId);
    if (!job) throw new AppError('Job not found or expired.', 404);
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
}

/* ============ AUTO-INTERVENE ============ */
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
  listRisk,
  getRisk,
  getStudentRiskHistory,
  listInterventions,
  getIntervention,
  createIntervention,
  updateIntervention,
  deleteIntervention,
  listStaff,
  listStudentsSelect,
  recompute,
  recomputeStatus,
  autoIntervene,
};