'use strict';
(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const state = { items: [], sessions: [], session_id: '' };

  async function loadSessions() {
    const { ok, data } = await api('/api/admin/sessions');
    if (ok) {
      state.sessions = data.data;
      $('#sessFilter').innerHTML = '<option value="">All sessions</option>' +
        data.data.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    }
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="6"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const url = '/api/admin/semesters' + (state.session_id ? '?session_id=' + state.session_id : '');
    const { ok, data } = await api(url);
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    state.items = data.data;
    render();
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:40px;"><div class="empty-icon">🗓️</div><h3>No semesters</h3></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(s => `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${esc(s.session_name)}</td>
        <td>${esc((s.start_date || '—').toString().slice(0,10))}</td>
        <td>${esc((s.end_date || '—').toString().slice(0,10))}</td>
        <td>${s.is_active
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-gray">Inactive</span>'}</td>
        <td><div class="actions">
          ${!s.is_active ? `<button class="btn btn-ghost btn-sm" data-activate="${s.id}">Activate</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${s.id}">Delete</button>
        </div></td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
    body.querySelectorAll('[data-activate]').forEach(b => b.addEventListener('click', () => doActivate(parseInt(b.dataset.activate, 10))));
  }

  function formBody(s = {}) {
    return `
      <div class="field"><label>Session *</label>
        <select class="select" id="f_session">
          ${state.sessions.map(x => `<option value="${x.id}" ${s.session_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Name *</label>
        <select class="select" id="f_name">
          ${['First','Second','Summer'].map(n => `<option value="${n}" ${s.name === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input class="input" id="f_start" type="date" value="${esc((s.start_date || '').toString().slice(0,10))}" /></div>
        <div class="field"><label>End date</label><input class="input" id="f_end" type="date" value="${esc((s.end_date || '').toString().slice(0,10))}" /></div>
      </div>
    `;
  }

  function openCreate() {
    openModal({
      title: 'New semester', confirmText: 'Create', body: formBody({}),
      onConfirm: async (bd, close) => {
        const payload = {
          session_id: parseInt(bd.querySelector('#f_session').value, 10),
          name: bd.querySelector('#f_name').value,
          start_date: bd.querySelector('#f_start').value || null,
          end_date: bd.querySelector('#f_end').value || null,
        };
        const { ok, data } = await api('/api/admin/semesters', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Semester created'); load();
      },
    });
  }

  function openEdit(id) {
    const s = state.items.find(x => x.id === id);
    if (!s) return;
    openModal({
      title: 'Edit semester', confirmText: 'Save changes', body: formBody(s),
      onConfirm: async (bd, close) => {
        const payload = {
          session_id: parseInt(bd.querySelector('#f_session').value, 10),
          name: bd.querySelector('#f_name').value,
          start_date: bd.querySelector('#f_start').value || null,
          end_date: bd.querySelector('#f_end').value || null,
        };
        const { ok, data } = await api('/api/admin/semesters/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Semester updated'); load();
      },
    });
  }

  function doActivate(id) {
    openModal({
      title: 'Activate semester?', size: 'sm', confirmText: 'Activate',
      body: '<p>Other semesters will be deactivated.</p>',
      onConfirm: async (_b, close) => {
        const { ok } = await api('/api/admin/semesters/' + id, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
        if (!ok) { alert('Failed'); return; }
        close(); toast('Activated'); load();
      },
    });
  }

  function doDelete(id) {
    confirmDelete({
      title: 'Delete semester?',
      message: 'This will remove all related records.',
      onConfirm: async () => {
        const { ok } = await api('/api/admin/semesters/' + id, { method: 'DELETE' });
        if (!ok) { alert('Failed'); return; }
        toast('Deleted'); load();
      },
    });
  }

  function boot() {
    $('#btnNew').addEventListener('click', openCreate);
    $('#sessFilter').addEventListener('change', e => { state.session_id = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => { state.session_id = ''; $('#sessFilter').value = ''; load(); });
    loadSessions().then(load);
  }
  document.addEventListener('sa:layout-ready', boot);
})();