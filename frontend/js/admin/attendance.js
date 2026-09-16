'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  const state = { course_id: '', from: '', to: '' };

  async function loadCourses() {
    const { ok, data } = await api('/api/admin/courses');
    if (ok) $('#courseFilter').innerHTML = '<option value="">All courses</option>' +
      data.data.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('');
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="5"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.course_id) p.set('course_id', state.course_id);
    if (state.from) p.set('from', state.from);
    if (state.to) p.set('to', state.to);
    const { ok, data } = await api('/api/admin/attendance?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    const { items, summary } = data.data;

    $('#s_total').textContent = summary.total || 0;
    $('#s_present').textContent = summary.present || 0;
    $('#s_absent').textContent = summary.absent || 0;
    $('#s_pct').textContent = (summary.present_pct || 0) + '%';

    const body = $('#tbody');
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="5"><div class="empty" style="padding:40px;"><div class="empty-icon">✅</div><h3>No records</h3></div></td></tr>';
      return;
    }
    const statusBadge = (s) => ({ present: 'badge-green', absent: 'badge-red', excused: 'badge-yellow' }[s] || 'badge-gray');
    body.innerHTML = items.map(r => `
      <tr>
        <td>${new Date(r.session_date).toLocaleDateString()}</td>
        <td><strong>${esc(r.course_code)}</strong> — ${esc(r.course_title)}</td>
        <td>${esc(r.student_name)}</td>
        <td>${esc(r.matric_no)}</td>
        <td><span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></td>
      </tr>`).join('');
  }

  function bind() {
    $('#courseFilter').addEventListener('change', e => { state.course_id = e.target.value; load(); });
    $('#fromDate').addEventListener('change', e => { state.from = e.target.value; load(); });
    $('#toDate').addEventListener('change', e => { state.to = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.course_id = ''; state.from = ''; state.to = '';
      $('#courseFilter').value = ''; $('#fromDate').value = ''; $('#toDate').value = '';
      load();
    });
  }

  async function boot() { await loadCourses(); bind(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();