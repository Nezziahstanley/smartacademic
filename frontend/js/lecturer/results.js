'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  let state = { course_id: new URLSearchParams(location.search).get('course') || '' };

  async function loadCourses() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    $('#courseFilter').innerHTML = '<option value="">All courses</option>' +
      data.data.map(c => `<option value="${c.id}" ${String(c.id) === state.course_id ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`).join('');
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="6"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.course_id) p.set('course_id', state.course_id);
    const { ok, data } = await api('/api/lecturer/results?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    if (!data.data.length) {
      $('#tbody').innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:40px;"><div class="empty-icon">📈</div><h3>No results yet</h3></div></td></tr>';
      return;
    }
    const gradeBadge = g => ({ A: 'badge-green', B: 'badge-blue', C: 'badge-blue', D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red' }[g] || 'badge-gray');
    $('#tbody').innerHTML = data.data.map(r => `
      <tr>
        <td>${esc(r.student_name)}<div style="font-size:12px;color:var(--ink-3);">${esc(r.matric_no)}</div></td>
        <td>${esc(r.code)} — ${esc(r.title)}</td>
        <td>${parseFloat(r.ca_score || 0).toFixed(1)}</td>
        <td>${parseFloat(r.exam_score || 0).toFixed(1)}</td>
        <td><strong>${parseFloat(r.total_score || 0).toFixed(1)}</strong></td>
        <td><span class="badge ${gradeBadge(r.grade)}">${esc(r.grade || '—')}</span></td>
      </tr>`).join('');
  }

  function bind() {
    $('#courseFilter').addEventListener('change', e => { state.course_id = e.target.value; load(); });
  }
  async function boot() { await loadCourses(); bind(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();