'use strict';
(function () {
  const { $, api, esc } = window.SACrud;

  async function load() {
    const { ok, data } = await api('/api/lecturer/dashboard');
    if (!ok) return;
    const d = data.data;

    $('#sCourses').textContent = d.courses.length;
    $('#sStudents').textContent = d.totalStudents;
    $('#sAtRisk').textContent = d.atRisk.length;
    $('#sAttn').textContent = d.avgAttendance.toFixed(0) + '%';

    $('#coursesList').innerHTML = d.courses.length ? d.courses.map(c => `
      <li class="activity-item">
        <div class="activity-ico">📖</div>
        <div class="activity-body">
          <strong>${esc(c.code)} — ${esc(c.title)}</strong>
          <p>Level ${c.level} · ${c.units} units · ${c.semester_name} semester · ${c.registered} students</p>
        </div>
      </li>`).join('') : '<li class="empty" style="padding:20px;">No courses assigned.</li>';

    $('#atRiskList').innerHTML = d.atRisk.length ? d.atRisk.slice(0, 6).map(s => `
      <li class="activity-item">
        <div class="activity-ico">⚠</div>
        <div class="activity-body">
          <strong>${esc(s.full_name)}</strong>
          <p>${esc(s.matric_no)} · <span class="badge badge-${s.risk_category.toLowerCase()}">${s.risk_category}</span></p>
        </div>
      </li>`).join('') : '<li class="empty" style="padding:20px;">🎉 No at-risk students.</li>';
  }
  document.addEventListener('sa:layout-ready', load);
})();