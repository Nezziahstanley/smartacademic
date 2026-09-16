'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  async function load() {
    const { ok, data } = await api('/api/hod/performance');
    if (!ok) return;
    $('#levelBody').innerHTML = data.data.byLevel.map(l => `
      <tr><td><strong>Level ${l.level}</strong></td><td>${l.students}</td>
        <td><strong>${l.avg_gpa || '—'}</strong></td>
      </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;">No data</td></tr>';

    $('#topBody').innerHTML = data.data.topPerformers.map(s => `
      <tr>
        <td>${esc(s.full_name)}<div style="font-size:12px;color:var(--ink-3);">${esc(s.matric_no)}</div></td>
        <td>${s.level}</td>
        <td><span class="badge badge-green">${s.gpa}</span></td>
      </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;">No data</td></tr>';

    $('#failBody').innerHTML = data.data.failedCourses.map(f => `
      <tr><td><strong>${esc(f.code)}</strong> — ${esc(f.title)}</td>
        <td><span class="badge badge-red">${f.failures}</span></td>
      </tr>`).join('') || '<tr><td colspan="2" style="text-align:center;">No failures 🎉</td></tr>';
  }
  document.addEventListener('sa:layout-ready', load);
})();