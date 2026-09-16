'use strict';
(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const state = {
    page: 1, limit: 15, status: '', priority: '', type: '', search: '',
    total: 0, items: [], staff: [], students: [],
  };

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
  const PRIORITY_BADGE = { low: 'badge-gray', medium: 'badge-blue', high: 'badge-orange', critical: 'badge-red' };
  const STATUS_BADGE = { Pending: 'badge-yellow', 'In Progress': 'badge-blue', Completed: 'badge-green', Closed: 'badge-gray' };

  async function loadLookups() {
    const [s, st] = await Promise.all([
      api('/api/admin/interventions/staff'),
      api('/api/admin/interventions/students'),
    ]);
    if (s.ok) state.staff = s.data.data;
    if (st.ok) state.students = st.data.data;
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams({ page: state.page, limit: state.limit });
    if (state.status) p.set('status', state.status);
    if (state.priority) p.set('priority', state.priority);
    if (state.type) p.set('type', state.type);
    if (state.search) p.set('search', state.search);
    const { ok, data } = await api('/api/admin/interventions?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    state.items = data.data.items;
    state.total = data.data.total;
    render();
    pagination();
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:40px;"><div class="empty-icon">🤝</div><h3>No interventions</h3></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(i => `
      <tr>
        <td>
          <div style="font-weight:600;">${esc(i.student_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(i.matric_no)}</div>
        </td>
        <td>${esc(i.title)}</td>
        <td><span class="badge badge-gray">${esc(TYPE_LABELS[i.type] || i.type)}</span></td>
        <td>${esc(i.assignee_name || '—')}</td>
        <td><span class="badge ${PRIORITY_BADGE[i.priority]}">${esc(i.priority)}</span></td>
        <td><span class="badge ${STATUS_BADGE[i.status]}">${esc(i.status)}</span></td>
        <td>${i.due_date ? new Date(i.due_date).toLocaleDateString() : '—'}</td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${i.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${i.id}">Delete</button>
        </div></td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function pagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    $('#paginationInfo').textContent = state.total === 0 ? 'No results'
      : `Showing ${(state.page - 1) * state.limit + 1}–${Math.min(state.page * state.limit, state.total)} of ${state.total}`;
    const nums = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    $('#paginationButtons').innerHTML = `
      <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>
      ${nums.map(n => n === '…' ? '<button disabled>…</button>' : `<button class="${n === state.page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('')}
      <button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;
    $('#paginationButtons').querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
      const p = parseInt(b.dataset.page, 10);
      if (p >= 1 && p <= totalPages) { state.page = p; load(); }
    }));
  }

  function formBody(i = {}) {
    const studentOpts = state.students.map(s =>
      `<option value="${s.id}" ${i.student_id === s.id ? 'selected' : ''}>${esc(s.full_name)} (${esc(s.matric_no)})</option>`
    ).join('');
    const staffOpts = state.staff.map(s =>
      `<option value="${s.id}" ${i.assigned_to === s.id ? 'selected' : ''}>${esc(s.full_name)} (${esc(s.role)})</option>`
    ).join('');
    return `
      ${!i.id ? `<div class="field"><label>Student *</label><select class="select" id="f_student"><option value="">Select student</option>${studentOpts}</select></div>` : ''}
      <div class="field"><label>Title *</label><input class="input" id="f_title" value="${esc(i.title || '')}" /></div>
      <div class="field"><label>Type *</label>
        <select class="select" id="f_type">
          ${Object.entries(TYPE_LABELS).map(([k, v]) =>
            `<option value="${k}" ${i.type === k ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field"><label>Assigned to</label>
        <select class="select" id="f_assignee"><option value="">— Unassigned —</option>${staffOpts}</select>
      </div>
      <div class="field-row">
        <div class="field"><label>Priority</label>
          <select class="select" id="f_priority">
            ${['low','medium','high','critical'].map(p =>
              `<option value="${p}" ${i.priority === p ? 'selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select class="select" id="f_status">
            ${['Pending','In Progress','Completed','Closed'].map(s =>
              `<option value="${s}" ${i.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label>Due date</label>
        <input class="input" id="f_due" type="date" value="${i.due_date ? i.due_date.toString().slice(0,10) : ''}" />
      </div>
      <div class="field"><label>Description</label>
        <textarea class="textarea" id="f_desc" rows="3">${esc(i.description || '')}</textarea>
      </div>
      <div class="field"><label>Notes</label>
        <textarea class="textarea" id="f_notes" rows="2">${esc(i.notes || '')}</textarea>
      </div>
    `;
  }

  function openCreate() {
    openModal({
      title: 'New intervention', confirmText: 'Create',
      body: formBody({ priority: 'medium', status: 'Pending' }),
      onConfirm: async (bd, close) => {
        const payload = {
          student_id: parseInt(bd.querySelector('#f_student').value, 10),
          title: bd.querySelector('#f_title').value.trim(),
          type: bd.querySelector('#f_type').value,
          assigned_to: parseInt(bd.querySelector('#f_assignee').value, 10) || null,
          priority: bd.querySelector('#f_priority').value,
          status: bd.querySelector('#f_status').value,
          due_date: bd.querySelector('#f_due').value || null,
          description: bd.querySelector('#f_desc').value.trim() || null,
          notes: bd.querySelector('#f_notes').value.trim() || null,
        };
        if (!payload.student_id) { alert('Select a student'); return; }
        if (!payload.title) { alert('Title required'); return; }
        const { ok, data } = await api('/api/admin/interventions', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Intervention created'); load();
      },
    });
  }

  function openEdit(id) {
    const i = state.items.find(x => x.id === id);
    if (!i) return;
    openModal({
      title: 'Edit intervention', subtitle: i.student_name, confirmText: 'Save',
      body: formBody(i),
      onConfirm: async (bd, close) => {
        const payload = {
          title: bd.querySelector('#f_title').value.trim(),
          type: bd.querySelector('#f_type').value,
          assigned_to: parseInt(bd.querySelector('#f_assignee').value, 10) || null,
          priority: bd.querySelector('#f_priority').value,
          status: bd.querySelector('#f_status').value,
          due_date: bd.querySelector('#f_due').value || null,
          description: bd.querySelector('#f_desc').value.trim() || null,
          notes: bd.querySelector('#f_notes').value.trim() || null,
        };
        const { ok, data } = await api('/api/admin/interventions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Updated'); load();
      },
    });
  }

  function doDelete(id) {
    const i = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete intervention?', subtitle: i ? i.title : '',
      onConfirm: async () => {
        const { ok } = await api('/api/admin/interventions/' + id, { method: 'DELETE' });
        if (!ok) { alert('Failed'); return; }
        toast('Deleted'); load();
      },
    });
  }

  function bind() {
    $('#statusFilter').addEventListener('change', e => { state.status = e.target.value; state.page = 1; load(); });
    $('#priorityFilter').addEventListener('change', e => { state.priority = e.target.value; state.page = 1; load(); });
    $('#typeFilter').addEventListener('change', e => { state.type = e.target.value; state.page = 1; load(); });
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 300);
    });
    $('#btnReset').addEventListener('click', () => {
      state.status = ''; state.priority = ''; state.type = ''; state.search = ''; state.page = 1;
      $('#statusFilter').value = ''; $('#priorityFilter').value = ''; $('#typeFilter').value = ''; $('#searchInput').value = '';
      load();
    });
    $('#btnNew').addEventListener('click', openCreate);
  }

  async function boot() { await loadLookups(); bind(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();