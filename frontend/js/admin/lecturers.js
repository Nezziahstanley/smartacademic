'use strict';
(function () {
  const { $, api, esc, initials, openModal, confirmDelete, toast } = window.SACrud;
  const state = { page: 1, limit: 15, search: '', department_id: '', total: 0, items: [], departments: [] };

  async function loadDepartments() {
    const { ok, data } = await api('/api/admin/departments');
    if (ok) {
      state.departments = data.data;
      $('#deptFilter').innerHTML = '<option value="">All departments</option>' +
        data.data.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    }
  }

  async function load() {
    const p = new URLSearchParams({ page: state.page, limit: state.limit });
    if (state.search) p.set('search', state.search);
    if (state.department_id) p.set('department_id', state.department_id);
    $('#tbody').innerHTML = '<tr><td colspan="5"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const { ok, data } = await api('/api/admin/lecturers?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>'; return; }
    state.items = data.data.items; state.total = data.data.total;
    render(); renderPagination();
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="5"><div class="empty" style="padding:40px;"><div class="empty-icon">👨‍🏫</div><h3>No lecturers</h3><p>Click "+ New Lecturer" to add one.</p></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(l => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px;">
          <span class="profile-avatar" style="width:32px;height:32px;font-size:12px;">${esc(initials(l.full_name))}</span>
          <div><div style="font-weight:600;">${esc(l.title ? l.title + ' ' : '')}${esc(l.full_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(l.email)}</div></div>
        </div></td>
        <td>${esc(l.staff_id)}</td>
        <td>${esc(l.department_name)}</td>
        <td><span class="badge badge-blue">${l.course_count}</span></td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${l.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${l.id}">Delete</button>
        </div></td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    $('#paginationInfo').textContent = state.total === 0 ? 'No results' : `Showing ${(state.page - 1) * state.limit + 1}–${Math.min(state.page * state.limit, state.total)} of ${state.total}`;
    const btns = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) btns.push(i);
      else if (btns[btns.length - 1] !== '…') btns.push('…');
    }
    $('#paginationButtons').innerHTML = `
      <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>
      ${btns.map(n => n === '…' ? '<button disabled>…</button>' : `<button class="${n === state.page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('')}
      <button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;
    $('#paginationButtons').querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
      const p = parseInt(b.dataset.page, 10);
      if (p >= 1 && p <= totalPages) { state.page = p; load(); }
    }));
  }

  function formBody(l = {}) {
    return `
      <div class="field"><label>Title</label><input class="input" id="f_title" placeholder="Dr. / Prof." value="${esc(l.title || '')}" /></div>
      <div class="field"><label>Full name *</label><input class="input" id="f_full_name" value="${esc(l.full_name || '')}" /></div>
      <div class="field"><label>Email *</label><input class="input" id="f_email" type="email" value="${esc(l.email || '')}" /></div>
      <div class="field"><label>Phone</label><input class="input" id="f_phone" value="${esc(l.phone || '')}" /></div>
      <div class="field"><label>Staff ID *</label><input class="input" id="f_staff_id" value="${esc(l.staff_id || '')}" /></div>
      <div class="field"><label>Department *</label>
        <select class="select" id="f_department">
          ${state.departments.map(d => `<option value="${d.id}" ${l.department_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
        </select>
      </div>
      ${!l.id ? `<div class="field"><label>Password *</label><input class="input" id="f_password" value="Welcome@${Math.random().toString(36).slice(2,6)}" /></div>` : ''}
    `;
  }

  function openCreate() {
    openModal({
      title: 'New lecturer', confirmText: 'Create', body: formBody({}),
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          staff_id: bd.querySelector('#f_staff_id').value.trim(),
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          title: bd.querySelector('#f_title').value.trim() || null,
          password: bd.querySelector('#f_password').value,
        };
        const { ok, data } = await api('/api/admin/lecturers', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Lecturer created'); load();
      },
    });
  }

  function openEdit(id) {
    const l = state.items.find(x => x.id === id);
    if (!l) return;
    openModal({
      title: 'Edit lecturer', subtitle: l.email, confirmText: 'Save changes', body: formBody(l),
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          staff_id: bd.querySelector('#f_staff_id').value.trim(),
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          title: bd.querySelector('#f_title').value.trim() || null,
        };
        const { ok, data } = await api('/api/admin/lecturers/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Lecturer updated'); load();
      },
    });
  }

  function doDelete(id) {
    const l = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete lecturer?', subtitle: l ? l.full_name : '',
      message: 'This will remove the lecturer account.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/lecturers/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Lecturer deleted'); load();
      },
    });
  }

  function bindFilters() {
    let t;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 300);
    });
    $('#deptFilter').addEventListener('change', e => { state.department_id = e.target.value; state.page = 1; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.search = ''; state.department_id = ''; state.page = 1;
      $('#searchInput').value = ''; $('#deptFilter').value = '';
      load();
    });
    $('#btnNew').addEventListener('click', openCreate);
  }

  async function boot() { await loadDepartments(); bindFilters(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();