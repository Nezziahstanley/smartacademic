// ============================================================
// Lecturer Results — grouped by course with Submit to HOD
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

  const state = {
    course_id: new URLSearchParams(location.search).get('course') || '',
    items: [],
  };

  async function loadCourses() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    const sel = $('#courseFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="">All my courses</option>' +
      data.data.map(c => `<option value="${c.id}" ${String(c.id) === state.course_id ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`).join('');
  }

  async function load() {
    const wrap = $('#resultsWrap');
    wrap.innerHTML = '<div class="skeleton" style="height:100px;"></div>';

    const p = new URLSearchParams();
    if (state.course_id) p.set('course_id', state.course_id);

    const { ok, data } = await api('/api/lecturer/results?' + p.toString());
    if (!ok) {
      wrap.innerHTML = '<div class="card"><div class="empty" style="padding:40px;"><div class="empty-icon">⚠️</div><h3>Failed to load results</h3></div></div>';
      return;
    }

    state.items = data.data || [];

    if (!state.items.length) {
      wrap.innerHTML = `
        <div class="card">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">📈</div>
            <h3>No results yet</h3>
            <p>Enter scores in Assessments first.</p>
            <a href="/lecturer/assessments.html" class="btn btn-primary mt-3">Go to Assessments</a>
          </div>
        </div>`;
      return;
    }

    renderGrouped();
  }

  function renderGrouped() {
    const wrap = $('#resultsWrap');

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
          results: [],
        };
      }
      groups[key].results.push(r);
    });

    const gradeBadge = g => ({
      A: 'badge-green', B: 'badge-blue', C: 'badge-blue',
      D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red',
    }[g] || 'badge-gray');

    wrap.innerHTML = Object.values(groups).map(g => {
      const status = g.results[0].submission_status || 'draft';
      const statusBadge = {
        draft:     '<span class="badge badge-gray">Draft</span>',
        submitted: '<span class="badge badge-yellow">Submitted</span>',
        approved:  '<span class="badge badge-green">Approved</span>',
        returned:  '<span class="badge badge-red">Returned</span>',
      }[status] || '<span class="badge badge-gray">Draft</span>';

      const canSubmit = status === 'draft' || status === 'returned';
      const returnReason = g.results[0].return_reason
        ? `<div class="msg msg-error show" style="margin:12px 22px;"><strong>HOD returned:</strong> ${esc(g.results[0].return_reason)}</div>`
        : '';

      return `
        <div class="card mb-4" style="padding:0;overflow:hidden;">
          <div style="padding:18px 22px;background:var(--primary-50);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-size:16px;font-weight:800;color:var(--primary-dark);">${esc(g.code)} — ${esc(g.title)}</div>
              <div style="font-size:13px;color:var(--ink-3);margin-top:2px;">
                ${esc(g.session_name)} · ${esc(g.semester_name)} · ${g.results.length} student${g.results.length === 1 ? '' : 's'}
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              ${statusBadge}
              ${canSubmit
                ? `<button class="btn btn-primary btn-sm" data-submit="${g.course_id}" data-session="${g.session_id}" data-semester="${g.semester_id}">📤 Submit to HOD</button>`
                : ''}
            </div>
          </div>

          ${returnReason}

          <div class="table-wrap" style="box-shadow:none;border:none;border-radius:0;">
            <table class="table">
              <thead>
                <tr>
                  <th>Student</th><th>Matric</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Point</th>
                </tr>
              </thead>
              <tbody>
                ${g.results.map(r => `
                  <tr>
                    <td>${esc(r.student_name)}</td>
                    <td>${esc(r.matric_no)}</td>
                    <td>${parseFloat(r.ca_score || 0).toFixed(1)}</td>
                    <td>${parseFloat(r.exam_score || 0).toFixed(1)}</td>
                    <td><strong>${parseFloat(r.total_score || 0).toFixed(1)}</strong></td>
                    <td><span class="badge ${gradeBadge(r.grade)}">${esc(r.grade || '—')}</span></td>
                    <td>${parseFloat(r.grade_point || 0).toFixed(1)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-submit]').forEach(btn => {
      btn.addEventListener('click', () => submitCourse(
        parseInt(btn.dataset.submit, 10),
        parseInt(btn.dataset.session, 10),
        parseInt(btn.dataset.semester, 10)
      ));
    });
  }

  async function submitCourse(courseId, sessionId, semesterId) {
    if (!confirm('Submit these results to your HOD for approval?\n\nYou will not be able to edit them until the HOD approves or returns them.')) return;

    const { ok, data } = await api(`/api/lecturer/results/submit/${courseId}`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, semester_id: semesterId }),
    });

    if (!ok) { alert(data?.error || 'Failed to submit'); return; }
    toast(data.message || 'Results submitted to HOD');
    load();
  }

  function bind() {
    const sel = $('#courseFilter');
    if (sel) sel.addEventListener('change', e => { state.course_id = e.target.value; load(); });
    const reset = $('#btnReset');
    if (reset) reset.addEventListener('click', () => {
      state.course_id = '';
      if (sel) sel.value = '';
      load();
    });
  }

  async function boot() {
    if (window.__lecturerResultsBooted) return;
    window.__lecturerResultsBooted = true;
    console.log('[lecturer/results] booting...');
    await loadCourses();
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();
