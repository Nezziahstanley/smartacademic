'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  const state = { category: '', level: '' };

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.category) p.set('category', state.category);
    if (state.level) p.set('level', state.level);
    const { ok, data } = await api('/api/hod/risk?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    if (!data.data.length) {
      $('#tbody').innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:40px;"><div class="empty-icon">🚦</div><h3>No risk data</h3></div></td></tr>';
      return;
    }
    $('#tbody').innerHTML = data.data.map(r => `
      <tr>
        <td><div style="font-weight:600;">${esc(r.full_name)}</div></td>
        <td>${esc(r.matric_no)}</td>
        <td>${r.level}</td>
        <td><span class="badge badge-${r.risk_category.toLowerCase()}">${r.risk_category}</span></td>
        <td><strong>${parseFloat(r.risk_score).toFixed(1)}</strong></td>
        <td>${parseFloat(r.attendance_pct || 0).toFixed(1)}%</td>
        <td>${parseFloat(r.gpa || 0).toFixed(2)}</td>
        <td><a class="btn btn-ghost btn-sm" href="/hod/interventions.html?student=${r.student_id}">Intervene</a></td>
      </tr>`).join('');
  }

  function bind() {
    $('#catFilter').addEventListener('change', e => { state.category = e.target.value; load(); });
    $('#levelFilter').addEventListener('change', e => { state.level = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.category = ''; state.level = '';
      $('#catFilter').value = ''; $('#levelFilter').value = '';
      load();
    });
  }
  document.addEventListener('sa:layout-ready', () => { bind(); load(); });
})();