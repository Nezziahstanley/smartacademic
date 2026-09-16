'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const { ok, data } = await api('/api/hod/courses');
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    if (!data.data.length) {
      $('#tbody').innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:40px;"><div class="empty-icon">📖</div><h3>No courses</h3></div></td></tr>';
      return;
    }
    $('#tbody').innerHTML = data.data.map(c => `
      <tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td>${esc(c.title)}</td>
        <td><span class="badge badge-blue">${c.units}u</span></td>
        <td>${c.level}</td>
        <td>${esc(c.semester_name)}</td>
        <td>${esc(c.lecturer_name || '—')}</td>
        <td>${c.registered}</td>
      </tr>`).join('');
  }
  document.addEventListener('sa:layout-ready', load);
})();