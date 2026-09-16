'use strict';
(function () {
  const { $, api, esc } = window.SACrud;

  const HEALTH_MSG = {
    GREEN:  '🎉 Great job! Keep up the good work.',
    YELLOW: '👍 You\'re doing okay. Focus on weaker areas.',
    ORANGE: '⚠️ Your performance needs attention. Please check your interventions.',
    RED:    '🚨 Critical. Immediate action needed — check your interventions and contact your lecturer.',
  };

  function renderHealth(risk) {
    const badge = $('#riskBadge');
    const title = $('#healthTitle');
    const msg = $('#healthMsg');

    if (!risk) {
      badge.className = 'badge badge-gray';
      badge.textContent = 'No Assessment';
      title.textContent = 'No risk assessment yet';
      msg.textContent = 'Your risk will be computed once results and attendance are recorded.';
      return;
    }
    const cls = risk.risk_category.toLowerCase();
    badge.className = `badge badge-${cls}`;
    badge.innerHTML = `<span class="risk-dot ${cls}"></span>${risk.risk_category}`;
    title.textContent = `Academic Status: ${risk.risk_category}`;
    msg.textContent = HEALTH_MSG[risk.risk_category] || '';
  }

  function renderStats(d) {
    $('#sGpa').textContent = (d.summary.gpa || 0).toFixed(2);
    $('#sCgpa').textContent = (d.summary.cgpa || 0).toFixed(2);
    $('#sAttn').textContent = (d.attendance.pct || 0) + '%';
    $('#sFailed').textContent = d.summary.failedCourses;
  }

  function renderResults(rows) {
    const body = $('#resultsBody');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--ink-3);padding:30px;">No results yet</td></tr>';
      return;
    }
    const gradeBadge = g => ({ A: 'badge-green', B: 'badge-blue', C: 'badge-blue', D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red' }[g] || 'badge-gray');
    body.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${esc(r.code)}</strong> ${esc(r.title)}</td>
        <td>${parseFloat(r.total_score || 0).toFixed(1)}</td>
        <td><span class="badge ${gradeBadge(r.grade)}">${esc(r.grade || '—')}</span></td>
      </tr>`).join('');
  }

  function renderInterventions(rows) {
    const list = $('#interventionsList');
    if (!rows.length) {
      list.innerHTML = '<li class="empty" style="padding:20px;text-align:center;color:var(--ink-3);">No interventions — great!</li>';
      return;
    }
    list.innerHTML = rows.map(i => `
      <li class="activity-item">
        <div class="activity-ico">🤝</div>
        <div class="activity-body">
          <strong>${esc(i.title)}</strong>
          <p>${esc(i.type.replace(/_/g, ' '))} · ${esc(i.status)}</p>
        </div>
      </li>`).join('');
  }

  function renderGpaChart(trend) {
    const canvas = $('#gpaChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (!trend.length) {
      canvas.parentElement.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">📈</div><h3>Not enough data</h3></div>';
      return;
    }
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: trend.map(t => `${t.session_name} ${t.semester_name}`),
        datasets: [{
          label: 'GPA',
          data: trend.map(t => parseFloat(t.gpa)),
          borderColor: '#166534',
          backgroundColor: 'rgba(22,101,52,0.10)',
          fill: true, tension: 0.35, borderWidth: 3,
          pointRadius: 5, pointBackgroundColor: '#166534',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 5, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  async function load() {
    const { ok, data } = await api('/api/student/dashboard');
    if (!ok) return;
    const d = data.data;

    $('#firstName').textContent = d.student.full_name.split(' ')[0];
    $('#studentMeta').textContent = `${d.student.matric_no} · ${d.student.programme_name} · Level ${d.student.level}`;

    renderHealth(d.risk);
    renderStats(d);
    renderResults(d.recentResults);
    renderInterventions(d.interventions);

    // attendance summary as legend
    $('#attnLegend').innerHTML = `
      <li class="legend-item"><span class="left"><span class="legend-color" style="background:#10b981"></span>Present</span><span class="legend-value">${d.attendance.present || 0}</span></li>
      <li class="legend-item"><span class="left"><span class="legend-color" style="background:#ef4444"></span>Absent</span><span class="legend-value">${d.attendance.absent || 0}</span></li>
      <li class="legend-item"><span class="left"><span class="legend-color" style="background:#f59e0b"></span>Total Sessions</span><span class="legend-value">${d.attendance.total || 0}</span></li>
      <li class="legend-item"><span class="left"><span class="legend-color" style="background:#166534"></span>Attendance %</span><span class="legend-value">${d.attendance.pct || 0}%</span></li>`;

    // GPA chart — fetch from GPA endpoint
    const g = await api('/api/student/gpa-cgpa');
    if (g.ok) {
      const trend = g.data.data.summary.trend || [];
      if (typeof Chart === 'undefined') window.addEventListener('load', () => renderGpaChart(trend));
      else renderGpaChart(trend);
    }
  }

  document.addEventListener('sa:layout-ready', load);
})();