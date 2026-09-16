// ============================================================
// SMARTACADEMIC — Admin Users Management
// List, search, filter, create, edit, activate/deactivate,
// reset password, delete. Uses a reusable modal.
// ============================================================

'use strict';

(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- State ---------- */
  const state = {
    page: 1,
    limit: 10,
    search: '',
    role: '',
    isActive: '',
    total: 0,
    items: [],
  };

  /* ---------- Auth helpers ---------- */
  const getToken = () => localStorage.getItem('sa_token');
  const authH = () => ({ Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' });

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: authH(), ...opts });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  /* ---------- Utilities ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(name) {
    return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
  }
  function roleLabel(r) {
    return { admin: 'Administrator', hod: 'HOD', lecturer: 'Lecturer', student: 'Student' }[r] || r;
  }

  /* ============================================================
     MODAL
     ============================================================ */
  function openModal({ title, subtitle = '', body, confirmText = 'Save', onConfirm, size = '' }) {
    const root = $('#modalRoot');
    const id = 'modal_' + Date.now();

    root.innerHTML = `
      <div class="modal-backdrop open" data-modal="${id}">
        <div class="modal ${size}">
          <div class="modal-head">
            <div>
              <h3>${esc(title)}</h3>
              <p>${esc(subtitle)}</p>
            </div>
            <button class="modal-close" data-close>×</button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn btn-primary" data-confirm>${esc(confirmText)}</button>
          </div>
        </div>
      </div>`;

    const backdrop = root.querySelector('.modal-backdrop');

    function close() { backdrop.remove(); }

    backdrop.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    const confirmBtn = backdrop.querySelector('[data-confirm]');
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Working...';
      try {
        await onConfirm(backdrop, close);
      } catch (err) {
        console.error(err);
        confirmBtn.disabled = false;
        confirmBtn.textContent = confirmText;
      }
    });

    // Focus first input
    const firstInput = backdrop.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);

    return { close, backdrop };
  }

  /* ============================================================
     LOAD LIST
     ============================================================ */
  async function loadUsers() {
    const params = new URLSearchParams({
      page: state.page,
      limit: state.limit,
    });
    if (state.search)   params.set('search', state.search);
    if (state.role)     params.set('role', state.role);
    if (state.isActive !== '') params.set('is_active', state.isActive);

    const body = $('#usersBody');
    body.innerHTML = `
      <tr><td colspan="6"><div class="skeleton" style="height: 22px;"></div></td></tr>
      <tr><td colspan="6"><div class="skeleton" style="height: 22px;"></div></td></tr>`;

    const { ok, data } = await api('/api/admin/users?' + params.toString());
    if (!ok || !data.success) {
      body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--red);">Failed to load users.</td></tr>`;
      return;
    }

    state.items = data.data.items;
    state.total = data.data.total;

    renderTable();
    renderPagination();
  }

  function renderTable() {
    const body = $('#usersBody');
    if (state.items.length === 0) {
      body.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty" style="padding:40px 20px;">
              <div class="empty-icon">👥</div>
              <h3>No users found</h3>
              <p>Try adjusting filters or create a new user.</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    body.innerHTML = state.items.map(u => {
      const statusBadge = u.is_active
        ? '<span class="badge badge-green">Active</span>'
        : '<span class="badge badge-gray">Inactive</span>';

      const roleBadgeClass = {
        admin: 'badge-blue', hod: 'badge-blue',
        lecturer: 'badge-blue', student: 'badge-gray',
      }[u.role_name] || 'badge-gray';

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="profile-avatar" style="width:32px;height:32px;font-size:12px;">${esc(initials(u.full_name))}</span>
              <div>
                <div style="font-weight:600;color:var(--ink);">${esc(u.full_name)}</div>
                <div style="font-size:12px;color:var(--ink-3);">${esc(u.phone || '—')}</div>
              </div>
            </div>
          </td>
          <td>${esc(u.email)}</td>
          <td><span class="badge ${roleBadgeClass}">${esc(roleLabel(u.role_name))}</span></td>
          <td>${statusBadge}</td>
          <td>${fmtDate(u.last_login_at)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${u.id}">Edit</button>
              <button class="btn btn-ghost btn-sm" data-action="toggle" data-id="${u.id}">
                ${u.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button class="btn btn-ghost btn-sm" data-action="menu" data-id="${u.id}">⋯</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    // Wire row actions
    body.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, parseInt(btn.dataset.id, 10)));
    });
  }

  /* ============================================================
     PAGINATION
     ============================================================ */
  function renderPagination() {
    const info = $('#paginationInfo');
    const buttons = $('#paginationButtons');
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));

    const start = (state.page - 1) * state.limit + 1;
    const end = Math.min(state.page * state.limit, state.total);
    info.textContent = state.total === 0
      ? 'No results'
      : `Showing ${start}–${end} of ${state.total}`;

    const nums = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }

    buttons.innerHTML = `
      <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>
      ${nums.map(n => n === '…'
        ? `<button disabled>…</button>`
        : `<button class="${n === state.page ? 'active' : ''}" data-page="${n}">${n}</button>`
      ).join('')}
      <button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>
    `;

    buttons.querySelectorAll('[data-page]').forEach(b => {
      b.addEventListener('click', () => {
        const p = parseInt(b.dataset.page, 10);
        if (p >= 1 && p <= totalPages) { state.page = p; loadUsers(); }
      });
    });
  }

  /* ============================================================
     ACTIONS
     ============================================================ */
  async function handleAction(action, id) {
    const user = state.items.find(u => u.id === id);
    if (!user) return;

    if (action === 'edit') return openEditModal(user);
    if (action === 'toggle') return toggleActive(user);
    if (action === 'menu') return openRowMenu(user);
  }

  /* ---------- Toggle active ---------- */
  async function toggleActive(user) {
    const verb = user.is_active ? 'deactivate' : 'activate';
    openModal({
      title: `${verb[0].toUpperCase() + verb.slice(1)} user?`,
      subtitle: user.full_name,
      size: 'sm',
      confirmText: verb[0].toUpperCase() + verb.slice(1),
      body: `<p>Are you sure you want to ${verb} <strong>${esc(user.full_name)}</strong>?</p>`,
      onConfirm: async (_bd, close) => {
        const { ok, data } = await api(`/api/admin/users/${user.id}/toggle-active`, { method: 'POST' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        loadUsers();
      },
    });
  }

  /* ---------- Edit modal ---------- */
  function openEditModal(user) {
    const body = `
      <div class="field">
        <label>Full name</label>
        <input class="input" id="m_full_name" value="${esc(user.full_name)}" />
      </div>
      <div class="field">
        <label>Email</label>
        <input class="input" id="m_email" type="email" value="${esc(user.email)}" />
      </div>
      <div class="field">
        <label>Phone</label>
        <input class="input" id="m_phone" value="${esc(user.phone || '')}" />
      </div>
      <div class="field">
        <label>Role</label>
        <select class="select" id="m_role">
          ${['admin','hod','lecturer','student'].map(r =>
            `<option value="${r}" ${user.role_name === r ? 'selected' : ''}>${roleLabel(r)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label>Status</label>
        <select class="select" id="m_active">
          <option value="true" ${user.is_active ? 'selected' : ''}>Active</option>
          <option value="false" ${!user.is_active ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      <div style="border-top:1px solid var(--border); padding-top:16px; margin-top:16px;">
        <button type="button" class="btn btn-ghost btn-sm" id="m_reset_pw_btn">🔑 Reset password</button>
      </div>
    `;

    openModal({
      title: 'Edit user',
      subtitle: user.email,
      body,
      confirmText: 'Save changes',
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#m_full_name').value.trim(),
          email:     bd.querySelector('#m_email').value.trim(),
          phone:     bd.querySelector('#m_phone').value.trim() || null,
          role:      bd.querySelector('#m_role').value,
          is_active: bd.querySelector('#m_active').value === 'true',
        };
        const { ok, data } = await api(`/api/admin/users/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        loadUsers();
      },
    });

    // Wire reset password button after modal renders
    setTimeout(() => {
      const btn = document.getElementById('m_reset_pw_btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        document.querySelector('.modal-backdrop')?.remove();
        openResetPasswordModal(user);
      });
    }, 30);
  }

  /* ---------- Reset password modal ---------- */
  function openResetPasswordModal(user) {
    const body = `
      <p style="margin-bottom:14px;color:var(--ink-3);font-size:14px;">
        A new password will be set for <strong>${esc(user.full_name)}</strong>.
        They must change it on next login.
      </p>
      <div class="field">
        <label>New password</label>
        <input class="input" id="m_new_pw" type="text" value="Temp@${Math.random().toString(36).slice(2,8)}" />
      </div>
    `;
    openModal({
      title: 'Reset password',
      subtitle: user.email,
      size: 'sm',
      confirmText: 'Reset password',
      body,
      onConfirm: async (bd, close) => {
        const new_password = bd.querySelector('#m_new_pw').value;
        if (!new_password || new_password.length < 6) {
          alert('Password must be at least 6 characters.'); return;
        }
        const { ok, data } = await api(`/api/admin/users/${user.id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ new_password }),
        });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        alert('Password reset to: ' + new_password);
        close();
      },
    });
  }

  /* ---------- Row menu (delete) ---------- */
  function openRowMenu(user) {
    const body = `
      <p style="margin-bottom:14px;color:var(--ink-3);font-size:14px;">
        Actions for <strong>${esc(user.full_name)}</strong>:
      </p>
      <button type="button" class="btn btn-ghost w-full mb-2" id="m_reset_pw">🔑 Reset password</button>
      <button type="button" class="btn btn-danger w-full" id="m_delete">🗑️ Delete user</button>
    `;
    openModal({
      title: 'More actions',
      subtitle: user.email,
      size: 'sm',
      confirmText: 'Close',
      body,
      onConfirm: (_b, close) => close(),
    });

    setTimeout(() => {
      document.getElementById('m_reset_pw')?.addEventListener('click', () => {
        document.querySelector('.modal-backdrop')?.remove();
        openResetPasswordModal(user);
      });
      document.getElementById('m_delete')?.addEventListener('click', () => {
        document.querySelector('.modal-backdrop')?.remove();
        confirmDelete(user);
      });
    }, 30);
  }

  function confirmDelete(user) {
    openModal({
      title: 'Delete user?',
      subtitle: user.full_name,
      size: 'sm',
      confirmText: 'Delete',
      body: `<p style="color:var(--red);">This action cannot be undone.</p>`,
      onConfirm: async (_b, close) => {
        const { ok, data } = await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        loadUsers();
      },
    });
  }

  /* ---------- Create modal ---------- */
  function openCreateModal() {
    const body = `
      <div class="field">
        <label>Full name <span style="color:var(--red)">*</span></label>
        <input class="input" id="m_full_name" placeholder="Jane Doe" />
      </div>
      <div class="field">
        <label>Email <span style="color:var(--red)">*</span></label>
        <input class="input" id="m_email" type="email" placeholder="jane@institution.edu" />
      </div>
      <div class="field">
        <label>Phone</label>
        <input class="input" id="m_phone" placeholder="+234 800 000 0000" />
      </div>
      <div class="field">
        <label>Role <span style="color:var(--red)">*</span></label>
        <select class="select" id="m_role">
          <option value="student">Student</option>
          <option value="lecturer">Lecturer</option>
          <option value="hod">HOD</option>
          <option value="admin">Administrator</option>
        </select>
      </div>
      <div class="field">
        <label>Password <span style="color:var(--red)">*</span></label>
        <input class="input" id="m_password" type="password" value="Welcome@${Math.random().toString(36).slice(2,6)}" />
        <p style="font-size:12px;color:var(--ink-3);margin-top:6px;">User must change this on first login.</p>
      </div>
    `;
    openModal({
      title: 'New user',
      subtitle: 'Create an account',
      confirmText: 'Create user',
      body,
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#m_full_name').value.trim(),
          email:     bd.querySelector('#m_email').value.trim(),
          phone:     bd.querySelector('#m_phone').value.trim() || null,
          role:      bd.querySelector('#m_role').value,
          password:  bd.querySelector('#m_password').value,
        };
        const { ok, data } = await api('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!ok) {
          let msg = data?.error || 'Failed';
          if (Array.isArray(data?.details)) msg = data.details.map(d => `${d.field}: ${d.message}`).join(' · ');
          alert(msg); return;
        }
        close();
        loadUsers();
      },
    });
  }

  function openInviteModal() {
    openModal({
      title: 'Invite a user',
      subtitle: 'Send them a registration link by email',
      confirmText: 'Send Invitation',
      body: `
        <div class="field">
          <label>Email *</label>
          <input class="input" id="inv_email" type="email" placeholder="jane@example.edu" />
        </div>
        <div class="field">
          <label>Full name</label>
          <input class="input" id="inv_name" placeholder="Optional" />
        </div>
        <div class="field">
          <label>Role</label>
          <select class="select" id="inv_role">
            <option value="student">Student</option>
            <option value="lecturer">Lecturer</option>
            <option value="hod">HOD</option>
          </select>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          email: bd.querySelector('#inv_email').value.trim(),
          full_name: bd.querySelector('#inv_name').value.trim() || null,
          role: bd.querySelector('#inv_role').value,
        };
        if (!payload.email) { alert('Email required'); return; }
        const { ok, data } = await api('/api/auth/invite', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        alert(
          '✅ Invitation created.\n\n' +
          (data.link ? 'Dev link (share with user):\n' + data.link : 'Email sent.')
        );
      },
    });
  }
  /* ============================================================
     FILTERS
     ============================================================ */
  function bindFilters() {
    let t;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        loadUsers();
      }, 300);
    });

    $('#roleFilter').addEventListener('change', (e) => {
      state.role = e.target.value;
      state.page = 1;
      loadUsers();
    });

    $('#statusFilter').addEventListener('change', (e) => {
      state.isActive = e.target.value;
      state.page = 1;
      loadUsers();
    });

    $('#btnReset').addEventListener('click', () => {
      state.search = ''; state.role = ''; state.isActive = ''; state.page = 1;
      $('#searchInput').value = '';
      $('#roleFilter').value = '';
      $('#statusFilter').value = '';
      loadUsers();
    });

    $('#btnNewUser').addEventListener('click', openCreateModal);
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    bindFilters();
    loadUsers();
  }
  const invBtn = document.getElementById('btnInvite');
  if (invBtn) invBtn.addEventListener('click', openInviteModal);

  document.addEventListener('sa:layout-ready', boot);
})();