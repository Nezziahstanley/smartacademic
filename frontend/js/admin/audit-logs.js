'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  const state = { page: 1, limit: 25, module: '', search: '', total: 0, items: [] };

  async function loadModules() {
    const { ok, data } = await api('/api/admin/audit-logs/modules');
    if (ok) {
      $('#moduleFilter').innerHTML = '<option value="">All modules</option>' +
        data.data.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    }
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="6"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams({ page: state.page, limit: state.limit });
    if (state.module) p.set('module', state.module);
    if (state.search) p.set('search', state.search);
    const { ok, data } = await api('/api/admin/audit-logs?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    state.items = data.data.items;
    state.total = data.data.total;
    render();
    pagination();
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:40px;"><div class="empty-icon">📜</div><h3>No audit logs</h3></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(l => `
      <tr>
        <td>${new Date(l.created_at).toLocaleString()}</td>
        <td>${esc(l.full_name || 'System')}</td>
        <td><code style="font-size:12px;background:var(--bg);padding:2px 6px;border-radius:4px;">${esc(l.action)}</code></td>
        <td><span class="badge badge-gray">${esc(l.module || '—')}</span></td>
        <td>${esc(l.affected_record || '—')}</td>
        <td style="font-size:12px;color:var(--ink-3);">${esc(l.ip_address || '—')}</td>
      </tr>`).join('');
  }

  function pagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    $('#paginationInfo').textContent = state.total === 0 ? 'No results'
      : `Showing ${(state.page - 1) * state.limit + 1}–${Math.min(state.page * state.limit, state.total)} of ${state.total}`;
    const nums = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    $('#paginationButtons').innerHTML = `
      <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>
      ${nums.map(n => n === '…' ? '<button disabled>…</button>' : `<button class="${n === state.page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('')}
      <button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;
    $('#paginationButtons').querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
      const p = parseInt(b.dataset.page, 10);
      if (p >= 1 && p <= totalPages) { state.page = p; load(); }
    }));
  }

  function bind() {
    $('#moduleFilter').addEventListener('change', e => { state.module = e.target.value; state.page = 1; load(); });
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 300);
    });
    $('#btnReset').addEventListener('click', () => {
      state.module = ''; state.search = ''; state.page = 1;
      $('#moduleFilter').value = ''; $('#searchInput').value = '';
      load();
    });
  }

  async function boot() { await loadModules(); bind(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();