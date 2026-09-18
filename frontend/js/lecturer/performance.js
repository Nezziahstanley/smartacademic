// ============================================================
// Lecturer Performance — richer charts
// ============================================================

'use strict';

(function () {
  const { $, api, esc } = window.SACrud;

  const charts = {};

  async function loadCourses() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    $('#courseFilter').innerHTML = '<option value="">All courses</option>' +
      data.data.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('');
  }

  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
  }

  function gradeBadge(g) {
    return ({ A: 'badge-green', B: 'badge-blue', C: 'badge-blue',
              D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red' }[g] || 'badge-gray');
  }

  async function loadPerformance() {
    const courseId = $('#courseFilter').value;
    const suffix = courseId ? '?course_id=' + courseId : '';

    const [perf, grades, students] = await Promise.all([
      api('/api/lecturer/reports/course-performance'),
      api('/api/lecturer/reports/grade-distribution'),
      api('/api/lecturer/reports/student-averages' + suffix),
    ]);

    if (typeof Chart === 'undefined') {
      window.addEventListener('load', () => renderAll(perf, grades, students));
    } else {
      renderAll(perf, grades, students);
    }
  }

  function renderAll(perf, grades, students) {
    if (perf.ok)   renderCourseChart(perf.data.data);
    if (grades.ok) renderGradeChart(grades.data.data);
    if (perf.ok)   renderPassChart(perf.data.data);
    if (students.ok) {
      renderScatterChart(students.data.data);
      renderStudentTable(students.data.data);
    }
  }

  /* ---------- Average Score per Course ---------- */
  function renderCourseChart(rows) {
    const canvas = $('#courseChart');
    if (!canvas) return;
    destroyChart('course');

    if (!rows.length) {
      canvas.parentElement.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">📊</div><h3>No data yet</h3></div>';
      return;
    }

    charts.course = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(r => r.code),
        datasets: [{
          label: 'Average Score',
          data: rows.map(r => parseFloat(r.avg_score) || 0),
          backgroundColor: rows.map(r => {
            const v = parseFloat(r.avg_score) || 0;
            if (v >= 70) return '#16a34a';
            if (v >= 60) return '#22c55e';
            if (v >= 50) return '#facc15';
            if (v >= 40) return '#f97316';
            return '#ef4444';
          }),
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' },
               ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            afterLabel: (ctx) => {
              const row = rows[ctx.dataIndex];
              return `Students: ${row.student_count} | Pass: ${row.pass_rate || 0}%`;
            },
          } },
        },
      },
    });
  }

  /* ---------- Grade Distribution (doughnut) ---------- */
  function renderGradeChart(rows) {
    const canvas = $('#gradeChart');
    if (!canvas) return;
    destroyChart('grade');

    if (!rows.length) {
      canvas.parentElement.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">🏆</div><h3>No grades yet</h3></div>';
      return;
    }

    const order = ['A', 'B', 'C', 'D', 'E', 'F'];
    const colors = ['#16a34a', '#22c55e', '#84cc16', '#facc15', '#f97316', '#ef4444'];
    const sorted = order.map((g, i) => {
      const row = rows.find(r => r.grade === g);
      return { grade: g, count: row ? row.count : 0, color: colors[i] };
    }).filter(r => r.count > 0);

    charts.grade = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: sorted.map(r => `Grade ${r.grade}`),
        datasets: [{
          data: sorted.map(r => r.count),
          backgroundColor: sorted.map(r => r.color),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
          tooltip: { callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            },
          } },
        },
      },
    });
  }

  /* ---------- Pass Rate by Course (horizontal bar) ---------- */
  function renderPassChart(rows) {
    const canvas = $('#passChart');
    if (!canvas) return;
    destroyChart('pass');

    if (!rows.length) {
      canvas.parentElement.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">✓</div><h3>No data yet</h3></div>';
      return;
    }

    const sorted = [...rows].sort((a, b) => (a.pass_rate || 0) - (b.pass_rate || 0));

    charts.pass = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(r => r.code),
        datasets: [{
          label: 'Pass Rate',
          data: sorted.map(r => parseFloat(r.pass_rate) || 0),
          backgroundColor: sorted.map(r => {
            const v = parseFloat(r.pass_rate) || 0;
            if (v >= 80) return '#16a34a';
            if (v >= 60) return '#84cc16';
            if (v >= 40) return '#facc15';
            return '#ef4444';
          }),
          borderRadius: 8,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' },
               ticks: { callback: v => v + '%' } },
          y: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  /* ---------- Scatter: student score vs course ---------- */
  function renderScatterChart(rows) {
    const canvas = $('#scatterChart');
    if (!canvas) return;
    destroyChart('scatter');

    if (!rows.length) {
      canvas.parentElement.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">📈</div><h3>No scores yet</h3></div>';
      return;
    }

    // Group by course for colors
    const courseCodes = Array.from(new Set(rows.map(r => r.code)));
    const palette = ['#166534', '#ca8a04', '#2563eb', '#9333ea', '#0891b2', '#dc2626', '#65a30d', '#c026d3'];
    const colorFor = code => palette[courseCodes.indexOf(code) % palette.length];

    // Sort by score ascending
    const sorted = [...rows]
      .filter(r => r.total_score != null)
      .sort((a, b) => parseFloat(a.total_score) - parseFloat(b.total_score));

    charts.scatter = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Student scores',
          data: sorted.map((r, i) => ({
            x: i + 1,
            y: parseFloat(r.total_score),
            meta: r,
          })),
          backgroundColor: sorted.map(r => colorFor(r.code)),
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Rank (lowest → highest)' }, grid: { display: false } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Score' },
               grid: { color: '#f1f5f9' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: (ctx) => {
              const m = ctx.raw.meta;
              return `${m.full_name} (${m.matric_no}) — ${m.code}: ${m.total_score}`;
            },
          } },
        },
      },
    });
  }

  /* ---------- Student Averages Table ---------- */
  function renderStudentTable(rows) {
    const body = $('#studentPerfBody');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--ink-3);">No results yet.</td></tr>';
      return;
    }
    body.innerHTML = rows.slice(0, 100).map(r => `
      <tr>
        <td>${esc(r.full_name)}</td>
        <td>${esc(r.matric_no)}</td>
        <td>${esc(r.code)}</td>
        <td style="text-align:right;"><strong>${parseFloat(r.total_score || 0).toFixed(1)}</strong></td>
        <td style="text-align:right;"><span class="badge ${gradeBadge(r.grade)}">${esc(r.grade || '—')}</span></td>
      </tr>`).join('');
  }

  function boot() {
    if (window.__lecturerPerfBooted) return;
    window.__lecturerPerfBooted = true;
    loadCourses();
    loadPerformance();
    $('#courseFilter').addEventListener('change', loadPerformance);
  }

  document.addEventListener('sa:layout-ready', boot);
})();