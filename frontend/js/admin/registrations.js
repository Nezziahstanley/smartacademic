'use strict';
(function () {
  const { $, api, esc, confirmDelete, toast, openModal } = window.SACrud;
  const state = { items: [], session_id: '', semester_id: '', course_id: '', search: '' };

  async function loadLookups() {
    const [s, c] = await Promise.all([
      api('/api/admin/sessions'),
      api('/api/admin/courses'),
    ]);
    if (s.ok) {
      $('#sessionFilter').innerHTML = '<option value="">All sessions</option>' +
        s.data.data.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    }
    if (c.ok) {
      $('#courseFilter').innerHTML = '<option value="">All courses</option>' +
        c.data.data.map(x => `<option value="${x.id}">${esc(x.code)} — ${esc(x.title)}</option>`).join('');
    }
  }

  async function loadSemesters(sessionId) {
    if (!sessionId) { $('#semFilter').innerHTML = '<option value="">All semesters</option>'; return; }
    const { ok, data } = await api('/api/admin/semesters?session_id=' + sessionId);
    if (ok) {
      $('#semFilter').innerHTML = '<option value="">All semesters</option>' +
        data.data.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    }
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.session_id) p.set('session_id', state.session_id);
    if (state.semester_id) p.set('semester_id', state.semester_id);
    if (state.course_id) p.set('course_id', state.course_id);
    const { ok, data } = await api('/api/admin/registrations?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    state.items = data.data;
    render();
  }

  function render() {
    const body = $('#tbody');
    let items = state.items;
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(r =>
        r.student_name.toLowerCase().includes(q) || r.matric_no.toLowerCase().includes(q)
      );
    }
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:40px;"><div class="empty-icon">📝</div><h3>No registrations</h3></div></td></tr>';
      return;
    }
    const statusBadge = (s) => ({
      registered: 'badge-blue', approved: 'badge-green', dropped: 'badge-red'
    }[s] || 'badge-gray');
    body.innerHTML = items.map(r => `
      <tr>
        <td>${esc(r.student_name)}</td>
        <td>${esc(r.matric_no)}</td>
        <td><strong>${esc(r.code)}</strong> ${esc(r.title)}</td>
        <td>${r.units}u</td>
        <td>${esc(r.session_name)}</td>
        <td>${esc(r.semester_name)}</td>
        <td><span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Status</button>
          <button class="btn btn-ghost btn-sm" data-del="${r.id}">Drop</button>
        </div></td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openStatus(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDrop(parseInt(b.dataset.del, 10))));
  }

  function openStatus(id) {
    const r = state.items.find(x => x.id === id);
    if (!r) return;
    openModal({
      title: 'Change registration status',
      subtitle: `${r.student_name} — ${r.code}`,
      size: 'sm', confirmText: 'Save',
      body: `
        <div class="field">
          <label>Status</label>
          <select class="select" id="f_status">
            <option value="registered" ${r.status === 'registered' ? 'selected' : ''}>Registered</option>
            <option value="approved" ${r.status === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="dropped" ${r.status === 'dropped' ? 'selected' : ''}>Dropped</option>
          </select>
        </div>`,
      onConfirm: async (bd, close) => {
        const status = bd.querySelector('#f_status').value;
        const { ok } = await api('/api/admin/registrations/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
        if (!ok) { alert('Failed'); return; }
        close(); toast('Status updated'); load();
      },
    });
  }

  function doDrop(id) {
    const r = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Drop registration?', subtitle: r ? `${r.student_name} — ${r.code}` : '',
      message: 'This will remove the registration.',
      onConfirm: async () => {
        const { ok } = await api('/api/admin/registrations/' + id, { method: 'DELETE' });
        if (!ok) { alert('Failed'); return; }
        toast('Dropped'); load();
      },
    });
  }

  function bind() {
    $('#sessionFilter').addEventListener('change', async e => {
      state.session_id = e.target.value;
      await loadSemesters(state.session_id);
      load();
    });
    $('#semFilter').addEventListener('change', e => { state.semester_id = e.target.value; load(); });
    $('#courseFilter').addEventListener('change', e => { state.course_id = e.target.value; load(); });
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 200);
    });
    $('#btnReset').addEventListener('click', () => {
      state.session_id = ''; state.semester_id = ''; state.course_id = ''; state.search = '';
      $('#sessionFilter').value = ''; $('#semFilter').value = ''; $('#courseFilter').value = ''; $('#searchInput').value = '';
      loadSemesters(''); load();
    });
  }

  async function boot() {
    await loadLookups();
    bind();
    load();
  }
  document.addEventListener('sa:layout-ready', boot);
})();