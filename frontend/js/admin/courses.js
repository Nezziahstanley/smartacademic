'use strict';
(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const state = { items: [], departments: [], programmes: [], lecturers: [], search: '', department_id: '', level: '' };

  async function loadAll() {
    const [d, l] = await Promise.all([
      api('/api/admin/departments'),
      api('/api/admin/lecturers?limit=500'),
    ]);
    if (d.ok) {
      state.departments = d.data.data;
      $('#deptFilter').innerHTML = '<option value="">All departments</option>' +
        d.data.data.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    }
    if (l.ok) state.lecturers = l.data.data.items;
  }

  async function loadProgrammes(deptId) {
    if (!deptId) { state.programmes = []; return; }
    const { ok, data } = await api('/api/admin/programmes?department_id=' + deptId);
    if (ok) state.programmes = data.data;
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.search) p.set('search', state.search);
    if (state.department_id) p.set('department_id', state.department_id);
    if (state.level) p.set('level', state.level);
    const { ok, data } = await api('/api/admin/courses?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>'; return; }
    state.items = data.data;
    render();
  }

  function render() {
    const body = $('#tbody');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:40px;"><div class="empty-icon">📖</div><h3>No courses</h3></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(c => `
      <tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td>${esc(c.title)}</td>
        <td><span class="badge badge-blue">${c.units}u</span></td>
        <td>${c.level}</td>
        <td>${esc(c.semester_name)}</td>
        <td>${esc(c.lecturer_name || '—')}</td>
        <td>${esc(c.department_name || '—')}</td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${c.id}">Delete</button>
        </div></td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function formBody(c = {}) {
    const deptOpts = state.departments.map(d => `<option value="${d.id}" ${c.department_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
    const lectOpts = '<option value="">— None —</option>' + state.lecturers.map(l =>
      `<option value="${l.id}" ${c.lecturer_id === l.id ? 'selected' : ''}>${esc(l.full_name)}</option>`
    ).join('');
    return `
      <div class="field-row">
        <div class="field"><label>Code *</label><input class="input" id="f_code" value="${esc(c.code || '')}" /></div>
        <div class="field"><label>Units *</label>
          <select class="select" id="f_units">${[1,2,3,4,5,6].map(u => `<option value="${u}" ${c.units === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>Title *</label><input class="input" id="f_title" value="${esc(c.title || '')}" /></div>
      <div class="field"><label>Department *</label><select class="select" id="f_department">${deptOpts}</select></div>
      <div class="field"><label>Programme</label><select class="select" id="f_programme"><option value="">— None —</option></select></div>
      <div class="field-row">
        <div class="field"><label>Level *</label>
          <select class="select" id="f_level">${[100,200,300,400,500].map(l => `<option value="${l}" ${c.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Semester *</label>
          <select class="select" id="f_semester">
            ${['First','Second','Summer'].map(s => `<option value="${s}" ${c.semester_name === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label>Lecturer</label><select class="select" id="f_lecturer">${lectOpts}</select></div>
    `;
  }

  async function refreshProgrammeOptions(deptId, selected = null) {
    await loadProgrammes(deptId);
    const sel = document.querySelector('#f_programme');
    if (!sel) return;
    sel.innerHTML = '<option value="">— None —</option>' +
      state.programmes.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  }

  function openCreate() {
    openModal({
      title: 'New course', confirmText: 'Create', body: formBody({}),
      onReady: async (bd) => {
        const deptSel = bd.querySelector('#f_department');
        if (deptSel.value) await refreshProgrammeOptions(parseInt(deptSel.value, 10));
        deptSel.addEventListener('change', () => refreshProgrammeOptions(parseInt(deptSel.value, 10)));
      },
      onConfirm: async (bd, close) => {
        const payload = {
          code: bd.querySelector('#f_code').value.trim(),
          title: bd.querySelector('#f_title').value.trim(),
          units: parseInt(bd.querySelector('#f_units').value, 10),
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          programme_id: parseInt(bd.querySelector('#f_programme').value, 10) || null,
          level: parseInt(bd.querySelector('#f_level').value, 10),
          semester_name: bd.querySelector('#f_semester').value,
          lecturer_id: parseInt(bd.querySelector('#f_lecturer').value, 10) || null,
        };
        const { ok, data } = await api('/api/admin/courses', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Course created'); load();
      },
    });
  }

  function openEdit(id) {
    const c = state.items.find(x => x.id === id);
    if (!c) return;
    openModal({
      title: 'Edit course', subtitle: c.code, confirmText: 'Save changes', body: formBody(c),
      onReady: async (bd) => {
        const deptSel = bd.querySelector('#f_department');
        await refreshProgrammeOptions(parseInt(deptSel.value, 10), c.programme_id);
        deptSel.addEventListener('change', () => refreshProgrammeOptions(parseInt(deptSel.value, 10)));
      },
      onConfirm: async (bd, close) => {
        const payload = {
          code: bd.querySelector('#f_code').value.trim(),
          title: bd.querySelector('#f_title').value.trim(),
          units: parseInt(bd.querySelector('#f_units').value, 10),
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          programme_id: parseInt(bd.querySelector('#f_programme').value, 10) || null,
          level: parseInt(bd.querySelector('#f_level').value, 10),
          semester_name: bd.querySelector('#f_semester').value,
          lecturer_id: parseInt(bd.querySelector('#f_lecturer').value, 10) || null,
        };
        const { ok, data } = await api('/api/admin/courses/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Course updated'); load();
      },
    });
  }

  function doDelete(id) {
    const c = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete course?', subtitle: c ? c.code : '',
      message: 'This will also remove registrations and results.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/courses/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Course deleted'); load();
      },
    });
  }

  function bindFilters() {
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 300);
    });
    $('#deptFilter').addEventListener('change', e => { state.department_id = e.target.value; load(); });
    $('#levelFilter').addEventListener('change', e => { state.level = e.target.value; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.search = ''; state.department_id = ''; state.level = '';
      $('#searchInput').value = ''; $('#deptFilter').value = ''; $('#levelFilter').value = '';
      load();
    });
    $('#btnNew').addEventListener('click', openCreate);
  }

  async function boot() { await loadAll(); bindFilters(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();