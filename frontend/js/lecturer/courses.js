'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  async function load() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    if (!data.data.length) {
      $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1;padding:40px;"><div class="empty-icon">📖</div><h3>No courses</h3></div>';
      return;
    }
    $('#grid').innerHTML = data.data.map(c => `
      <div class="card card-hover">
        <div style="font-size:12px;color:var(--primary);font-weight:700;margin-bottom:6px;">${esc(c.code)}</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:10px;">${esc(c.title)}</div>
        <div style="font-size:13px;color:var(--ink-3);line-height:1.8;">
          Level ${c.level} · ${c.units} units<br>
          ${esc(c.semester_name)} semester<br>
          <strong>${c.registered}</strong> students
        </div>
        <div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap;">
          <a href="/lecturer/attendance.html?course=${c.id}" class="btn btn-primary btn-sm">Attendance</a>
          <a href="/lecturer/assessments.html?course=${c.id}" class="btn btn-ghost btn-sm">Assessments</a>
          <a href="/lecturer/results.html?course=${c.id}" class="btn btn-ghost btn-sm">Results</a>
        </div>
      </div>`).join('');
  }
  document.addEventListener('sa:layout-ready', load);
})();