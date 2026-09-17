// ============================================================
// HOD Result Submissions — review, approve, return
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

  const state = { status: 'submitted', items: [] };

  async function load() {
    const tbody = $('#tbody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const { ok, data } = await api('/api/hod/result-submissions?status=' + state.status);
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];

    if (!state.items.length) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">📊</div>
            <h3>No ${state.status} submissions</h3>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = state.items.map(s => `
      <tr>
        <td><strong>${esc(s.code)}</strong> — ${esc(s.title)}<div style="font-size:12px;color:var(--ink-3);">Level ${s.level}</div></td>
        <td>${esc(s.lecturer_name || '—')}</td>
        <td>${esc(s.session_name)}</td>
        <td>${esc(s.semester_name)}</td>
        <td>${s.students}</td>
        <td>${s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-view="${s.course_id}" data-session="${s.session_id}" data-semester="${s.semester_id}">View</button>
            ${state.status === 'submitted' ? `
              <button class="btn btn-primary btn-sm" data-approve="${s.course_id}" data-session="${s.session_id}" data-semester="${s.semester_id}">✓ Approve</button>
              <button class="btn btn-danger btn-sm" data-return="${s.course_id}" data-session="${s.session_id}" data-semester="${s.semester_id}">↩ Return</button>
            ` : ''}
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => viewDetails(b.dataset)));
    tbody.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => doApprove(b.dataset)));
    tbody.querySelectorAll('[data-return]').forEach(b => b.addEventListener('click', () => doReturn(b.dataset)));
  }

  async function viewDetails(ds) {
    const { ok, data } = await api(`/api/hod/result-submissions/${ds.view}?session_id=${ds.session}&semester_id=${ds.semester}`);
    if (!ok) { alert('Failed to load details'); return; }

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

  async function doApprove(ds) {
    if (!confirm('Approve these results? Students will see them once admin publishes.')) return;
    const { ok, data } = await api(`/api/hod/result-submissions/${ds.approve}/approve`, {
      method: 'POST',
      body: JSON.stringify({ session_id: parseInt(ds.session, 10), semester_id: parseInt(ds.semester, 10) }),
    });
    if (!ok) { alert(data?.error || 'Failed'); return; }
    toast(data.message || 'Results approved');
    load();
  }

  async function doReturn(ds) {
    const reason = prompt('Reason for returning (required):');
    if (!reason) return;
    const { ok, data } = await api(`/api/hod/result-submissions/${ds.return}/return`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: parseInt(ds.session, 10),
        semester_id: parseInt(ds.semester, 10),
        reason,
      }),
    });
    if (!ok) { alert(data?.error || 'Failed'); return; }
    toast('Results returned to lecturer');
    load();
  }

  function bind() {
    const sel = $('#statusFilter');
    if (sel) sel.addEventListener('change', e => { state.status = e.target.value; load(); });
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
