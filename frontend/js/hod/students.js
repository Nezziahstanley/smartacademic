'use strict';
(function () {
  const { $, api, esc, initials, openModal } = window.SACrud;
  const state = { search: '', level: '' };

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="6"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.search) p.set('search', state.search);
    if (state.level) p.set('level', state.level);
    const { ok, data } = await api('/api/hod/students?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    render(data.data.items);
  }

  function render(items) {
    const body = $('#tbody');
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:40px;"><div class="empty-icon">🎓</div><h3>No students</h3></div></td></tr>';
      return;
    }
    body.innerHTML = items.map(s => {
      const cls = (s.risk_category || 'GREEN').toLowerCase();
      return `
        <tr>
          <td><div style="display:flex;align-items:center;gap:10px;">
            <span class="profile-avatar" style="width:32px;height:32px;font-size:12px;">${esc(initials(s.full_name))}</span>
            <div><div style="font-weight:600;">${esc(s.full_name)}</div>
            <div style="font-size:12px;color:var(--ink-3);">${esc(s.email)}</div></div>
          </div></td>
          <td>${esc(s.matric_no)}</td>
          <td>${esc(s.programme_name)}</td>
          <td><span class="badge badge-blue">${s.level}</span></td>
          <td><span class="badge badge-${cls}"><span class="risk-dot ${cls}"></span>${s.risk_category}</span></td>
          <td><div class="actions">
            <button class="btn btn-ghost btn-sm" data-view="${s.id}">View</button>
            <button class="btn btn-primary btn-sm" data-intervene="${s.id}">Intervene</button>
          </div></td>
        </tr>`;
    }).join('');
    body.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openDetail(parseInt(b.dataset.view, 10))));
    body.querySelectorAll('[data-intervene]').forEach(b => b.addEventListener('click', () => openIntervene(parseInt(b.dataset.intervene, 10))));
  }

  async function openDetail(id) {
    const { ok, data } = await api('/api/hod/students/' + id);
    if (!ok) { alert('Failed'); return; }
    const { student, results, attendance, risk, interventions } = data.data;

    const resultsHtml = results.length ? results.map(r => `
      <tr><td>${esc(r.code)} ${esc(r.title)}</td><td>${r.units}</td>
        <td>${parseFloat(r.total_score || 0).toFixed(1)}</td>
        <td><span class="badge badge-${r.grade === 'A' ? 'green' : r.grade === 'F' ? 'red' : 'blue'}">${r.grade || '—'}</span></td>
      </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--ink-3);">No results yet</td></tr>';

    openModal({
      title: student.full_name,
      subtitle: `${student.matric_no} · ${student.programme_name} · L${student.level}`,
      size: 'lg', confirmText: 'Close',
      body: `
        <div class="grid-3" style="gap:12px;margin-bottom:20px;">
          <div><div style="font-size:12px;color:var(--ink-3);">Attendance</div><strong>${attendance.pct || 0}%</strong></div>
          <div><div style="font-size:12px;color:var(--ink-3);">Latest Risk</div>
            ${risk.length ? `<span class="badge badge-${risk[0].risk_category.toLowerCase()}">${risk[0].risk_category}</span>` : '—'}
          </div>
          <div><div style="font-size:12px;color:var(--ink-3);">Interventions</div><strong>${interventions.length}</strong></div>
        </div>
        <h4 style="font-size:13px;margin-bottom:8px;">Results (${results.length})</h4>
        <div class="table-wrap" style="box-shadow:none;">
          <table class="table">
            <thead><tr><th>Course</th><th>Units</th><th>Score</th><th>Grade</th></tr></thead>
            <tbody>${resultsHtml}</tbody>
          </table>
        </div>
      `,
      onConfirm: (_b, close) => close(),
    });
  }

  async function openIntervene(studentId) {
    const { ok, data } = await api('/api/hod/interventions/staff');
    const staff = ok ? data.data : [];
    openModal({
      title: 'Create intervention',
      confirmText: 'Create',
      body: `
        <div class="field"><label>Title *</label><input class="input" id="f_title" /></div>
        <div class="field"><label>Type *</label>
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
        <div class="field"><label>Assigned to</label>
          <select class="select" id="f_assignee"><option value="">— Unassigned —</option>
            ${staff.map(s => `<option value="${s.id}">${esc(s.full_name)} (${esc(s.role)})</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>Priority</label>
            <select class="select" id="f_priority">
              <option value="low">Low</option><option value="medium" selected>Medium</option>
              <option value="high">High</option><option value="critical">Critical</option>
            </select>
          </div>
          <div class="field"><label>Due date</label><input class="input" id="f_due" type="date" /></div>
        </div>
        <div class="field"><label>Description</label><textarea class="textarea" id="f_desc" rows="3"></textarea></div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          student_id: studentId,
          title: bd.querySelector('#f_title').value.trim(),
          type: bd.querySelector('#f_type').value,
          assigned_to: parseInt(bd.querySelector('#f_assignee').value, 10) || null,
          priority: bd.querySelector('#f_priority').value,
          due_date: bd.querySelector('#f_due').value || null,
          description: bd.querySelector('#f_desc').value.trim() || null,
        };
        if (!payload.title) { alert('Title required'); return; }
        const { ok } = await api('/api/hod/interventions', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert('Failed'); return; }
        close(); alert('Intervention created.');
      },
    });
  }

  function bind() {
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 300);
    });
    $('#levelFilter').addEventListener('change', e => { state.level = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.search = ''; state.level = '';
      $('#searchInput').value = ''; $('#levelFilter').value = '';
      load();
    });
  }

  function boot() { bind(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();