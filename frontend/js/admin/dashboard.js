// ============================================================
// SMARTACADEMIC — Admin Dashboard Script
// Fetches stats and renders KPI cards + Chart.js charts.
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

  function relativeTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  const actionIcon = {
    create_user: '👤', update_user: '✏️', delete_user: '🗑️',
    activate_user: '✅', deactivate_user: '⛔', reset_password: '🔑',
    login: '🔓', register: '📝',
  };

  const actionLabel = {
    create_user: 'Created user',
    update_user: 'Updated user',
    delete_user: 'Deleted user',
    activate_user: 'Activated user',
    deactivate_user: 'Deactivated user',
    reset_password: 'Reset password',
    login: 'Logged in',
    register: 'Registered',
  };

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
     ACTIVITY FEED
     ============================================================ */
  function renderActivity(rows) {
    const list = $('#activityList');
    if (!list) return;

    if (!rows || rows.length === 0) {
      list.innerHTML = `
        <div class="empty" style="padding: 30px 0;">
          <div class="empty-icon">📜</div>
          <h3>No recent activity</h3>
          <p>Actions will appear here.</p>
        </div>`;
      return;
    }

    list.innerHTML = rows.map(r => {
      const ico = actionIcon[r.action] || '📌';
      const label = actionLabel[r.action] || r.action;
      const user = r.user_name || 'System';
      return `
        <li class="activity-item">
          <div class="activity-ico">${ico}</div>
          <div class="activity-body">
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(user)} · module: ${escapeHtml(r.module || '—')}</p>
            <div class="activity-time">${relativeTime(r.created_at)}</div>
          </div>
        </li>`;
    }).join('');
  }

  /* ============================================================
     HIGH RISK TABLE
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
          <td><strong>${parseFloat(r.risk_score || 0).toFixed(1)}</strong></td>
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

      const { stats, activity, highRisk, attendance } = data.data;

      renderStats(stats);
      renderActivity(activity);
      renderHighRisk(highRisk);

      // Wait for Chart.js to be loaded if deferred
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

  // Wait for the layout to be ready (topbar/sidebar injected)
  document.addEventListener('sa:layout-ready', boot);
  if (document.readyState === 'complete') {
    setTimeout(() => {
      if (!document.body.dataset.saBooted) boot();
    }, 50);
  }
})();