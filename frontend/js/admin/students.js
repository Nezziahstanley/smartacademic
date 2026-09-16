'use strict';
(function () {
  const { $, api, esc, initials, openModal, confirmDelete, toast } = window.SACrud;
  const state = { page: 1, limit: 15, search: '', department_id: '', level: '', total: 0, items: [], departments: [], programmes: [] };

  async function loadDepartments() {
    const { ok, data } = await api('/api/admin/departments');
    if (ok) {
      state.departments = data.data;
      const sel = $('#deptFilter');
      sel.innerHTML = '<option value="">All departments</option>' +
        data.data.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    }
  }

  async function loadProgrammes(deptId) {
    if (!deptId) { state.programmes = []; return; }
    const { ok, data } = await api('/api/admin/programmes?department_id=' + deptId);
    if (ok) state.programmes = data.data;
  }

  async function load() {
    const p = new URLSearchParams({ page: state.page, limit: state.limit });
    if (state.search) p.set('search', state.search);
    if (state.department_id) p.set('department_id', state.department_id);
    if (state.level) p.set('level', state.level);

    const body = $('#tbody');
    body.innerHTML = '<tr><td colspan="6"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const { ok, data } = await api('/api/admin/students?' + p.toString());
    if (!ok) { body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>'; return; }
    state.items = data.data.items;
    state.total = data.data.total;
    render();
    renderPagination();
  }

  function render() {
    const body = $('#tbody');
    if (state.items.length === 0) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:40px;"><div class="empty-icon">🎓</div><h3>No students</h3><p>Click "+ New Student" to add one.</p></div></td></tr>';
      return;
    }
    body.innerHTML = state.items.map(s => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px;">
          <span class="profile-avatar" style="width:32px;height:32px;font-size:12px;">${esc(initials(s.full_name))}</span>
          <div><div style="font-weight:600;">${esc(s.full_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(s.email)}</div></div>
        </div></td>
        <td>${esc(s.matric_no)}</td>
        <td>${esc(s.department_name)}</td>
        <td>${esc(s.programme_name)}</td>
        <td><span class="badge badge-blue">${s.level}</span></td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${s.id}">Delete</button>
        </div></td>
      </tr>`).join('');

    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    $('#paginationInfo').textContent = state.total === 0 ? 'No results' : `Showing ${(state.page - 1) * state.limit + 1}–${Math.min(state.page * state.limit, state.total)} of ${state.total}`;
    const btns = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) btns.push(i);
      else if (btns[btns.length - 1] !== '…') btns.push('…');
    }
    $('#paginationButtons').innerHTML = `
      <button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>
      ${btns.map(n => n === '…' ? '<button disabled>…</button>' : `<button class="${n === state.page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('')}
      <button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;
    $('#paginationButtons').querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
      const p = parseInt(b.dataset.page, 10);
      if (p >= 1 && p <= totalPages) { state.page = p; load(); }
    }));
  }

  function formBody(s = {}) {
    const deptOpts = state.departments.map(d => `<option value="${d.id}" ${s.department_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
    return `
      <div class="field"><label>Full name *</label><input class="input" id="f_full_name" value="${esc(s.full_name || '')}" /></div>
      <div class="field"><label>Email *</label><input class="input" id="f_email" type="email" value="${esc(s.email || '')}" /></div>
      <div class="field"><label>Phone</label><input class="input" id="f_phone" value="${esc(s.phone || '')}" /></div>
      <div class="field"><label>Matric number *</label><input class="input" id="f_matric" value="${esc(s.matric_no || '')}" /></div>
      <div class="field"><label>Department *</label><select class="select" id="f_department">${deptOpts}</select></div>
      <div class="field"><label>Programme *</label><select class="select" id="f_programme"><option value="">Select department first</option></select></div>
      <div class="field-row">
        <div class="field"><label>Level *</label><select class="select" id="f_level">
          ${[100,200,300,400,500].map(l => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>Admission year</label><input class="input" id="f_year" type="number" value="${s.admission_year || new Date().getFullYear()}" /></div>
      </div>
      ${!s.id ? `<div class="field"><label>Password *</label><input class="input" id="f_password" value="Welcome@${Math.random().toString(36).slice(2,6)}" /></div>` : ''}
    `;
  }

  async function refreshProgrammeOptions(deptId, selectedId = null) {
    await loadProgrammes(deptId);
    const sel = document.querySelector('#f_programme');
    if (!sel) return;
    sel.innerHTML = state.programmes.map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.name)}</option>`
    ).join('') || '<option value="">No programmes</option>';
  }

  function openCreate() {
    openModal({
      title: 'New student', subtitle: 'Add a student to the system', confirmText: 'Create',
      body: formBody({}),
      onReady: async (bd) => {
        const deptSel = bd.querySelector('#f_department');
        if (deptSel.value) await refreshProgrammeOptions(parseInt(deptSel.value, 10));
        deptSel.addEventListener('change', () => refreshProgrammeOptions(parseInt(deptSel.value, 10)));
      },
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          matric_no: bd.querySelector('#f_matric').value.trim(),
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          programme_id: parseInt(bd.querySelector('#f_programme').value, 10),
          level: parseInt(bd.querySelector('#f_level').value, 10),
          admission_year: parseInt(bd.querySelector('#f_year').value, 10),
          password: bd.querySelector('#f_password').value,
        };
        const { ok, data } = await api('/api/admin/students', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Student created'); load();
      },
    });
  }

  function openEdit(id) {
    const s = state.items.find(x => x.id === id);
    if (!s) return;
    openModal({
      title: 'Edit student', subtitle: s.email, confirmText: 'Save changes',
      body: formBody(s),
      onReady: async (bd) => {
        const deptSel = bd.querySelector('#f_department');
        await refreshProgrammeOptions(parseInt(deptSel.value, 10), s.programme_id);
        deptSel.addEventListener('change', () => refreshProgrammeOptions(parseInt(deptSel.value, 10)));
      },
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          matric_no: bd.querySelector('#f_matric').value.trim(),
          department_id: parseInt(bd.querySelector('#f_department').value, 10),
          programme_id: parseInt(bd.querySelector('#f_programme').value, 10),
          level: parseInt(bd.querySelector('#f_level').value, 10),
          admission_year: parseInt(bd.querySelector('#f_year').value, 10),
        };
        const { ok, data } = await api('/api/admin/students/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Student updated'); load();
      },
    });
  }

  function doDelete(id) {
    const s = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete student?', subtitle: s ? s.full_name : '',
      message: 'This will remove the student and all their records.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/students/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Student deleted'); load();
      },
    });
  }

  // ... doDelete function ends here ...

/* ============================================================
   CSV IMPORT
   ============================================================ */
function openImportModal() {
  openModal({
    title: 'Bulk Import Students',
    subtitle: 'Upload a CSV with student details',
    size: 'lg',
    confirmText: 'Choose File',
    body: `
      <div class="msg msg-info show" style="margin-bottom:16px;">
        <strong>CSV format:</strong>
        <code style="font-size:12px;">full_name,email,phone,matric_no,department_code,programme_code,level,admission_year</code>
        <br>
        <a href="/api/admin/students/import/template" download style="color:var(--primary);font-weight:600;margin-top:6px;display:inline-block;">
          📥 Download template
        </a>
      </div>
      <p style="color:var(--ink-3);font-size:14px;margin-bottom:16px;">
        Emails will be sent to each student with their temporary password.
      </p>
    `,
    onConfirm: async (_bd, close) => {
      close();
      document.getElementById('csvFile').click();
    },
  });
}

async function handleCsvFile(file) {
  const text = await file.text();
  const toast = window.SACrud.toast;

  toast('⏳ Importing...');

  const { ok, data } = await api('/api/admin/students/import', {
    method: 'POST',
    body: JSON.stringify({ csv: text, send_emails: true }),
  });

  if (!ok) {
    alert(data?.error || 'Import failed');
    return;
  }

  const r = data.data;
  let summary = `✅ Imported: ${r.imported}\n⚠️ Skipped: ${r.skipped}`;
  if (r.errors.length) {
    summary += `\n\nErrors:\n${r.errors.slice(0, 5).map(e => `Line ${e.line}: ${e.error}`).join('\n')}`;
    if (r.errors.length > 5) summary += `\n... and ${r.errors.length - 5} more`;
  }
  alert(summary);
  load();
}

// ... bindFilters function starts here ...
  function bindFilters() {
    let t;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 300);
    });
    $('#deptFilter').addEventListener('change', e => { state.department_id = e.target.value; state.page = 1; load(); });
    $('#levelFilter').addEventListener('change', e => { state.level = e.target.value; state.page = 1; load(); });
    $('#btnReset').addEventListener('click', () => {
      state.search = ''; state.department_id = ''; state.level = ''; state.page = 1;
      $('#searchInput').value = ''; $('#deptFilter').value = ''; $('#levelFilter').value = '';
      load();
    });
    $('#btnNew').addEventListener('click', openCreate);
  // ⬇️ ADD THESE LINES AT THE END:
  $('#btnImport').addEventListener('click', openImportModal);

  $('#csvFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleCsvFile(file);
      e.target.value = ''; // reset so same file can be re-picked
    }
  });
}
  

  async function boot() {
    await loadDepartments();
    bindFilters();
    load();
  }
  document.addEventListener('sa:layout-ready', boot);
})();