'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  function badge(pct) {
    return pct >= 75 ? 'green' : pct >= 50 ? 'yellow' : 'red';
  }
  async function load() {
    const { ok, data } = await api('/api/hod/attendance');
    if (!ok) return;
    $('#courseBody').innerHTML = data.data.byCourse.map(c => `
      <tr>
        <td><strong>${esc(c.code)}</strong> — ${esc(c.title)}</td>
        <td>${c.total}</td><td>${c.present}</td>
        <td><span class="badge badge-${badge(c.pct || 0)}">${c.pct || 0}%</span></td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;">No data</td></tr>';
    $('#studentBody').innerHTML = data.data.lowAttendance.map(s => `
      <tr>
        <td>${esc(s.full_name)}</td>
        <td>${esc(s.matric_no)}</td>
        <td>${s.total}</td><td>${s.present}</td>
        <td><span class="badge badge-${badge(s.pct || 0)}">${s.pct || 0}%</span></td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;">No students with low attendance 🎉</td></tr>';
  }
  document.addEventListener('sa:layout-ready', load);
})();