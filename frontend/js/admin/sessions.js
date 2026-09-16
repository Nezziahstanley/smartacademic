'use strict';
(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const state = { items: [] };

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="6"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const { ok, data } = await api('/api/admin/sessions');
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    state.items = data.data;
    render();
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:40px;"><div class="empty-icon">📅</div><h3>No sessions</h3></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(s => `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${esc(s.start_date || '—')}</td>
        <td>${esc(s.end_date || '—')}</td>
        <td>${s.semester_count}</td>
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
      <div class="field"><label>Name *</label><input class="input" id="f_name" placeholder="2024/2025" value="${esc(s.name || '')}" /></div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input class="input" id="f_start" type="date" value="${esc((s.start_date || '').slice(0,10))}" /></div>
        <div class="field"><label>End date</label><input class="input" id="f_end" type="date" value="${esc((s.end_date || '').slice(0,10))}" /></div>
      </div>
    `;
  }

  function openCreate() {
    openModal({
      title: 'New session', confirmText: 'Create', body: formBody({}),
      onConfirm: async (bd, close) => {
        const payload = {
          name: bd.querySelector('#f_name').value.trim(),
          start_date: bd.querySelector('#f_start').value || null,
          end_date: bd.querySelector('#f_end').value || null,
        };
        const { ok, data } = await api('/api/admin/sessions', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Session created'); load();
      },
    });
  }

  function openEdit(id) {
    const s = state.items.find(x => x.id === id);
    if (!s) return;
    openModal({
      title: 'Edit session', confirmText: 'Save changes', body: formBody(s),
      onConfirm: async (bd, close) => {
        const payload = {
          name: bd.querySelector('#f_name').value.trim(),
          start_date: bd.querySelector('#f_start').value || null,
          end_date: bd.querySelector('#f_end').value || null,
        };
        const { ok, data } = await api('/api/admin/sessions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Session updated'); load();
      },
    });
  }

  function doActivate(id) {
    const s = state.items.find(x => x.id === id);
    openModal({
      title: 'Activate session?', subtitle: s ? s.name : '', size: 'sm', confirmText: 'Activate',
      body: '<p>Other sessions will be deactivated automatically.</p>',
      onConfirm: async (_b, close) => {
        const { ok } = await api('/api/admin/sessions/' + id, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
        if (!ok) { alert('Failed'); return; }
        close(); toast('Session activated'); load();
      },
    });
  }

  function doDelete(id) {
    const s = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete session?', subtitle: s ? s.name : '',
      message: 'All semesters and related records will be removed.',
      onConfirm: async () => {
        const { ok } = await api('/api/admin/sessions/' + id, { method: 'DELETE' });
        if (!ok) { alert('Failed'); return; }
        toast('Deleted'); load();
      },
    });
  }

  function boot() { $('#btnNew').addEventListener('click', openCreate); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();