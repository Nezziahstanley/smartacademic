// ============================================================
// Lecturer Results — bulk submit to HOD
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
    items: [],       // all results
    courses: [],     // grouped by course
    selected: new Set(),
  };

  async function load() {
    const tbody = $('#tbody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';
    state.selected.clear();
    updateBulkBar();

    const { ok, data } = await api('/api/lecturer/results');
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];

    // Group by course + session + semester
    const groups = {};
    state.items.forEach(r => {
      const key = `${r.course_id}|${r.session_id}|${r.semester_id}`;
      if (!groups[key]) {
        groups[key] = {
          course_id: r.course_id,
          code: r.code,
          title: r.title,
          session_id: r.session_id,
          session_name: r.session_name,
          semester_id: r.semester_id,
          semester_name: r.semester_name,
          status: r.submission_status || 'draft',
          students: 0,
        };
      }
      groups[key].students++;
    });
    state.courses = Object.values(groups);

    render();
  }

  function render() {
    const tbody = $('#tbody');

    if (!state.courses.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:40px;"><div class="empty-icon">📈</div><h3>No results yet</h3><p>Enter scores in Assessments first.</p></div></td></tr>';
      return;
    }

    const statusBadge = (s) => ({
      draft:     '<span class="badge badge-gray">Draft</span>',
      submitted: '<span class="badge badge-yellow">Submitted</span>',
      approved:  '<span class="badge badge-green">Approved</span>',
      returned:  '<span class="badge badge-red">Returned</span>',
    }[s] || '<span class="badge badge-gray">Draft</span>');

    tbody.innerHTML = state.courses.map(c => {
      const canSubmit = c.status === 'draft' || c.status === 'returned';
      const checked = state.selected.has(c.course_id) ? 'checked' : '';
      return `
        <tr>
          <td class="cb-cell">
            ${canSubmit
              ? `<input type="checkbox" data-select="${c.course_id}" ${checked} />`
              : ''}
          </td>
          <td><strong>${esc(c.code)}</strong> — ${esc(c.title)}</td>
          <td>${esc(c.session_name)}</td>
          <td>${esc(c.semester_name)}</td>
          <td>${c.students}</td>
          <td>${statusBadge(c.status)}</td>
          <td style="text-align:right;">
            <a class="btn btn-ghost btn-sm" href="/lecturer/results-detail.html?course=${c.course_id}&session=${c.session_id}&semester=${c.semester_id}">View</a>
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

    updateCheckAll();
  }

  function updateBulkBar() {
    const bar = $('#bulkBar');
    const count = state.selected.size;
    $('#bulkCount').textContent = count;
    bar.classList.toggle('active', count > 0);
  }

  function updateCheckAll() {
    const checkAll = $('#checkAll');
    const selectable = state.courses.filter(c => c.status === 'draft' || c.status === 'returned');
    const all = selectable.length > 0 && selectable.every(c => state.selected.has(c.course_id));
    const any = selectable.some(c => state.selected.has(c.course_id));
    checkAll.checked = all;
    checkAll.indeterminate = !all && any;
  }

  async function bulkSubmit() {
    const ids = Array.from(state.selected);
    if (!ids.length) { toast('Nothing selected'); return; }

    if (!confirm(`Submit ${ids.length} course(s) to your HOD?\n\nYou cannot edit until HOD approves or returns them.`)) return;

    // Get session/semester from first selected course
    const first = state.courses.find(c => c.course_id === ids[0]);
    if (!first) { toast('Error: course not found'); return; }

    const btn = $('#btnBulkSubmit');
    btn.disabled = true;
    btn.textContent = '⏳ Submitting...';

    try {
      const { ok, data } = await api('/api/lecturer/results/submit-bulk', {
        method: 'POST',
        body: JSON.stringify({
          course_ids: ids,
          session_id: first.session_id,
          semester_id: first.semester_id,
        }),
      });

      if (!ok) { alert(data?.error || 'Failed to submit'); return; }
      toast(data.message || `Submitted ${ids.length} course(s)`);
      load();
    } finally {
      btn.disabled = false;
      btn.textContent = '📤 Submit Selected to HOD';
    }
  }

  function bind() {
    $('#checkAll').addEventListener('change', (e) => {
      const selectable = state.courses.filter(c => c.status === 'draft' || c.status === 'returned');
      if (e.target.checked) selectable.forEach(c => state.selected.add(c.course_id));
      else state.selected.clear();

      document.querySelectorAll('[data-select]').forEach(cb => {
        cb.checked = state.selected.has(parseInt(cb.dataset.select, 10));
      });
      updateBulkBar();
    });

    $('#btnBulkSubmit').addEventListener('click', bulkSubmit);

    $('#btnBulkClear').addEventListener('click', () => {
      state.selected.clear();
      document.querySelectorAll('[data-select]').forEach(cb => cb.checked = false);
      updateBulkBar();
      updateCheckAll();
    });
  }

  function boot() {
    if (window.__lecturerResultsBooted) return;
    window.__lecturerResultsBooted = true;
    console.log('[lecturer/results] booting...');
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();
