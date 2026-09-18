// ============================================================
// Student My Results — with GPA per semester summary
// ============================================================

'use strict';

(function () {
  const { $, api, esc } = window.SACrud;

  function gradeBadge(g) {
    return ({ A: 'badge-green', B: 'badge-blue', C: 'badge-blue',
              D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red' }[g] || 'badge-gray');
  }

  function fmt(n, d = 2) {
    const v = parseFloat(n);
    return isFinite(v) ? v.toFixed(d) : '—';
  }

  /* ============================================================
     GROUP RESULTS BY (session, semester)
     ============================================================ */
  function groupBySemester(rows) {
    const map = new Map();
    for (const r of rows) {
      const key = `${r.session_name}|${r.semester_name}`;
      if (!map.has(key)) {
        map.set(key, {
          session_name: r.session_name,
          semester_name: r.semester_name,
          results: [],
        });
      }
      map.get(key).results.push(r);
    }
    return Array.from(map.values());
  }

  function computeGpa(results) {
    let pts = 0, units = 0;
    for (const r of results) {
      const u = parseFloat(r.units) || 0;
      const gp = parseFloat(r.grade_point);
      if (!isFinite(gp)) continue;
      pts += u * gp;
      units += u;
    }
    return units ? +(pts / units).toFixed(2) : 0;
  }

  /* ============================================================
     RENDER — GPA summary table
     ============================================================ */
  function renderGpaSummary(rows) {
    const wrap = $('#gpaSummary');
    if (!wrap) return;

    if (!rows.length) {
      wrap.innerHTML = '<p style="color:var(--ink-3);padding:20px;text-align:center;">No published results yet.</p>';
      return;
    }

    const groups = groupBySemester(rows);

    // Compute running CGPA across all semesters in order
    let cumPts = 0, cumUnits = 0;
    const enriched = groups.map(g => {
      const gpa = computeGpa(g.results);
      const units = g.results.reduce((s, r) => s + (parseFloat(r.units) || 0), 0);
      const pts = g.results.reduce((s, r) => s + ((parseFloat(r.units) || 0) * (parseFloat(r.grade_point) || 0)), 0);
      cumPts += pts;
      cumUnits += units;
      const cgpa = cumUnits ? +(cumPts / cumUnits).toFixed(2) : 0;
      return { ...g, gpa, units, cgpa };
    });

    wrap.innerHTML = `
      <div class="table-wrap" style="box-shadow:none;border:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Semester</th>
              <th style="text-align:right;">Courses</th>
              <th style="text-align:right;">Units</th>
              <th style="text-align:right;">GPA</th>
              <th style="text-align:right;">CGPA</th>
            </tr>
          </thead>
          <tbody>
            ${enriched.map(g => `
              <tr>
                <td>${esc(g.session_name)}</td>
                <td>${esc(g.semester_name)}</td>
                <td style="text-align:right;">${g.results.length}</td>
                <td style="text-align:right;">${g.units}</td>
                <td style="text-align:right;"><strong style="color:${g.gpa >= 4 ? '#16a34a' : g.gpa >= 3 ? '#22c55e' : g.gpa >= 2 ? '#facc15' : '#ef4444'};">${g.gpa.toFixed(2)}</strong></td>
                <td style="text-align:right;"><strong>${g.cgpa.toFixed(2)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;font-size:12px;color:var(--ink-3);text-align:center;">
        Overall CGPA: <strong>${enriched[enriched.length - 1]?.cgpa.toFixed(2) ?? '—'}</strong>
        · Total units: <strong>${cumUnits}</strong>
      </div>`;
  }

  /* ============================================================
     RENDER — Flat results table
     ============================================================ */
  function renderTable(rows) {
    const body = $('#tbody');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:40px;"><div class="empty-icon">📈</div><h3>No published results yet</h3><p>Your results will appear here once published.</p></div></td></tr>';
      return;
    }
    body.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${esc(r.code)}</strong> ${esc(r.title)}</td>
        <td>${r.units}</td>
        <td>${fmt(r.ca_score, 1)}</td>
        <td>${fmt(r.exam_score, 1)}</td>
        <td><strong>${fmt(r.total_score, 1)}</strong></td>
        <td><span class="badge ${gradeBadge(r.grade)}">${esc(r.grade || '—')}</span></td>
        <td>${fmt(r.grade_point, 1)}</td>
        <td>${esc(r.session_name)} ${esc(r.semester_name)}</td>
      </tr>`).join('');
  }

  /* ============================================================
     BOOT
     ============================================================ */
  document.addEventListener('sa:layout-ready', async () => {
    const { ok, data } = await api('/api/student/results');
    if (!ok) return;
    renderGpaSummary(data.data);
    renderTable(data.data);
  });
})();