// ============================================================
// HOD Interventions — list, create, update
// "+ New Intervention" opens a modal with a student picker first.
// ============================================================

'use strict';

(function () {
  const { $, api, esc, openModal, toast } = window.SACrud;

  const state = { status: '', search: '', items: [] };

  const PRIORITY_BADGE = { low: 'badge-gray', medium: 'badge-blue', high: 'badge-orange', critical: 'badge-red' };
  const STATUS_BADGE = { Pending: 'badge-yellow', 'In Progress': 'badge-blue', Completed: 'badge-green', Closed: 'badge-gray' };
  const TYPE_LABELS = {
    academic_counselling: 'Academic counselling',
    tutorial_recommendation: 'Tutorial recommendation',
    lecturer_meeting: 'Lecturer meeting',
    hod_meeting: 'HOD meeting',
    attendance_improvement: 'Attendance improvement',
    study_support: 'Study support',
    course_advisory: 'Course advisory',
    other: 'Other',
  };

  /* ============================================================
     LOAD
     ============================================================ */
  async function load() {
    const tbody = $('#tbody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const p = new URLSearchParams();
    if (state.status) p.set('status', state.status);

    const { ok, data } = await api('/api/hod/interventions?' + p.toString());
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    let items = data.data || [];
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(i =>
        (i.student_name || '').toLowerCase().includes(q) ||
        (i.title || '').toLowerCase().includes(q) ||
        (i.matric_no || '').toLowerCase().includes(q));
    }

    state.items = items;

    if (!items.length) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">🤝</div>
            <h3>No interventions</h3>
            <p>Click "+ New Intervention" to create one.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(i => `
      <tr>
        <td>
          <div style="font-weight:600;">${esc(i.student_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(i.matric_no)}</div>
        </td>
        <td>${esc(i.title)}</td>
        <td><span class="badge badge-gray">${esc(TYPE_LABELS[i.type] || i.type)}</span></td>
        <td>${esc(i.assignee_name || '—')}</td>
        <td><span class="badge ${PRIORITY_BADGE[i.priority] || 'badge-gray'}">${esc(i.priority)}</span></td>
        <td><span class="badge ${STATUS_BADGE[i.status] || 'badge-gray'}">${esc(i.status)}</span></td>
        <td style="text-align:right;">
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-edit="${i.id}">Update</button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
  }

  /* ============================================================
     NEW INTERVENTION — with student picker
     ============================================================ */
  async function openNew() {
    // Load students + staff in parallel
    const [studentsRes, staffRes] = await Promise.all([
      api('/api/hod/interventions/students'),
      api('/api/hod/interventions/staff'),
    ]);

    if (!studentsRes.ok) {
      alert('Failed to load students.');
      return;
    }

    const students = studentsRes.data.data || [];
    const staff = staffRes.ok ? staffRes.data.data : [];

    if (!students.length) {
      alert('No students in your department yet.');
      return;
    }

    openModal({
      title: 'New Intervention',
      subtitle: 'Create a student support action',
      size: 'md',
      confirmText: 'Create Intervention',
      body: `
        <div class="field">
          <label>Student <span style="color:var(--red)">*</span></label>
          <select class="select" id="f_student">
            <option value="">— Select a student —</option>
            ${students.map(s => `
              <option value="${s.id}"
                      data-risk="${esc(s.risk_category)}">
                ${esc(s.full_name)} — ${esc(s.matric_no)} (L${s.level}, ${s.risk_category})
              </option>`).join('')}
          </select>
          <p style="font-size:12px;color:var(--ink-3);margin-top:6px;">
            Only students in your department are listed.
          </p>
        </div>

        <div id="studentPreview" style="display:none;padding:12px;background:#f0fdf4;border-radius:8px;margin-bottom:14px;font-size:13px;"></div>

        <div class="field">
          <label>Title <span style="color:var(--red)">*</span></label>
          <input class="input" id="f_title"
                 placeholder="e.g. Academic counselling session" />
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
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
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
      `,
      onReady: (bd) => {
        const sel = bd.querySelector('#f_student');
        const preview = bd.querySelector('#studentPreview');
        const titleEl = bd.querySelector('#f_title');
        const priorityEl = bd.querySelector('#f_priority');

        sel.addEventListener('change', () => {
          const opt = sel.selectedOptions[0];
          if (!sel.value) {
            preview.style.display = 'none';
            return;
          }
          const student = students.find(s => String(s.id) === sel.value);
          if (!student) return;

          const risk = student.risk_category;
          const riskCls = risk.toLowerCase();

          preview.style.display = 'block';
          preview.innerHTML = `
            <strong>${esc(student.full_name)}</strong> · ${esc(student.matric_no)}<br>
            <span style="color:var(--ink-3);">${esc(student.programme_name || '')} · Level ${student.level}</span><br>
            <span class="badge badge-${riskCls}" style="margin-top:6px;">Risk: ${risk}</span>
          `;

          // Auto-fill title if empty
          if (!titleEl.value.trim()) {
            titleEl.value = `Follow-up on ${risk} risk assessment`;
          }

          // Auto-set priority based on risk
          if (risk === 'RED') priorityEl.value = 'critical';
          else if (risk === 'ORANGE') priorityEl.value = 'high';
        });
      },
      onConfirm: async (bd, close) => {
        const payload = {
          student_id:  parseInt(bd.querySelector('#f_student').value, 10),
          title:       bd.querySelector('#f_title').value.trim(),
          type:        bd.querySelector('#f_type').value,
          assigned_to: parseInt(bd.querySelector('#f_assignee').value, 10) || null,
          priority:    bd.querySelector('#f_priority').value,
          due_date:    bd.querySelector('#f_due').value || null,
          description: bd.querySelector('#f_desc').value.trim() || null,
        };

        if (!payload.student_id) { alert('Please select a student.'); return; }
        if (!payload.title) { alert('Title is required.'); return; }

        const { ok, data } = await api('/api/hod/interventions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!ok) { alert(data?.error || 'Failed to create.'); return; }
        close();
        toast('✅ Intervention created');
        load();
      },
    });
  }

  /* ============================================================
     EDIT MODAL
     ============================================================ */
  function openEdit(id) {
    const item = state.items.find(x => x.id === id);
    if (!item) return;

    openModal({
      title: 'Update Intervention',
      subtitle: `${esc(item.student_name)} — ${esc(item.title)}`,
      size: 'md',
      confirmText: 'Save Changes',
      body: `
        <div class="field-row">
          <div class="field">
            <label>Status</label>
            <select class="select" id="editStatus">
              ${['Pending','In Progress','Completed','Closed'].map(s =>
                `<option value="${s}" ${item.status === s ? 'selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>
          <div class="field">
            <label>Priority</label>
            <select class="select" id="editPriority">
              ${['low','medium','high','critical'].map(p =>
                `<option value="${p}" ${item.priority === p ? 'selected' : ''}>${p}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="field">
          <label>Notes</label>
          <textarea class="textarea" id="editNotes" rows="4">${esc(item.notes || '')}</textarea>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          status: bd.querySelector('#editStatus').value,
          priority: bd.querySelector('#editPriority').value,
          notes: bd.querySelector('#editNotes').value.trim() || null,
        };

        const { ok, data } = await api('/api/hod/interventions/' + id, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (!ok) { alert(data?.error || 'Failed to update.'); return; }
        close();
        toast('Intervention updated');
        load();
      },
    });
  }

  /* ============================================================
     BIND
     ============================================================ */
  function bind() {
    $('#btnNew').addEventListener('click', openNew);

    $('#statusFilter').addEventListener('change', (e) => {
      state.status = e.target.value;
      load();
    });

    let t;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 300);
    });

    $('#btnReset').addEventListener('click', () => {
      state.status = ''; state.search = '';
      $('#statusFilter').value = '';
      $('#searchInput').value = '';
      load();
    });
  }

  document.addEventListener('sa:layout-ready', () => { bind(); load(); });
})();