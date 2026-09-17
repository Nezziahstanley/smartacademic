// ============================================================
// HOD Result Submissions — bulk approve / return
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
    return { ok: res.ok, data: await res.json().catch(() => null) };
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

  const state = {
    status: 'submitted',
    items: [],
    selected: new Set(),
  };

  async function load() {
    const tbody = $('#tbody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';
    state.selected.clear();
    updateBulkBar();

    const { ok, data } = await api('/api/hod/result-submissions?status=' + state.status);
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];

    if (!state.items.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty" style="padding:40px;"><div class="empty-icon">📊</div><h3>No ${state.status} submissions</h3></div></td></tr>`;
      return;
    }

    const showCheckbox = state.status === 'submitted';

    tbody.innerHTML = state.items.map(s => {
      const checked = state.selected.has(s.course_id) ? 'checked' : '';
      return `
        <tr>
          <td class="cb-cell">
            ${showCheckbox ? `<input type="checkbox" data-select="${s.course_id}" data-session="${s.session_id}" data-semester="${s.semester_id}" ${checked} />` : ''}
          </td>
          <td><strong>${esc(s.code)}</strong> — ${esc(s.title)}<div style="font-size:12px;color:var(--ink-3);">Level ${s.level}</div></td>
          <td>${esc(s.lecturer_name || '—')}</td>
          <td>${esc(s.session_name)}</td>
          <td>${esc(s.semester_name)}</td>
          <td>${s.students}</td>
          <td>${s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</td>
          <td>
            <div class="actions">
              <button class="btn btn-ghost btn-sm" data-view="${s.course_id}" data-session="${s.session_id}" data-semester="${s.semester_id}">View</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-select]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.dataset.select, 10);
        if (cb.checked) state.selected.add(id);
        else state.selected.delete(id);
        updateBulkBar();
        updateCheckAll();
      });
    });

    tbody.querySelectorAll('[data-view]').forEach(b =>
      b.addEventListener('click', () => viewDetails(b.dataset)));

    updateCheckAll();
  }

  function updateBulkBar() {
    const bar = $('#bulkBar');
    const count = state.selected.size;
    $('#bulkCount').textContent = count;
    bar.classList.toggle('active', count > 0 && state.status === 'submitted');
  }

  function updateCheckAll() {
    const checkAll = $('#checkAll');
    if (state.status !== 'submitted') { checkAll.style.display = 'none'; return; }
    checkAll.style.display = '';

    const ids = state.items.map(i => i.course_id);
    const all = ids.length > 0 && ids.every(id => state.selected.has(id));
    const any = ids.some(id => state.selected.has(id));
    checkAll.checked = all;
    checkAll.indeterminate = !all && any;
  }

  async function viewDetails(ds) {
    const { ok, data } = await api(`/api/hod/result-submissions/${ds.view}?session_id=${ds.session}&semester_id=${ds.semester}`);
    if (!ok) { alert('Failed to load'); return; }

    const { course, results } = data.data;
    const html = `
      <div class="table-wrap" style="box-shadow:none;max-height:500px;overflow-y:auto;">
        <table class="table">
          <thead><tr><th>Student</th><th>Matric</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead>
          <tbody>
            ${results.map(r => `
              <tr>
                <td>${esc(r.student_name)}</td>
                <td>${esc(r.matric_no)}</td>
                <td>${parseFloat(r.ca_score || 0).toFixed(1)}</td>
                <td>${parseFloat(r.exam_score || 0).toFixed(1)}</td>
                <td><strong>${parseFloat(r.total_score || 0).toFixed(1)}</strong></td>
                <td><span class="badge badge-${r.grade === 'A' ? 'green' : r.grade === 'F' ? 'red' : 'blue'}">${esc(r.grade || '—')}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);display:grid;place-items:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:720px;width:100%;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;font-size:20px;">${esc(course.code)} — ${esc(course.title)}</h2>
            <p style="margin:4px 0 0;color:var(--ink-3);">${results.length} students</p>
          </div>
          <button data-close style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
        </div>
        ${html}
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  async function bulkApprove() {
    const ids = Array.from(state.selected);
    if (!ids.length) { toast('Nothing selected'); return; }
    if (!confirm(`Approve ${ids.length} course(s)?`)) return;

    const first = state.items.find(i => i.course_id === ids[0]);
    const btn = $('#btnBulkApprove');
    btn.disabled = true;
    btn.textContent = '⏳ Approving...';

    try {
      const { ok, data } = await api('/api/hod/result-submissions/approve-bulk', {
        method: 'POST',
        body: JSON.stringify({
          course_ids: ids,
          session_id: first.session_id,
          semester_id: first.semester_id,
        }),
      });
      if (!ok) { alert(data?.error || 'Failed'); return; }
      toast(data.message || `Approved ${ids.length} course(s)`);
      load();
    } finally {
      btn.disabled = false;
      btn.textContent = '✓ Approve All';
    }
  }

  async function bulkReturn() {
    const ids = Array.from(state.selected);
    if (!ids.length) { toast('Nothing selected'); return; }

    const reason = prompt('Reason for returning (required):');
    if (!reason) return;

    const first = state.items.find(i => i.course_id === ids[0]);
    const btn = $('#btnBulkReturn');
    btn.disabled = true;
    btn.textContent = '⏳ Returning...';

    try {
      const { ok, data } = await api('/api/hod/result-submissions/return-bulk', {
        method: 'POST',
        body: JSON.stringify({
          course_ids: ids,
          session_id: first.session_id,
          semester_id: first.semester_id,
          reason,
        }),
      });
      if (!ok) { alert(data?.error || 'Failed'); return; }
      toast(data.message || `Returned ${ids.length} course(s)`);
      load();
    } finally {
      btn.disabled = false;
      btn.textContent = '↩ Return Selected';
    }
  }

  function bind() {
    $('#statusFilter').addEventListener('change', e => {
      state.status = e.target.value;
      load();
    });

    $('#checkAll').addEventListener('change', (e) => {
      if (e.target.checked) state.items.forEach(i => state.selected.add(i.course_id));
      else state.selected.clear();

      document.querySelectorAll('[data-select]').forEach(cb => {
        cb.checked = state.selected.has(parseInt(cb.dataset.select, 10));
      });
      updateBulkBar();
    });

    $('#btnBulkApprove').addEventListener('click', bulkApprove);
    $('#btnBulkReturn').addEventListener('click', bulkReturn);
    $('#btnBulkClear').addEventListener('click', () => {
      state.selected.clear();
      document.querySelectorAll('[data-select]').forEach(cb => cb.checked = false);
      updateBulkBar();
      updateCheckAll();
    });
  }

  function boot() {
    if (window.__hodResultSubmissionsBooted) return;
    window.__hodResultSubmissionsBooted = true;
    console.log('[hod/result-submissions] booting...');
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();
