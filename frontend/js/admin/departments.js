'use strict';
(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const state = { items: [], hods: [], search: '' };

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const url = '/api/admin/departments' + (state.search ? '?search=' + encodeURIComponent(state.search) : '');
    const { ok, data } = await api(url);
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>'; return; }
    state.items = data.data;
    render();
  }

  async function loadHods() {
    const { ok, data } = await api('/api/admin/departments/hod-candidates');
    if (ok) state.hods = data.data;
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:40px;"><div class="empty-icon">🏛️</div><h3>No departments</h3></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(d => `
      <tr>
        <td><strong>${esc(d.name)}</strong></td>
        <td><span class="badge badge-gray">${esc(d.code || '—')}</span></td>
        <td>${esc(d.hod_name || '—')}</td>
        <td>${d.student_count}</td>
        <td>${d.lecturer_count}</td>
        <td>${d.course_count}</td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${d.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${d.id}">Delete</button>
        </div></td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function formBody(d = {}) {
    return `
      <div class="field"><label>Name *</label><input class="input" id="f_name" value="${esc(d.name || '')}" /></div>
      <div class="field"><label>Code</label><input class="input" id="f_code" maxlength="10" value="${esc(d.code || '')}" /></div>
      <div class="field"><label>HOD</label>
        <select class="select" id="f_hod">
          <option value="">— None —</option>
          ${state.hods.map(h => `<option value="${h.id}" ${d.hod_id === h.id ? 'selected' : ''}>${esc(h.full_name)} (${esc(h.email)})</option>`).join('')}
        </select>
      </div>
    `;
  }

  function openCreate() {
    openModal({
      title: 'New department', confirmText: 'Create', body: formBody({}),
      onConfirm: async (bd, close) => {
        const payload = {
          name: bd.querySelector('#f_name').value.trim(),
          code: bd.querySelector('#f_code').value.trim() || null,
          hod_id: parseInt(bd.querySelector('#f_hod').value, 10) || null,
        };
        const { ok, data } = await api('/api/admin/departments', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Department created'); load();
      },
    });
  }

  function openEdit(id) {
    const d = state.items.find(x => x.id === id);
    if (!d) return;
    openModal({
      title: 'Edit department', confirmText: 'Save changes', body: formBody(d),
      onConfirm: async (bd, close) => {
        const payload = {
          name: bd.querySelector('#f_name').value.trim(),
          code: bd.querySelector('#f_code').value.trim() || null,
          hod_id: parseInt(bd.querySelector('#f_hod').value, 10) || null,
        };
        const { ok, data } = await api('/api/admin/departments/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Department updated'); load();
      },
    });
  }

  function doDelete(id) {
    const d = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete department?', subtitle: d ? d.name : '',
      message: 'Only empty departments should be deleted.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/departments/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Department deleted'); load();
      },
    });
  }

  function bindFilters() {
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 300);
    });
    $('#btnReset').addEventListener('click', () => { state.search = ''; $('#searchInput').value = ''; load(); });
    $('#btnNew').addEventListener('click', openCreate);
  }

  async function boot() { await loadHods(); bindFilters(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();