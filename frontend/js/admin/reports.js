// ============================================================
// SMARTACADEMIC — Admin Reports
// Risk distribution, departmental performance, attendance report,
// student lookup, and CSV/PDF/Excel export.
// ============================================================

'use strict';

(function () {
  const { $, api, esc, toast } = window.SACrud;

  let attendanceRows = [];

  /* ============================================================
     RISK REPORT
     ============================================================ */
  async function loadRisk() {
    const { ok, data } = await api('/api/admin/reports/risk');
    if (!ok) return;

    const rows = data.data.summary || [];
    $('#riskBody').innerHTML = rows.length
      ? rows.map(r => `
          <tr>
            <td><span class="badge badge-${r.risk_category.toLowerCase()}">${r.risk_category}</span></td>
            <td style="text-align:right;"><strong>${r.n}</strong></td>
          </tr>`).join('')
      : '<tr><td colspan="2" style="text-align:center;color:var(--ink-3);padding:20px;">No risk data — run Recompute first.</td></tr>';
  }

  /* ============================================================
     DEPARTMENT PERFORMANCE
     ============================================================ */
  async function loadPerformance() {
    const { ok, data } = await api('/api/admin/reports/performance');
    if (!ok) return;

    const rows = data.data.slice(0, 20);
    $('#perfBody').innerHTML = rows.length
      ? rows.map(r => `
          <tr>
            <td>${esc(r.department_name)}</td>
            <td>${r.level}</td>
            <td style="text-align:right;">${r.student_count}</td>
            <td style="text-align:right;"><strong>${r.avg_gpa ?? '—'}</strong></td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--ink-3);padding:20px;">No data</td></tr>';
  }

  /* ============================================================
     ATTENDANCE REPORT
     ============================================================ */
  async function loadAttendance() {
    const { ok, data } = await api('/api/admin/reports/attendance');
    if (!ok) return;

    attendanceRows = data.data;

    $('#attnBody').innerHTML = attendanceRows.length
      ? attendanceRows.slice(0, 30).map(r => `
          <tr>
            <td>${esc(r.full_name)}</td>
            <td>${esc(r.matric_no)}</td>
            <td><strong>${esc(r.code)}</strong> — ${esc(r.title)}</td>
            <td style="text-align:right;">${r.total}</td>
            <td style="text-align:right;">${r.present}</td>
            <td style="text-align:right;">
              <span class="badge badge-${r.pct >= 75 ? 'green' : r.pct >= 50 ? 'yellow' : 'red'}">
                ${r.pct ?? 0}%
              </span>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);padding:20px;">No attendance data</td></tr>';
  }

  /* ============================================================
     CSV EXPORT (client-side, uses cached rows)
     ============================================================ */
  function exportAttendanceCsv() {
    if (!attendanceRows.length) {
      toast('Nothing to export', 'error');
      return;
    }

    const header = ['Student', 'Matric', 'Course', 'Title', 'Total', 'Present', 'Percent'];
    const lines = [header.join(',')];

    attendanceRows.forEach(r => {
      lines.push([
        `"${r.full_name}"`,
        r.matric_no,
        `"${r.code}"`,
        `"${r.title}"`,
        r.total,
        r.present,
        r.pct || 0,
      ].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV downloaded');
  }

  /* ============================================================
     SERVER-SIDE EXPORT (PDF / CSV / Excel)
     These are triggered by buttons with data-export + data-format.
     ============================================================ */
  async function serverExport(type, format) {
    const token = localStorage.getItem('sa_token');
    const url = `/api/admin/reports/export/${type}?format=${format}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Export failed');
        return;
      }

      const blob = await res.blob();
      const ext = format === 'excel' ? 'xlsx' : format;
      const filename = `smartacademic-${type}-${new Date().toISOString().slice(0, 10)}.${ext}`;

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);

      toast(`✅ ${format.toUpperCase()} downloaded`);
    } catch (err) {
      alert('Download error: ' + err.message);
    }
  }

  /* ============================================================
     STUDENT LOOKUP
     ============================================================ */
  async function lookupStudent() {
    const id = parseInt($('#lookupId').value, 10);
    if (!id) { toast('Enter a student ID', 'error'); return; }

    const out = $('#lookupOutput');
    out.innerHTML = '<div class="skeleton" style="height:100px;"></div>';

    const { ok, data } = await api('/api/admin/reports/student/' + id);
    if (!ok) {
      out.innerHTML = '<div class="msg msg-error show">Student not found.</div>';
      return;
    }

    const { student, results, attendance, risk, interventions } = data.data;

    const gradeBadge = g => ({
      A: 'badge-green',
      B: 'badge-blue',
      C: 'badge-blue',
      D: 'badge-yellow',
      E: 'badge-yellow',
      F: 'badge-red',
    }[g] || 'badge-gray');

    const resultsHtml = results.length
      ? results.map(r => `
          <tr>
            <td>${esc(r.code)} — ${esc(r.title)}</td>
            <td>${r.units}</td>
            <td>${parseFloat(r.total_score || 0).toFixed(1)}</td>
            <td><span class="badge ${gradeBadge(r.grade)}">${r.grade || '—'}</span></td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--ink-3);">No results yet</td></tr>';

    out.innerHTML = `
      <div class="card" style="box-shadow:none;background:var(--bg);">
        <div style="margin-bottom:14px;">
          <div style="font-size:18px;font-weight:800;">${esc(student.full_name)}</div>
          <div style="color:var(--ink-3);font-size:13px;">
            ${esc(student.matric_no)} · ${esc(student.department_name)} ·
            ${esc(student.programme_name)} · L${student.level}
          </div>
        </div>

        <div class="grid-3" style="gap:12px;margin-bottom:16px;">
          <div>
            <div style="font-size:12px;color:var(--ink-3);">Attendance</div>
            <strong>${attendance.pct || 0}%</strong>
          </div>
          <div>
            <div style="font-size:12px;color:var(--ink-3);">Latest Risk</div>
            ${risk.length
              ? `<span class="badge badge-${risk[0].risk_category.toLowerCase()}">${risk[0].risk_category}</span>`
              : '—'}
          </div>
          <div>
            <div style="font-size:12px;color:var(--ink-3);">Interventions</div>
            <strong>${interventions.length}</strong>
          </div>
        </div>

        <h4 style="font-size:13px;margin-bottom:8px;">Results (${results.length})</h4>
        <div class="table-wrap" style="box-shadow:none;">
          <table class="table">
            <thead><tr><th>Course</th><th>Units</th><th>Score</th><th>Grade</th></tr></thead>
            <tbody>${resultsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ============================================================
     WIRE ALL EXPORT BUTTONS (data-export + data-format)
     ============================================================ */
  function bindExports() {
    document.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.export;
        const format = btn.dataset.format;
        if (!type || !format) return;
        serverExport(type, format);
      });
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    loadRisk();
    loadPerformance();
    loadAttendance();

    // Local CSV export
    const csvBtn = $('#btnExportCsv');
    if (csvBtn) csvBtn.addEventListener('click', exportAttendanceCsv);

    // Student lookup
    const lookupBtn = $('#btnLookup');
    if (lookupBtn) lookupBtn.addEventListener('click', lookupStudent);

    // Server-side export buttons (PDF / CSV / Excel)
    bindExports();
  }

  document.addEventListener('sa:layout-ready', boot);
})();