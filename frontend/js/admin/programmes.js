'use strict';
(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const state = { items: [], departments: [], search: '', department_id: '' };

  async function loadDepartments() {
    const { ok, data } = await api('/api/admin/departments');
    if (ok) {
      state.departments = data.data;
      $('#deptFilter').innerHTML = '<option value="">All departments</option>' +
        data.data.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    }
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.search) p.set('search', state.search);
    if (state.department_id) p.set('department_id', state.department_id);
    const { ok, data } = await api('/api/admin/programmes?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>'; return; }
    state.items = data.data;
    render();
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:40px;"><div class="empty-icon">📚</div><h3>No programmes</h3></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(p => `
      <tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td><span class="badge badge-gray">${esc(p.code || '—')}</span></td>
        <td>${esc(p.department_name)}</td>
        <td>${p.duration_years} years</td>
        <td>${p.student_count}</td>
        <td>${p.course_count}</td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${p.id}">Delete</button>
        </div></td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function formBody(p = {}) {
    return `
      <div class="field"><label>Name *</label><input class="input" id="f_name" value="${esc(p.name || '')}" /></div>
      <div class="field"><label>Code</label><input class="input" id="f_code" maxlength="15" value="${esc(p.code || '')}" /></div>
      <div class="field"><label>Department *</label>
        <select class="select" id="f_department">
          ${state.departments.map(d => `<option value="${d.id}" ${p.department_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Duration (years)</label><input class="input" id="f_duration" type="number" min="1" max="7" value="${p.duration_years || 4}" /></div>
    `;
  }

  function openCreate() {
    openModal({
      title: 'New programme', confirmText: 'Create', body: formBody({}),
      onConfirm: async (bd, close) => {
        const payload = {
          name: bd.querySelector('#f_name').value.trim(),
          code: bd.querySelector('#f_code').value.trim() || null,
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          duration_years: parseInt(bd.querySelector('#f_duration').value, 10),
        };
        const { ok, data } = await api('/api/admin/programmes', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Programme created'); load();
      },
    });
  }

  function openEdit(id) {
    const p = state.items.find(x => x.id === id);
    if (!p) return;
    openModal({
      title: 'Edit programme', confirmText: 'Save changes', body: formBody(p),
      onConfirm: async (bd, close) => {
        const payload = {
          name: bd.querySelector('#f_name').value.trim(),
          code: bd.querySelector('#f_code').value.trim() || null,
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          duration_years: parseInt(bd.querySelector('#f_duration').value, 10),
        };
        const { ok, data } = await api('/api/admin/programmes/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Programme updated'); load();
      },
    });
  }

  function doDelete(id) {
    const p = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete programme?', subtitle: p ? p.name : '',
      message: 'This will not delete students or courses.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/programmes/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Programme deleted'); load();
      },
    });
  }

  function bindFilters() {
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 300);
    });
    $('#deptFilter').addEventListener('change', e => { state.department_id = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.search = ''; state.department_id = '';
      $('#searchInput').value = ''; $('#deptFilter').value = '';
      load();
    });
    $('#btnNew').addEventListener('click', openCreate);
  }

  async function boot() { await loadDepartments(); bindFilters(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();