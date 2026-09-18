// ============================================================
// SMARTACADEMIC — HOD Risk Monitoring
// Lists at-risk students. Shows an "Intervened" badge if there
// is an active intervention. "+ Intervene" opens a modal.
// ============================================================

'use strict';

(function () {
  const { $, api, esc, openModal, toast } = window.SACrud;

  const state = { category: '', level: '', items: [] };

  /* ============================================================
     LOAD
     ============================================================ */
  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const p = new URLSearchParams();
    if (state.category) p.set('category', state.category);
    if (state.level)    p.set('level', state.level);

    const { ok, data } = await api('/api/hod/risk?' + p.toString());
    if (!ok) {
      $('#tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];

    if (!state.items.length) {
      $('#tbody').innerHTML = `
        <tr><td colspan="8">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">🚦</div>
            <h3>No risk assessments</h3>
          </div>
        </td></tr>`;
      return;
    }

    $('#tbody').innerHTML = state.items.map(r => {
      const intervened = (r.active_interventions || 0) > 0;
      const latest = r.latest_intervention;

      return `
        <tr>
          <td>
            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
              ${esc(r.full_name)}
              ${intervened ? `<span class="badge badge-green" title="${esc(latest?.title || '')}">✓ Intervened</span>` : ''}
            </div>
            <div style="font-size:12px;color:var(--ink-3);">${esc(r.email || '')}</div>
          </td>
          <td>${esc(r.matric_no)}</td>
          <td>${r.level}</td>
          <td><span class="badge badge-${r.risk_category.toLowerCase()}">${r.risk_category}</span></td>
          <td><strong>${parseFloat(r.risk_score).toFixed(1)}</strong></td>
          <td>${parseFloat(r.attendance_pct || 0).toFixed(1)}%</td>
          <td>${parseFloat(r.gpa || 0).toFixed(2)}</td>
          <td style="text-align:right;">
            <button class="btn ${intervened ? 'btn-ghost' : 'btn-primary'} btn-sm"
                    data-intervene="${r.student_id}">
              ${intervened ? '+ Add another' : '+ Intervene'}
            </button>
          </td>
        </tr>`;
    }).join('');

    $('#tbody').querySelectorAll('[data-intervene]').forEach(b =>
      b.addEventListener('click', () => openIntervene(parseInt(b.dataset.intervene, 10))));
  }

  /* ============================================================
     INTERVENE MODAL (unchanged from before)
     ============================================================ */
  async function openIntervene(studentId) {
    const student = state.items.find(x => x.student_id === studentId);
    if (!student) return;

    let staff = [];
    const staffRes = await api('/api/hod/interventions/staff');
    if (staffRes.ok) staff = staffRes.data.data;

    openModal({
      title: 'Create Intervention',
      subtitle: `${esc(student.full_name)} · ${esc(student.matric_no)} · ${student.risk_category}`,
      size: 'md',
      confirmText: 'Create Intervention',
      body: `
        <div class="msg msg-info show" style="margin-bottom:14px;">
          Risk score <strong>${parseFloat(student.risk_score).toFixed(1)}</strong>
          · Attendance <strong>${parseFloat(student.attendance_pct || 0).toFixed(1)}%</strong>
          · GPA <strong>${parseFloat(student.gpa || 0).toFixed(2)}</strong>
        </div>

        <div class="field">
          <label>Title <span style="color:var(--red)">*</span></label>
          <input class="input" id="f_title"
                 placeholder="e.g. Academic counselling session"
                 value="Follow-up on ${student.risk_category} risk assessment" />
        </div>

        <div class="field-row">
          <div class="field">
            <label>Type <span style="color:var(--red)">*</span></label>
            <select class="select" id="f_type">
              <option value="academic_counselling">Academic counselling</option>
              <option value="tutorial_recommendation">Tutorial recommendation</option>
              <option value="lecturer_meeting">Lecturer meeting</option>
              <option value="hod_meeting" selected>HOD meeting</option>
              <option value="attendance_improvement">Attendance improvement</option>
              <option value="study_support">Study support</option>
              <option value="course_advisory">Course advisory</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field">
            <label>Priority</label>
            <select class="select" id="f_priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high" ${student.risk_category === 'ORANGE' ? 'selected' : ''}>High</option>
              <option value="critical" ${student.risk_category === 'RED' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Assigned to</label>
            <select class="select" id="f_assignee">
              <option value="">— Unassigned —</option>
              ${staff.map(s => `<option value="${s.id}">${esc(s.full_name)} (${esc(s.role)})</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Due date</label>
            <input class="input" id="f_due" type="date"
                   value="${new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10)}" />
          </div>
        </div>

        <div class="field">
          <label>Description</label>
          <textarea class="textarea" id="f_desc" rows="4"
                    placeholder="What should the assigned staff member do?"></textarea>
        </div>

        ${student.factors ? `
          <div class="field">
            <label>Risk factors (read-only)</label>
            <div class="msg msg-warning show" style="margin:0;font-size:13px;">
              ${esc(student.factors)}
            </div>
          </div>` : ''}
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          student_id:  studentId,
          title:       bd.querySelector('#f_title').value.trim(),
          type:        bd.querySelector('#f_type').value,
          assigned_to: parseInt(bd.querySelector('#f_assignee').value, 10) || null,
          priority:    bd.querySelector('#f_priority').value,
          due_date:    bd.querySelector('#f_due').value || null,
          description: bd.querySelector('#f_desc').value.trim() || null,
        };

        if (!payload.title) { alert('Title is required.'); return; }

        const { ok, data } = await api('/api/hod/interventions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!ok) { alert(data?.error || 'Failed to create intervention.'); return; }
        close();
        toast('✅ Intervention created');
        load(); // ← refresh so the "Intervened" badge appears
      },
    });
  }

  /* ============================================================
     FILTERS
     ============================================================ */
  function bind() {
    $('#catFilter').addEventListener('change', (e) => { state.category = e.target.value; load(); });
    $('#levelFilter').addEventListener('change', (e) => { state.level = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.category = ''; state.level = '';
      $('#catFilter').value = ''; $('#levelFilter').value = '';
      load();
    });
  }

  document.addEventListener('sa:layout-ready', () => { bind(); load(); });
})();