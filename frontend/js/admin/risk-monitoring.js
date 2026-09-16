// ============================================================
// SMARTACADEMIC — Admin Risk Monitoring
// Filters, pagination, detail modal, create intervention,
// recompute risk, auto-intervene for high-risk students.
// ============================================================

'use strict';

(function () {
  const { $, api, esc, openModal, toast } = window.SACrud;

  const state = {
    page: 1,
    limit: 15,
    category: '',
    department_id: '',
    level: '',
    search: '',
    total: 0,
    items: [],
    departments: [],
  };

  /* ============================================================
     LOAD DEPARTMENTS (for filter dropdown)
     ============================================================ */
  async function loadDepartments() {
    const { ok, data } = await api('/api/admin/departments');
    if (!ok) return;
    state.departments = data.data;
    $('#deptFilter').innerHTML = '<option value="">All departments</option>' +
      data.data.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  }

  /* ============================================================
     LOAD RISK LIST
     ============================================================ */
  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="9"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const p = new URLSearchParams({ page: state.page, limit: state.limit });
    if (state.category)      p.set('category', state.category);
    if (state.department_id) p.set('department_id', state.department_id);
    if (state.level)         p.set('level', state.level);
    if (state.search)        p.set('search', state.search);

    const { ok, data } = await api('/api/admin/risk?' + p.toString());
    if (!ok) {
      $('#tbody').innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data.items;
    state.total = data.data.total;

    // Update summary cards
    const s = data.data.summary || { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    $('#sGreen').textContent  = s.GREEN  || 0;
    $('#sYellow').textContent = s.YELLOW || 0;
    $('#sOrange').textContent = s.ORANGE || 0;
    $('#sRed').textContent    = s.RED    || 0;

    render();
    pagination();
  }

  /* ============================================================
     RENDER TABLE
     ============================================================ */
  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty" style="padding:40px;">
              <div class="empty-icon">🚦</div>
              <h3>No risk assessments</h3>
              <p>Click "↻ Recompute Risk" to analyze students.</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    body.innerHTML = state.items.map(r => {
      const cls = (r.risk_category || 'GREEN').toLowerCase();
      return `
        <tr>
          <td>
            <div style="font-weight:600;">${esc(r.full_name)}</div>
            <div style="font-size:12px;color:var(--ink-3);">${esc(r.matric_no)}</div>
          </td>
          <td>${esc(r.department_name || '—')}</td>
          <td>${r.level}</td>
          <td><span class="badge badge-${cls}"><span class="risk-dot ${cls}"></span>${r.risk_category}</span></td>
          <td><strong>${parseFloat(r.risk_score || 0).toFixed(1)}</strong></td>
          <td>${parseFloat(r.attendance_pct || 0).toFixed(1)}%</td>
          <td>${parseFloat(r.gpa || 0).toFixed(2)}</td>
          <td>${r.failed_courses || 0}</td>
          <td>
            <div class="actions">
              <button class="btn btn-ghost btn-sm" data-view="${r.id}">Details</button>
              <button class="btn btn-primary btn-sm" data-intervene="${r.student_id}">Intervene</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-view]').forEach(b =>
      b.addEventListener('click', () => openDetail(parseInt(b.dataset.view, 10))));
    body.querySelectorAll('[data-intervene]').forEach(b =>
      b.addEventListener('click', () => openIntervene(parseInt(b.dataset.intervene, 10))));
  }

  /* ============================================================
     PAGINATION
     ============================================================ */
  function pagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    $('#paginationInfo').textContent = state.total === 0
      ? 'No results'
      : `Showing ${(state.page - 1) * state.limit + 1}–${Math.min(state.page * state.limit, state.total)} of ${state.total}`;

    const nums = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }

    $('#paginationButtons').innerHTML = `
      <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>
      ${nums.map(n => n === '…'
        ? '<button disabled>…</button>'
        : `<button class="${n === state.page ? 'active' : ''}" data-page="${n}">${n}</button>`
      ).join('')}
      <button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;

    $('#paginationButtons').querySelectorAll('[data-page]').forEach(b =>
      b.addEventListener('click', () => {
        const p = parseInt(b.dataset.page, 10);
        if (p >= 1 && p <= totalPages) { state.page = p; load(); }
      }));
  }

  /* ============================================================
     DETAIL MODAL
     ============================================================ */
  async function openDetail(id) {
    const { ok, data } = await api('/api/admin/risk/' + id);
    if (!ok) { alert('Failed to load details.'); return; }

    const a = data.data.assessment;
    const history = data.data.history;

    const historyRows = history.length ? history.map(h => `
      <tr>
        <td>${new Date(h.assessed_at).toLocaleDateString()}</td>
        <td><span class="badge badge-${h.risk_category.toLowerCase()}">${h.risk_category}</span></td>
        <td>${parseFloat(h.risk_score).toFixed(1)}</td>
        <td>${parseFloat(h.attendance_pct || 0).toFixed(1)}%</td>
        <td>${parseFloat(h.gpa || 0).toFixed(2)}</td>
      </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);">No history yet</td></tr>';

    openModal({
      title: a.full_name,
      subtitle: `${a.matric_no} · ${a.department_name} · Level ${a.level}`,
      size: 'lg',
      confirmText: 'Close',
      body: `
        <div class="grid-2" style="gap:16px;margin-bottom:20px;">
          <div class="card" style="box-shadow:none;">
            <div style="font-size:12px;color:var(--ink-3);">Risk Score</div>
            <div style="font-size:26px;font-weight:800;">${parseFloat(a.risk_score).toFixed(1)}</div>
          </div>
          <div class="card" style="box-shadow:none;">
            <div style="font-size:12px;color:var(--ink-3);">Category</div>
            <div style="margin-top:6px;">
              <span class="badge badge-${a.risk_category.toLowerCase()}">${a.risk_category}</span>
            </div>
          </div>
        </div>

        <div class="grid-3" style="gap:12px;margin-bottom:20px;">
          <div><div style="font-size:12px;color:var(--ink-3);">Attendance</div><strong>${parseFloat(a.attendance_pct || 0).toFixed(1)}%</strong></div>
          <div><div style="font-size:12px;color:var(--ink-3);">CA Avg</div><strong>${parseFloat(a.ca_avg || 0).toFixed(1)}</strong></div>
          <div><div style="font-size:12px;color:var(--ink-3);">Exam Avg</div><strong>${parseFloat(a.exam_avg || 0).toFixed(1)}</strong></div>
          <div><div style="font-size:12px;color:var(--ink-3);">GPA</div><strong>${parseFloat(a.gpa || 0).toFixed(2)}</strong></div>
          <div><div style="font-size:12px;color:var(--ink-3);">CGPA</div><strong>${parseFloat(a.cgpa || 0).toFixed(2)}</strong></div>
          <div><div style="font-size:12px;color:var(--ink-3);">Failed</div><strong>${a.failed_courses || 0}</strong></div>
        </div>

        ${a.factors ? `<div class="msg msg-warning show" style="margin-bottom:16px;"><strong>Contributing factors:</strong> ${esc(a.factors)}</div>` : ''}

        <h4 style="margin-bottom:8px;font-size:14px;">Risk History</h4>
        <div class="table-wrap" style="box-shadow:none;">
          <table class="table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Score</th><th>Attendance</th><th>GPA</th></tr>
            </thead>
            <tbody>${historyRows}</tbody>
          </table>
        </div>
      `,
      onConfirm: (_b, close) => close(),
    });
  }

  /* ============================================================
     CREATE INTERVENTION MODAL
     ============================================================ */
  async function openIntervene(studentId) {
    const [staffRes, studentsRes] = await Promise.all([
      api('/api/admin/interventions/staff'),
      api('/api/admin/interventions/students'),
    ]);
    const staff    = staffRes.ok    ? staffRes.data.data    : [];
    const students = studentsRes.ok ? studentsRes.data.data : [];
    const student  = students.find(s => s.id === studentId);

    openModal({
      title: 'Create intervention',
      subtitle: student ? `${student.full_name} · ${student.matric_no}` : '',
      confirmText: 'Create',
      body: `
        <div class="field">
          <label>Title *</label>
          <input class="input" id="f_title" placeholder="e.g. Academic counselling session" />
        </div>

        <div class="field">
          <label>Type *</label>
          <select class="select" id="f_type">
            <option value="academic_counselling">Academic counselling</option>
            <option value="tutorial_recommendation">Tutorial recommendation</option>
            <option value="lecturer_meeting">Lecturer meeting</option>
            <option value="hod_meeting">HOD meeting</option>
            <option value="attendance_improvement">Attendance improvement</option>
            <option value="study_support">Study support</option>
            <option value="course_advisory">Course advisory</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="field">
          <label>Assigned to</label>
          <select class="select" id="f_assignee">
            <option value="">— Unassigned —</option>
            ${staff.map(s => `<option value="${s.id}">${esc(s.full_name)} (${esc(s.role)})</option>`).join('')}
          </select>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Priority</label>
            <select class="select" id="f_priority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div class="field">
            <label>Due date</label>
            <input class="input" id="f_due" type="date" />
          </div>
        </div>

        <div class="field">
          <label>Description</label>
          <textarea class="textarea" id="f_desc" rows="3"></textarea>
        </div>
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

        if (!payload.title) { alert('Title required'); return; }

        const { ok, data } = await api('/api/admin/interventions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        toast('Intervention created');
        load();
      },
    });
  }

  /* ============================================================
     RECOMPUTE RISK
     ============================================================ */
  async function recompute() {
    if (!confirm('Recompute academic results AND risk for all students? This may take 10–30 seconds.')) return;

    const btn = $('#btnRecalc');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = '⏳ Recomputing...';

    try {
      const { ok, data } = await api('/api/admin/risk/recompute', { method: 'POST' });
      if (!ok) { alert(data?.error || 'Recompute failed'); return; }
      toast(`✅ Recomputed ${data.data.risk.count} students (${data.data.results.updated} results updated)`);
      setTimeout(load, 800);
    } catch (err) {
      alert('Recompute failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  /* ============================================================
     AUTO-INTERVENE FOR HIGH-RISK STUDENTS
     ============================================================ */
  async function autoIntervene() {
    if (!confirm('Auto-create interventions for all ORANGE/RED students without an open intervention?')) return;

    const autoBtn = $('#btnAutoIntervene');
    if (!autoBtn) return;

    autoBtn.disabled = true;
    const orig = autoBtn.textContent;
    autoBtn.textContent = '⏳ Working...';

    try {
      const { ok, data } = await api('/api/admin/interventions/auto-create', { method: 'POST' });
      if (!ok) { alert(data?.error || 'Failed'); return; }

      const created = data.data?.created ?? 0;
      const candidates = data.data?.candidates ?? 0;

      if (created === 0) {
        toast(`No new interventions needed (${candidates} already covered)`);
      } else {
        toast(`✅ Created ${created} interventions (${candidates} candidates)`);
      }
      setTimeout(load, 600);
    } catch (err) {
      alert('Auto-intervene failed: ' + err.message);
    } finally {
      autoBtn.disabled = false;
      autoBtn.textContent = orig;
    }
  }

  /* ============================================================
     BIND FILTERS + ACTIONS
     ============================================================ */
  function bind() {
    // Category filter
    $('#catFilter').addEventListener('change', e => {
      state.category = e.target.value;
      state.page = 1;
      load();
    });

    // Department filter
    $('#deptFilter').addEventListener('change', e => {
      state.department_id = e.target.value;
      state.page = 1;
      load();
    });

    // Level filter
    $('#levelFilter').addEventListener('change', e => {
      state.level = e.target.value;
      state.page = 1;
      load();
    });

    // Search (debounced)
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        load();
      }, 300);
    });

    // Reset
    $('#btnReset').addEventListener('click', () => {
      state.category = '';
      state.department_id = '';
      state.level = '';
      state.search = '';
      state.page = 1;
      $('#catFilter').value = '';
      $('#deptFilter').value = '';
      $('#levelFilter').value = '';
      $('#searchInput').value = '';
      load();
    });

    // Recompute risk
    $('#btnRecalc').addEventListener('click', recompute);

    // Auto-intervene (only if the button exists on the page)
    const autoBtn = $('#btnAutoIntervene');
    if (autoBtn) {
      autoBtn.addEventListener('click', autoIntervene);
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  async function boot() {
    await loadDepartments();
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
})();