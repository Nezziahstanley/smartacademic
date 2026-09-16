// ============================================================
// SMARTACADEMIC — Intervention Service
// Auto-create interventions when risk is RED/ORANGE,
// and manage the full lifecycle.
// ============================================================

'use strict';

const db = require('../config/db');
const notificationService = require('./notificationService');

/**
 * Auto-create interventions for RED/ORANGE students without
 * an open intervention in the current session.
 */
async function autoCreateForHighRisk({ sessionId = null, semesterId = null } = {}) {
  const params = []; const where = [`ra.risk_category IN ('ORANGE','RED')`];
  if (sessionId)  { params.push(sessionId);  where.push(`ra.session_id = $${params.length}`); }
  if (semesterId) { params.push(semesterId); where.push(`ra.semester_id = $${params.length}`); }

  const candidates = await db.query(`
    SELECT ra.id AS risk_id, ra.student_id, ra.risk_category, ra.risk_score,
           ra.session_id, ra.semester_id, ra.factors,
           s.department_id, u.full_name, s.matric_no
      FROM risk_assessments ra
      JOIN students s ON s.id = ra.student_id
      JOIN users u ON u.id = s.user_id
     WHERE ${where.join(' AND ')}
       AND ra.assessed_at = (SELECT MAX(assessed_at) FROM risk_assessments WHERE student_id = ra.student_id)
       AND NOT EXISTS (
         SELECT 1 FROM interventions i
          WHERE i.student_id = ra.student_id
            AND i.status IN ('Pending','In Progress')
       )
  `, params);

  let created = 0;
  for (const c of candidates.rows) {
    // Assign to HOD of the student's department if available
    const hod = await db.query(
      'SELECT hod_id FROM departments WHERE id = $1', [c.department_id]
    );
    const assignee = hod.rows[0]?.hod_id || null;

    const priority = c.risk_category === 'RED' ? 'critical' : 'high';
    const title = `${c.risk_category === 'RED' ? 'Critical' : 'High'} risk — immediate intervention needed`;

    const ins = await db.query(`
      INSERT INTO interventions
        (student_id, risk_assessment_id, type, title, description, assigned_to,
         priority, status, created_by)
      VALUES ($1,$2,'academic_counselling',$3,$4,$5,$6,'Pending',NULL)
      RETURNING id
    `, [c.student_id, c.risk_id, title,
        `Auto-generated from risk assessment (score ${c.risk_score}). Factors: ${c.factors || 'n/a'}`,
        assignee, priority]);

    // Notify student
    const st = await db.query('SELECT user_id FROM students WHERE id = $1', [c.student_id]);
    if (st.rows[0]) {
      await notificationService.create({
        userId: st.rows[0].user_id,
        title: 'Academic support available',
        message: `An intervention has been created for you. Please check "My Interventions".`,
        type: 'intervention',
        relatedId: ins.rows[0].id,
      });
    }

    // Notify assignee
    if (assignee) {
      await notificationService.create({
        userId: assignee,
        title: 'New high-risk student assigned',
        message: `You have been assigned: ${c.full_name} (${c.matric_no}) — ${c.risk_category}`,
        type: 'risk_alert',
        relatedId: ins.rows[0].id,
      });
    }

    created++;
  }

  return { created, candidates: candidates.rows.length };
}

module.exports = { autoCreateForHighRisk };