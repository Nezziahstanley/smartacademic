// ============================================================
// Lecturer Results — with status filter, export, print
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
    courses: [],
    selected: new Set(),
    filter: 'all',
  };

  /* ============================================================
     LOAD
     ============================================================ */
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

    state.courses = data.data || [];
    updateCounts();
    render();
  }

  function updateCounts() {
    const counts = { all: state.courses.length, draft: 0, submitted: 0, approved: 0, returned: 0 };
    for (const c of state.courses) {
      const s = c.submission_status || 'draft';
      if (counts[s] !== undefined) counts[s]++;
    }
    $('#cAll').textContent = counts.all;
    $('#cDraft').textContent = counts.draft;
    $('#cSubmitted').textContent = counts.submitted;
    $('#cApproved').textContent = counts.approved;
    $('#cReturned').textContent = counts.returned;
  }

  function render() {
    const tbody = $('#tbody');

    if (!state.courses.length) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">📈</div>
            <h3>No results yet</h3>
            <p>Enter scores in Assessments first. Then results will appear here.</p>
            <a href="/lecturer/assessments.html" class="btn btn-primary mt-3">Go to Assessments</a>
          </div>
        </td></tr>`;
      return;
    }

    const visible = state.filter === 'all'
      ? state.courses
      : state.courses.filter(c => c.submission_status === state.filter);

    if (!visible.length) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">🔎</div>
            <h3>No courses with this status</h3>
            <p>Try a different filter above.</p>
          </div>
        </td></tr>`;
      return;
    }

    const statusBadge = (s) => ({
      draft:     '<span class="badge badge-gray">Draft</span>',
      submitted: '<span class="badge badge-yellow">Submitted</span>',
      approved:  '<span class="badge badge-green">Approved</span>',
      returned:  '<span class="badge badge-red">Returned</span>',
      mixed:     '<span class="badge badge-orange">Mixed</span>',
    }[s] || '<span class="badge badge-gray">Draft</span>');

    tbody.innerHTML = visible.map(c => {
      const canSubmit = c.submission_status === 'draft' || c.submission_status === 'returned';
      const checked = state.selected.has(c.course_id) ? 'checked' : '';
      const avg = c.avg_score != null ? parseFloat(c.avg_score).toFixed(1) : '—';

      return `
        <tr>
          <td class="cb-cell">
            ${canSubmit
              ? `<input type="checkbox" data-select="${c.course_id}" ${checked} />`
              : ''}
          </td>
          <td>
            <strong>${esc(c.code)}</strong> — ${esc(c.title)}
            ${c.submission_status === 'returned' && c.return_reason
              ? `<div style="font-size:12px;color:#b91c1c;margin-top:4px;">↩ Returned: ${esc(c.return_reason)}</div>`
              : ''}
            ${c.is_published
              ? `<div style="font-size:12px;color:#166534;margin-top:4px;">📢 Published to students</div>`
              : ''}
          </td>
          <td>${esc(c.session_name || '—')}</td>
          <td>${esc(c.semester_name || '—')}</td>
          <td>${c.students}<div style="font-size:11.5px;color:var(--ink-3);">avg: ${avg}</div></td>
          <td>${statusBadge(c.submission_status)}</td>
          <td style="text-align:right;">
            <button class="btn btn-ghost btn-sm"
                    data-view-course="${c.course_id}"
                    data-session="${c.session_id}"
                    data-semester="${c.semester_id}">
              View
            </button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-select]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.dataset.select, 10);
        if (cb.checked) state.selected.add(id);
        else            state.selected.delete(id);
        updateBulkBar();
        updateCheckAll();
      });
    });

    tbody.querySelectorAll('[data-view-course]').forEach(b => {
      b.addEventListener('click', () => openDetail(
        parseInt(b.dataset.viewCourse, 10),
        parseInt(b.dataset.session, 10),
        parseInt(b.dataset.semester, 10)
      ));
    });

    updateCheckAll();
  }

  /* ============================================================
     DETAIL MODAL
     ============================================================ */
  async function openDetail(courseId, sessionId, semesterId) {
    if (!sessionId || !semesterId) { alert('This course has no results to view yet.'); return; }

    const { ok, data } = await api(
      `/api/lecturer/results/${courseId}/detail?session_id=${sessionId}&semester_id=${semesterId}`
    );
    if (!ok) { alert(data?.error || 'Failed to load detail'); return; }

    const { course, submission, summary, students } = data.data;

    const statusPill = {
      draft:     'badge-gray',
      submitted: 'badge-yellow',
      approved:  'badge-green',
      returned:  'badge-red',
      mixed:     'badge-orange',
    }[submission.status] || 'badge-gray';

    const gradeBadge = g => ({
      A: 'badge-green', B: 'badge-blue', C: 'badge-blue',
      D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red',
    }[g] || 'badge-gray');

    const rowsHtml = students.length
      ? students.map(s => `
          <tr>
            <td><div style="font-weight:600;">${esc(s.student_name)}</div>
              <div style="font-size:12px;color:var(--ink-3);">${esc(s.matric_no)}</div></td>
            <td style="text-align:right;">${parseFloat(s.ca_score || 0).toFixed(1)}</td>
            <td style="text-align:right;">${parseFloat(s.exam_score || 0).toFixed(1)}</td>
            <td style="text-align:right;"><strong>${parseFloat(s.total_score || 0).toFixed(1)}</strong></td>
            <td style="text-align:right;"><span class="badge ${gradeBadge(s.grade)}">${esc(s.grade || '—')}</span></td>
            <td style="text-align:right;">${s.is_published
              ? '<span class="badge badge-green">Published</span>'
              : '<span class="badge badge-gray">Hidden</span>'}</td>
          </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);">No scores entered yet.</td></tr>';

    const returnHtml = submission.status === 'returned' && submission.return_reason
      ? `<div class="msg msg-error show" style="margin-bottom:14px;"><strong>↩ Returned by HOD:</strong> ${esc(submission.return_reason)}</div>`
      : '';

    const timelineHtml = (submission.submitted_at || submission.approved_at)
      ? `<div class="msg msg-info show" style="margin-bottom:14px;font-size:13px;">
           ${submission.submitted_at ? `<div>📤 Submitted: ${new Date(submission.submitted_at).toLocaleString()}</div>` : ''}
           ${submission.approved_at ? `<div>✅ Approved: ${new Date(submission.approved_at).toLocaleString()}</div>` : ''}
         </div>` : '';

    const { openModal } = window.SACrud || {};

    const body = `
      ${returnHtml}
      ${timelineHtml}
      <div class="grid-3" style="gap:12px;margin-bottom:20px;">
        <div><div style="font-size:12px;color:var(--ink-3);">Status</div><span class="badge ${statusPill}">${esc(submission.status)}</span></div>
        <div><div style="font-size:12px;color:var(--ink-3);">Students</div><strong>${summary.students}</strong></div>
        <div><div style="font-size:12px;color:var(--ink-3);">Average</div><strong>${summary.avg_score}</strong></div>
      </div>
      <div class="table-wrap" style="box-shadow:none;max-height:480px;overflow-y:auto;">
        <table class="table">
          <thead><tr>
            <th>Student</th><th style="text-align:right;">CA</th><th style="text-align:right;">Exam</th>
            <th style="text-align:right;">Total</th><th style="text-align:right;">Grade</th><th style="text-align:right;">Published</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;

    if (typeof openModal === 'function') {
      openModal({
        title: `${course.code} — ${course.title}`,
        subtitle: `${course.session_name} · ${course.semester_name} · Level ${course.level}`,
        size: 'lg',
        confirmText: 'Close',
        body,
        onConfirm: (_b, close) => close(),
      });
    } else {
      alert('Modal helper not available. Please refresh the page.');
    }
  }

  /* ============================================================
     EXPORT — current filtered list to CSV
     ============================================================ */
  function exportCsv() {
    const visible = state.filter === 'all'
      ? state.courses
      : state.courses.filter(c => c.submission_status === state.filter);

    if (!visible.length) { toast('Nothing to export', 'error'); return; }

    const header = ['Course Code', 'Course Title', 'Session', 'Semester', 'Level', 'Students', 'Average', 'Status'];
    const lines = [header.join(',')];
    visible.forEach(c => lines.push([
      `"${c.code}"`,
      `"${c.title}"`,
      `"${c.session_name || ''}"`,
      `"${c.semester_name || ''}"`,
      c.level,
      c.students,
      c.avg_score ?? '',
      c.submission_status || 'draft',
    ].join(',')));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Exported');
  }

  /* ============================================================
     PRINT — opens a clean print-friendly page
     ============================================================ */
  function printResults() {
    const visible = state.filter === 'all'
      ? state.courses
      : state.courses.filter(c => c.submission_status === state.filter);
    if (!visible.length) { toast('Nothing to print', 'error'); return; }

    const rows = visible.map(c => `
      <tr>
        <td>${esc(c.code)}</td>
        <td>${esc(c.title)}</td>
        <td>${esc(c.session_name || '')}</td>
        <td>${esc(c.semester_name || '')}</td>
        <td style="text-align:center;">${c.level}</td>
        <td style="text-align:center;">${c.students}</td>
        <td style="text-align:right;">${c.avg_score ?? '—'}</td>
        <td style="text-align:center;">${esc(c.submission_status || 'draft')}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Lecturer Results — Print</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #0f172a; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0fdf4; color: #14532d; font-weight: 800; text-transform: uppercase;
         font-size: 10.5px; letter-spacing: .04em; padding: 8px 10px; text-align: left;
         border-bottom: 2px solid #166534; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e9f0; font-size: 11.5px; }
    tr:nth-child(even) td { background: #fafbfd; }
    .footer { margin-top: 20px; font-size: 10.5px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body onload="window.print()">
  <h1>Federal Polytechnic, Ugep — Lecturer Results</h1>
  <div class="meta">
    Printed ${new Date().toLocaleString()} · ${visible.length} course(s) · Filter: ${state.filter}
  </div>
  <table>
    <thead>
      <tr>
        <th>Code</th><th>Title</th><th>Session</th><th>Semester</th>
        <th style="text-align:center;">Level</th>
        <th style="text-align:center;">Students</th>
        <th style="text-align:right;">Average</th>
        <th style="text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">SMARTACADEMIC — Academic Early-Warning System</div>
</body>
</html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  /* ============================================================
     BULK + FILTERS
     ============================================================ */
  function updateBulkBar() {
    const count = state.selected.size;
    $('#bulkCount').textContent = count;
    $('#bulkBar').classList.toggle('active', count > 0);
  }

  function updateCheckAll() {
    const checkAll = $('#checkAll');
    const eligible = state.courses.filter(c =>
      c.submission_status === 'draft' || c.submission_status === 'returned'
    );
    const all = eligible.length > 0 && eligible.every(c => state.selected.has(c.course_id));
    const any = eligible.some(c => state.selected.has(c.course_id));
    checkAll.checked = all;
    checkAll.indeterminate = !all && any;
  }

  async function bulkSubmit() {
    const ids = Array.from(state.selected);
    if (!ids.length) { toast('Nothing selected'); return; }
    if (!confirm(`Submit ${ids.length} course(s) to your HOD?`)) return;

    const first = state.courses.find(c => c.course_id === ids[0]);
    if (!first) { toast('Error: course not found', 'error'); return; }

    const btn = $('#btnBulkSubmit');
    btn.disabled = true;
    btn.textContent = '⏳ Submitting...';

    try {
      const { ok, data } = await api('/api/lecturer/results/submit-bulk', {
        method: 'POST',
        body: JSON.stringify({
          course_ids:  ids,
          session_id:  first.session_id,
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
      const eligible = state.courses.filter(c =>
        c.submission_status === 'draft' || c.submission_status === 'returned'
      );
      if (e.target.checked) eligible.forEach(c => state.selected.add(c.course_id));
      else                  state.selected.clear();

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

    document.querySelectorAll('.pill').forEach(p => {
      p.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        state.filter = p.dataset.status;
        render();
      });
    });

    $('#btnExport').addEventListener('click', exportCsv);
    $('#btnPrint').addEventListener('click', printResults);
  }

  function boot() {
    if (window.__lecturerResultsBooted) return;
    window.__lecturerResultsBooted = true;
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();