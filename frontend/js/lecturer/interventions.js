'use strict';
(function () {
  const { $, api, esc, openModal } = window.SACrud;
  const STATUS_BADGE = { Pending: 'badge-yellow', 'In Progress': 'badge-blue', Completed: 'badge-green', Closed: 'badge-gray' };
  const PRIORITY_BADGE = { low: 'badge-gray', medium: 'badge-blue', high: 'badge-orange', critical: 'badge-red' };

  async function load() {
    const { ok, data } = await api('/api/lecturer/interventions');
    if (!ok) return;
    if (!data.data.length) {
      $('#tbody').innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:40px;"><div class="empty-icon">🤝</div><h3>No interventions assigned</h3></div></td></tr>';
      return;
    }
    $('#tbody').innerHTML = data.data.map(i => `
      <tr>
        <td>${esc(i.student_name)}<div style="font-size:12px;color:var(--ink-3);">${esc(i.matric_no)}</div></td>
        <td>${esc(i.title)}</td>
        <td><span class="badge badge-gray">${esc(i.type.replace(/_/g,' '))}</span></td>
        <td><span class="badge ${PRIORITY_BADGE[i.priority]}">${esc(i.priority)}</span></td>
        <td><span class="badge ${STATUS_BADGE[i.status]}">${esc(i.status)}</span></td>
        <td><button class="btn btn-ghost btn-sm" data-update="${i.id}">Update</button></td>
      </tr>`).join('');
    $('#tbody').querySelectorAll('[data-update]').forEach(b => b.addEventListener('click', () => openUpdate(parseInt(b.dataset.update, 10), data.data)));
  }

  function openUpdate(id, items) {
    const item = items.find(x => x.id === id);
    if (!item) return;
    openModal({
      title: 'Update intervention', subtitle: item.student_name, size: 'sm', confirmText: 'Save',
      body: `
        <div class="field"><label>Status</label>
          <select class="select" id="f_status">
            ${['Pending','In Progress','Completed','Closed'].map(s =>
              `<option value="${s}" ${item.status === s ? 'selected' : ''}>${s}</option>`
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
          notes: bd.querySelector('#f_notes').value.trim() || null,
        };
        const { ok } = await api('/api/lecturer/interventions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert('Failed'); return; }
        close(); load();
      },
    });
  }
  document.addEventListener('sa:layout-ready', load);
})();