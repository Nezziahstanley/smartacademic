'use strict';
(function () {
  const { $, api, esc, openModal } = window.SACrud;
  const state = { status: '' };
  const PRIORITY_BADGE = { low: 'badge-gray', medium: 'badge-blue', high: 'badge-orange', critical: 'badge-red' };
  const STATUS_BADGE = { Pending: 'badge-yellow', 'In Progress': 'badge-blue', Completed: 'badge-green', Closed: 'badge-gray' };

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.status) p.set('status', state.status);
    const { ok, data } = await api('/api/hod/interventions?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    if (!data.data.length) {
      $('#tbody').innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:40px;"><div class="empty-icon">🤝</div><h3>No interventions</h3><p>Create one from the Students page.</p></div></td></tr>';
      return;
    }
    $('#tbody').innerHTML = data.data.map(i => `
      <tr>
        <td>${esc(i.student_name)}<div style="font-size:12px;color:var(--ink-3);">${esc(i.matric_no)}</div></td>
        <td>${esc(i.title)}</td>
        <td><span class="badge badge-gray">${esc(i.type.replace(/_/g, ' '))}</span></td>
        <td>${esc(i.assignee_name || '—')}</td>
        <td><span class="badge ${PRIORITY_BADGE[i.priority]}">${esc(i.priority)}</span></td>
        <td><span class="badge ${STATUS_BADGE[i.status]}">${esc(i.status)}</span></td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${i.id}">Update</button>
        </div></td>
      </tr>`).join('');
    $('#tbody').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
  }

  function openEdit(id) {
    const i = [...document.querySelectorAll('[data-edit]')].length ? null : null;
    // fetch from state — simpler: reopen page state from API
    api('/api/hod/interventions').then(({ ok, data }) => {
      if (!ok) return;
      const item = data.data.find(x => x.id === id);
      if (!item) return;
      openModal({
        title: 'Update intervention', subtitle: item.student_name, confirmText: 'Save',
        body: `
          <div class="field"><label>Status</label>
            <select class="select" id="f_status">
              ${['Pending','In Progress','Completed','Closed'].map(s =>
                `<option value="${s}" ${item.status === s ? 'selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>
          <div class="field"><label>Priority</label>
            <select class="select" id="f_priority">
              ${['low','medium','high','critical'].map(p =>
                `<option value="${p}" ${item.priority === p ? 'selected' : ''}>${p}</option>`
              ).join('')}
            </select>
          </div>
          <div class="field"><label>Notes</label>
            <textarea class="textarea" id="f_notes" rows="3">${esc(item.notes || '')}</textarea>
          </div>
        `,
        onConfirm: async (bd, close) => {
          const payload = {
            status: bd.querySelector('#f_status').value,
            priority: bd.querySelector('#f_priority').value,
            notes: bd.querySelector('#f_notes').value.trim() || null,
          };
          const { ok } = await api('/api/hod/interventions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          if (!ok) { alert('Failed'); return; }
          close(); load();
        },
      });
    });
  }

  function bind() {
    $('#statusFilter').addEventListener('change', e => { state.status = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => { state.status = ''; $('#statusFilter').value = ''; load(); });
  }
  document.addEventListener('sa:layout-ready', () => { bind(); load(); });
})();