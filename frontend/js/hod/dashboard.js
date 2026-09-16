'use strict';
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const token = () => localStorage.getItem('sa_token');
  const api = async (p) => {
    const r = await fetch(p, { headers: { Authorization: 'Bearer ' + token() } });
    return { ok: r.ok, data: await r.json().catch(() => null) };
  };

  function renderStats(data) {
    $('#sStudents').textContent = data.counts.students;
    $('#sLecturers').textContent = data.counts.lecturers;
    $('#sCourses').textContent = data.counts.courses;
    $('#sGpa').textContent = (data.gpaAverage || 0).toFixed(2);
    $('#sGreen').textContent = data.risk.GREEN;
    $('#sYellow').textContent = data.risk.YELLOW;
    $('#sOrange').textContent = data.risk.ORANGE;
    $('#sRed').textContent = data.risk.RED;
    if (data.department) $('#deptName').textContent = data.department.name + ' Dashboard';
  }

  function renderRiskChart(risk) {
    const canvas = $('#riskChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const data = [risk.GREEN, risk.YELLOW, risk.ORANGE, risk.RED];

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Good Standing', 'Needs Attention', 'High Risk', 'Critical'],
        datasets: [{ data, backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'], borderWidth: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
    });

    const colors = { GREEN: '#10b981', YELLOW: '#f59e0b', ORANGE: '#f97316', RED: '#ef4444' };
    const labels = { GREEN: 'Good Standing', YELLOW: 'Needs Attention', ORANGE: 'High Risk', RED: 'Critical' };
    $('#riskLegend').innerHTML = Object.keys(risk).map(k => `
      <li class="legend-item">
        <span class="left"><span class="legend-color" style="background:${colors[k]}"></span>${labels[k]}</span>
        <span class="legend-value">${risk[k]}</span>
      </li>`).join('');
  }

  function renderCourseChart(rows) {
    const canvas = $('#courseChart');
    if (!canvas || typeof Chart === 'undefined') return;
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(r => r.code),
        datasets: [{
          label: 'Avg Score',
          data: rows.map(r => parseFloat(r.avg_score) || 0),
          backgroundColor: '#166534',
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
        plugins: { legend: { display: false } },
      },
    });
  }

  function renderHighRisk(rows) {
    const body = $('#highRiskBody');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--ink-3);">🎉 No high-risk students.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(r => `
      <tr>
        <td>
          <div style="font-weight:600;">${r.full_name}</div>
          <div style="font-size:12px;color:var(--ink-3);">${r.matric_no} · L${r.level}</div>
        </td>
        <td><span class="badge badge-${r.risk_category.toLowerCase()}">${r.risk_category}</span></td>
        <td><strong>${parseFloat(r.risk_score).toFixed(1)}</strong></td>
      </tr>`).join('');
  }

  async function boot() {
    const { ok, data } = await api('/api/hod/dashboard');
    if (!ok) return;
    renderStats(data.data);
    renderHighRisk(data.data.highRisk);
    if (typeof Chart === 'undefined') {
      window.addEventListener('load', () => {
        renderRiskChart(data.data.risk);
        renderCourseChart(data.data.coursePerformance);
      });
    } else {
      renderRiskChart(data.data.risk);
      renderCourseChart(data.data.coursePerformance);
    }
  }
  document.addEventListener('sa:layout-ready', boot);
})();