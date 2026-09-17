// ============================================================
// Lecturer Results — view + submit to HOD
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

  let state = {
    course_id: new URLSearchParams(location.search).get('course') || '',
    items: [],
  };

  async function loadCourses() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    const sel = $('#courseFilter');
    if (sel) {
      sel.innerHTML = '<option value="">All courses</option>' +
        data.data.map(c => `<option value="${c.id}" ${String(c.id) === state.course_id ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`).join('');
    }
  }

  async function load() {
    const tbody = $('#tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const p = new URLSearchParams();
    if (state.course_id) p.set('course_id', state.course_id);

    const { ok, data } = await api('/api/lecturer/results?' + p.toString());
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];

    if (!state.items.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:40px;"><div class="empty-icon">📈</div><h3>No results yet</h3><p>Enter scores in Assessments first.</p></div></td></tr>';
      return;
    }

    const gradeBadge = g => ({
      A: 'badge-green', B: 'badge-blue', C: 'badge-blue',
      D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red',
    }[g] || 'badge-gray');

    // Group by course to render one submit row per course
    const byCourse = {};
    state.items.forEach(r => {
      if (!byCourse[r.course_id]) byCourse[r.course_id] = { code: r.code, title: r.title, students: [] };
      byCourse[r.course_id].students.push(r);
    });

    tbody.innerHTML = Object.entries(byCourse).map(([courseId, c]) => `
      <tr style="background:#f8fafc;font-weight:700;">
        <td colspan="5">
          <strong>${esc(c.code)}</strong> — ${esc(c.title)} (${c.students.length} students)
        </td>
        <td colspan="2" style="text-align:right;">
          <button class="btn btn-primary btn-sm" data-submit="${courseId}" data-session="${c.students[0]?.session_id}" data-semester="${c.students[0]?.semester_id}">
            📤 Submit to HOD
          </button>
        </td>
      </tr>
      ${c.students.map(r => `
        <tr>
          <td style="padding-left:32px;">${esc(r.student_name)}<div style="font-size:12px;color:var(--ink-3);">${esc(r.matric_no)}</div></td>
          <td>${parseFloat(r.ca_score || 0).toFixed(1)}</td>
          <td>${parseFloat(r.exam_score || 0).toFixed(1)}</td>
          <td><strong>${parseFloat(r.total_score || 0).toFixed(1)}</strong></td>
          <td><span class="badge ${gradeBadge(r.grade)}">${esc(r.grade || '—')}</span></td>
          <td>${parseFloat(r.grade_point || 0).toFixed(1)}</td>
          <td><span class="badge badge-gray">${esc(r.submission_status || 'draft')}</span></td>
        </tr>`).join('')}
    `).join('');

    tbody.querySelectorAll('[data-submit]').forEach(b =>
      b.addEventListener('click', () => submit(parseInt(b.dataset.submit, 10), parseInt(b.dataset.session, 10), parseInt(b.dataset.semester, 10))));
  }

  async function submit(courseId, sessionId, semesterId) {
    if (!confirm('Submit these results to your HOD for approval? You will not be able to edit them until the HOD approves or returns them.')) return;

    const { ok, data } = await api(`/api/lecturer/results/submit/${courseId}`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, semester_id: semesterId }),
    });

    if (!ok) { alert(data?.error || 'Failed to submit'); return; }
    toast('Results submitted to HOD');
    load();
  }

  function bind() {
    const sel = $('#courseFilter');
    if (sel) sel.addEventListener('change', e => { state.course_id = e.target.value; load(); });
  }

  async function boot() {
    if (window.__lecturerResultsBooted) return;
    window.__lecturerResultsBooted = true;
    await loadCourses();
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();