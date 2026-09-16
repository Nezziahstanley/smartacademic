// ============================================================
// SMARTACADEMIC — Admin Pending Users
// Lists users with is_active = FALSE and lets admin approve/reject.
// ============================================================

'use strict';

(function () {
  const { $, api, esc, toast, confirmDelete } = window.SACrud;

  async function load() {
    $('#tbody').innerHTML =
      '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const { ok, data } = await api('/api/admin/pending-users');

    if (!ok) {
      $('#tbody').innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    if (!data.data.length) {
      $('#tbody').innerHTML = `
        <tr><td colspan="8">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">✅</div>
            <h3>No pending registrations</h3>
            <p>All students have been reviewed.</p>
          </div>
        </td></tr>`;
      return;
    }

    $('#tbody').innerHTML = data.data.map(u => `
      <tr>
        <td><strong>${esc(u.full_name)}</strong></td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.matric_no || '—')}</td>
        <td>${esc(u.department_name || '—')}</td>
        <td>${esc(u.programme_name || '—')}</td>
        <td>${u.level || '—'}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          <div class="actions">
            <button class="btn btn-primary btn-sm" data-approve="${u.id}">✓ Approve</button>
            <button class="btn btn-danger btn-sm" data-reject="${u.id}">✕ Reject</button>
          </div>
        </td>
      </tr>`).join('');

    $('#tbody').querySelectorAll('[data-approve]').forEach(b =>
      b.addEventListener('click', () => approve(parseInt(b.dataset.approve, 10))));
    $('#tbody').querySelectorAll('[data-reject]').forEach(b =>
      b.addEventListener('click', () => reject(parseInt(b.dataset.reject, 10))));
  }

  async function approve(id) {
    const { ok, data } = await api('/api/admin/pending-users/' + id + '/approve', { method: 'POST' });
    if (!ok) { alert(data?.error || 'Failed to approve'); return; }
    toast('✅ Approved');
    load();
  }

  function reject(id) {
    confirmDelete({
      title: 'Reject registration?',
      message: 'The pending account will be permanently removed.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/pending-users/' + id + '/reject', { method: 'POST' });
        if (!ok) { alert(data?.error || 'Failed to reject'); return; }
        toast('Registration rejected');
        load();
      },
    });
  }

  document.addEventListener('sa:layout-ready', load);
})();