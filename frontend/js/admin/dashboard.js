// ============================================================
// SMARTACADEMIC — Admin Dashboard Script
// Fetches stats and renders KPI cards + Chart.js charts.
// At-risk panel links out to /admin/risk-monitoring.html.
// ============================================================

'use strict';

(function () {
  const $  = (s, r = document) => r.querySelector(s);

  function getToken() { return localStorage.getItem('sa_token'); }
  function authHeaders() { return { Authorization: 'Bearer ' + getToken() }; }

  async function api(path) {
    const res = await fetch(path, { headers: authHeaders() });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ============================================================
     RENDER KPIs
     ============================================================ */
  function renderStats(stats) {
    $('#statStudents').textContent  = fmt(stats.students);
    $('#statLecturers').textContent = fmt(stats.lecturers);
    $('#statCourses').textContent   = fmt(stats.courses);
    $('#statGpa').textContent       = (stats.gpaAverage || 0).toFixed(2);

    $('#statGreen').textContent  = fmt(stats.risk.GREEN);
    $('#statYellow').textContent = fmt(stats.risk.YELLOW);
    $('#statOrange').textContent = fmt(stats.risk.ORANGE);
    $('#statRed').textContent    = fmt(stats.risk.RED);
  }

  /* ============================================================
     RISK CHART (doughnut)
     ============================================================ */
  function renderRiskChart(risk) {
    const canvas = $('#riskChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const data = [risk.GREEN, risk.YELLOW, risk.ORANGE, risk.RED];
    const total = data.reduce((a, b) => a + b, 0);

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Good Standing', 'Needs Attention', 'High Risk', 'Critical'],
        datasets: [{
          data,
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    // Custom legend with counts
    const legend = $('#riskLegend');
    if (legend) {
      const items = [
        { label: 'Good Standing',   value: risk.GREEN,  color: '#10b981' },
        { label: 'Needs Attention', value: risk.YELLOW, color: '#f59e0b' },
        { label: 'High Risk',       value: risk.ORANGE, color: '#f97316' },
        { label: 'Critical',        value: risk.RED,    color: '#ef4444' },
      ];
      legend.innerHTML = items.map(i => `
        <li class="legend-item">
          <span class="left"><span class="legend-color" style="background:${i.color}"></span>${i.label}</span>
          <span class="legend-value">${i.value}</span>
        </li>
      `).join('');
    }
  }

  /* ============================================================
     ATTENDANCE CHART (line)
     ============================================================ */
  function renderAttendanceChart(rows) {
    const canvas = $('#attendanceChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = rows.map(r => new Date(r.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = rows.map(r => parseFloat(r.pct) || 0);

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Attendance %',
          data: values,
          borderColor: '#166534',
          backgroundColor: 'rgba(22,101,52,0.10)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#166534',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            min: 0, max: 100,
            ticks: { callback: v => v + '%', color: '#64748b' },
            grid: { color: '#f1f5f9' },
          },
          x: {
            ticks: { color: '#64748b' },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` Attendance: ${ctx.parsed.y}%` },
          },
        },
      },
    });
  }

  /* ============================================================
     AT-RISK TABLE (mini snapshot)
     ============================================================ */
  function renderHighRisk(rows) {
    const body = $('#highRiskBody');
    if (!body) return;

    if (!rows || rows.length === 0) {
      body.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; padding: 30px 10px; color: var(--ink-3);">
            🎉 No high-risk students right now.
          </td>
        </tr>`;
      return;
    }

    body.innerHTML = rows.map(r => {
      const cls = (r.risk_category || '').toLowerCase();
      return `
        <tr>
          <td>
            <div style="font-weight:600;color:var(--ink);">${escapeHtml(r.full_name)}</div>
            <div style="font-size:12px;color:var(--ink-3);">${escapeHtml(r.matric_no)} · L${r.level}</div>
          </td>
          <td>
            <span class="badge badge-${cls}">
              <span class="risk-dot ${cls}"></span>${r.risk_category}
            </span>
          </td>
          <td style="text-align:right;"><strong>${parseFloat(r.risk_score || 0).toFixed(1)}</strong></td>
        </tr>`;
    }).join('');
  }

  /* ============================================================
     BOOT
     ============================================================ */
  async function boot() {
    try {
      const { ok, data } = await api('/api/admin/dashboard');
      if (!ok || !data || !data.success) throw new Error('Failed to load dashboard');

      const { stats, highRisk, attendance } = data.data;

      renderStats(stats);
      renderHighRisk(highRisk);

      if (typeof Chart === 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
          renderRiskChart(stats.risk);
          renderAttendanceChart(attendance);
        });
      } else {
        renderRiskChart(stats.risk);
        renderAttendanceChart(attendance);
      }
    } catch (err) {
      console.error('[admin/dashboard]', err);
      document.querySelectorAll('.stat-value').forEach(el => el.textContent = '—');
    }
  }

  document.addEventListener('sa:layout-ready', boot);
  if (document.readyState === 'complete') {
    setTimeout(() => {
      if (!document.body.dataset.saBooted) boot();
    }, 50);
  }
})();