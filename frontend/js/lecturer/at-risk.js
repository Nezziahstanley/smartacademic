// TODO: implement js/lecturer/at-risk-students.js
'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  async function load() {
    const { ok, data } = await api('/api/lecturer/at-risk');
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    if (!data.data.length) {
      $('#tbody').innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:40px;"><div class="empty-icon">🎉</div><h3>No at-risk students</h3><p>All students are in good standing.</p></div></td></tr>';
      return;
    }
    $('#tbody').innerHTML = data.data.map(s => {
      const cls = s.risk_category.toLowerCase();
      return `
        <tr>
          <td>${esc(s.full_name)}</td>
          <td>${esc(s.matric_no)}</td>
          <td>${esc(s.course_code || '—')}</td>
          <td><span class="badge badge-${cls}"><span class="risk-dot ${cls}"></span>${s.risk_category}</span></td>
          <td><strong>${parseFloat(s.risk_score).toFixed(1)}</strong></td>
          <td>${parseFloat(s.attendance_pct || 0).toFixed(1)}%</td>
          <td>${parseFloat(s.gpa || 0).toFixed(2)}</td>
        </tr>`;
    }).join('');
  }
  document.addEventListener('sa:layout-ready', load);
})();