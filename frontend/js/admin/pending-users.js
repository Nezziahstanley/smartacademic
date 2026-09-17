// ============================================================
// SMARTACADEMIC — Admin Pending Users
// Lists users with is_active = FALSE.
// Approve / Reject with auto-refresh + feedback.
// ============================================================

'use strict';

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);

  function token() { return localStorage.getItem('sa_token'); }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: {
        'Authorization': 'Bearer ' + token(),
        'Content-Type': 'application/json',
      },
      ...opts,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      padding:12px 18px; border-radius:10px; font-size:14px; font-weight:600;
      box-shadow:0 10px 30px rgba(0,0,0,.18);
      background:${type === 'error' ? '#fee2e2' : '#dcfce7'};
      color:${type === 'error' ? '#991b1b' : '#166534'};
      transform:translateY(20px); opacity:0; transition:.25s;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)'; el.style.opacity = '1';
    });
    setTimeout(() => {
      el.style.transform = 'translateY(20px)'; el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  function confirmDialog({ title, message, confirmText = 'Confirm', danger = false, onConfirm }) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed; inset:0; z-index:9998; background:rgba(15,23,42,.55);
      backdrop-filter:blur(4px); display:grid; place-items:center; padding:20px;
    `;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25);">
        <h2 style="margin:0 0 10px;font-size:18px;">${esc(title)}</h2>
        <p style="margin:0 0 20px;color:var(--ink-3);line-height:1.5;">${esc(message)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-ghost" data-cancel type="button">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm type="button">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('[data-cancel]').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('[data-confirm]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Working...';
      try {
        await onConfirm();
      } finally {
        close();
      }
    });
  }

  /* ============================================================
     LOAD
     ============================================================ */
  async function load() {
    const tbody = $('#tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const { ok, data } = await api('/api/admin/pending-users');
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    const items = data.data || [];

    if (!items.length) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">✅</div>
            <h3>No pending registrations</h3>
            <p>All students have been reviewed.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(u => `
      <tr data-row-id="${u.id}">
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

    tbody.querySelectorAll('[data-approve]').forEach(b =>
      b.addEventListener('click', () => approve(parseInt(b.dataset.approve, 10))));
    tbody.querySelectorAll('[data-reject]').forEach(b =>
      b.addEventListener('click', () => reject(parseInt(b.dataset.reject, 10))));
  }

  /* ============================================================
     APPROVE
     ============================================================ */
  async function approve(id) {
    // Find the row so we can show its info in the toast
    const row = document.querySelector(`tr[data-row-id="${id}"]`);
    const name = row ? row.querySelector('td strong')?.textContent : 'user';

    // Show loading state on button
    const btn = row?.querySelector(`[data-approve="${id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

    const { ok, data } = await api(`/api/admin/pending-users/${id}/approve`, {
      method: 'POST',
    });

    if (!ok) {
      toast(data?.error || 'Failed to approve', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✓ Approve'; }
      return;
    }

    toast(`✅ ${name} approved successfully`);
    load();  // ← Auto-refresh the table
  }

  /* ============================================================
     REJECT
     ============================================================ */
  function reject(id) {
    const row = document.querySelector(`tr[data-row-id="${id}"]`);
    const name = row ? row.querySelector('td strong')?.textContent : 'this user';

    confirmDialog({
      title: 'Reject Registration?',
      message: `Reject and permanently remove ${name}'s registration? This cannot be undone.`,
      confirmText: 'Reject',
      danger: true,
      onConfirm: async () => {
        const { ok, data } = await api(`/api/admin/pending-users/${id}/reject`, {
          method: 'POST',
        });
        if (!ok) {
          toast(data?.error || 'Failed to reject', 'error');
          return;
        }
        toast(`Registration rejected`);
        load();  // ← Auto-refresh
      },
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    if (window.__pendingUsersBooted) return;
    window.__pendingUsersBooted = true;
    console.log('[admin/pending-users] booting...');
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();