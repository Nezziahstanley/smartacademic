'use strict';
(function () {
  const { $, api, esc, initials } = window.SACrud;
  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="3"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const { ok, data } = await api('/api/hod/lecturers');
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    if (!data.data.length) {
      $('#tbody').innerHTML = '<tr><td colspan="3"><div class="empty" style="padding:40px;"><div class="empty-icon">👨‍🏫</div><h3>No lecturers</h3></div></td></tr>';
      return;
    }
    $('#tbody').innerHTML = data.data.map(l => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px;">
          <span class="profile-avatar" style="width:32px;height:32px;font-size:12px;">${esc(initials(l.full_name))}</span>
          <div><div style="font-weight:600;">${esc(l.title ? l.title + ' ' : '')}${esc(l.full_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(l.email)}</div></div>
        </div></td>
        <td>${esc(l.staff_id)}</td>
        <td><span class="badge badge-blue">${l.course_count} courses</span></td>
      </tr>`).join('');
  }
  document.addEventListener('sa:layout-ready', load);
})();