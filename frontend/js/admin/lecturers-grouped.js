// ============================================================
// SMARTACADEMIC — Admin Lecturers (grouped by department)
// ============================================================

'use strict';

(function () {
  const { $, api, esc, initials, openModal, confirmDelete, toast } = window.SACrud;
  const { mount } = window.SAAccordion;

  const state = {
    departments: [],
    lecturers: [],
    search: '',
  };

  async function load() {
    const host = $('#accordionHost');
    host.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px;"></div><div class="skeleton" style="height:80px;"></div>';

    const [deptRes, lectRes] = await Promise.all([
      api('/api/admin/departments/overview'),
      api('/api/admin/lecturers?limit=1000'),
    ]);

    if (!deptRes.ok || !lectRes.ok) {
      host.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">⚠</div><h3>Failed to load</h3></div>';
      return;
    }

    state.departments = deptRes.data.data;
    state.lecturers = lectRes.data.data.items || [];

    const byDept = new Map();
    for (const l of state.lecturers) {
      if (!byDept.has(l.department_id)) byDept.set(l.department_id, []);
      byDept.get(l.department_id).push(l);
    }

    const acc = mount(host, { pageKey: 'admin_lecturers' });

    const items = state.departments.map(d => {
      const list = byDept.get(d.id) || [];
      const filtered = state.search
        ? list.filter(l =>
            (l.full_name || '').toLowerCase().includes(state.search.toLowerCase()) ||
            (l.staff_id || '').toLowerCase().includes(state.search.toLowerCase()))
        : list;

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        meta: {
          lecturers: d.lecturer_count,
          courses: d.course_count,
          students: d.student_count,
        },
        actionsHtml: `
          <button class="btn btn-primary btn-sm" data-dept-new="${d.id}">+ Add</button>
        `,
        renderBody: () => renderTable(filtered, d),
        onBodyReady: (bd) => wireBody(bd),
      };
    });

    acc.render(items);

    document.querySelectorAll('[data-dept-new]').forEach(b =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        openCreate(parseInt(b.dataset.deptNew, 10));
      }));
  }

  function renderTable(lecturers, dept) {
    if (!lecturers.length) {
      return `
        <div class="empty" style="padding:40px;">
          <div class="empty-icon">👨‍🏫</div>
          <h3>No lecturers ${state.search ? 'match your search' : 'in ' + esc(dept.name)}</h3>
        </div>`;
    }
    return `
      <div class="table-wrap" style="box-shadow:none;border:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Lecturer</th>
              <th>Staff ID</th>
              <th>Title</th>
              <th>Courses</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${lecturers.map(l => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span class="profile-avatar" style="width:32px;height:32px;font-size:12px;">${esc(initials(l.full_name))}</span>
                    <div>
                      <div style="font-weight:600;">${esc(l.full_name)}</div>
                      <div style="font-size:12px;color:var(--ink-3);">${esc(l.email)}</div>
                    </div>
                  </div>
                </td>
                <td>${esc(l.staff_id)}</td>
                <td>${esc(l.title || '—')}</td>
                <td><span class="badge badge-blue">${l.course_count}</span></td>
                <td style="text-align:right;">
                  <div class="actions">
                    <button class="btn btn-ghost btn-sm" data-edit="${l.id}">Edit</button>
                    <button class="btn btn-ghost btn-sm" data-del="${l.id}">Delete</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function wireBody(bd) {
    bd.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    bd.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function findLecturer(id) { return state.lecturers.find(l => l.id === id); }

  function openCreate(departmentId) {
    const dept = state.departments.find(d => d.id === departmentId);
    openModal({
      title: 'New Lecturer',
      subtitle: dept ? dept.name : '',
      confirmText: 'Create',
      body: `
        <div class="field"><label>Title</label><input class="input" id="f_title" placeholder="Dr. / Prof. / Mr. / Mrs." /></div>
        <div class="field"><label>Full name *</label><input class="input" id="f_full_name" /></div>
        <div class="field"><label>Email *</label><input class="input" id="f_email" type="email" /></div>
        <div class="field"><label>Phone</label><input class="input" id="f_phone" /></div>
        <div class="field"><label>Staff ID *</label><input class="input" id="f_staff_id" /></div>
        <div class="field"><label>Password *</label><input class="input" id="f_password" value="Welcome@${Math.random().toString(36).slice(2,6)}" /></div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          title: bd.querySelector('#f_title').value.trim() || null,
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          staff_id: bd.querySelector('#f_staff_id').value.trim(),
          department_id: departmentId,
          password: bd.querySelector('#f_password').value,
        };
        const { ok, data } = await api('/api/admin/lecturers', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Lecturer created'); load();
      },
    });
  }

  function openEdit(id) {
    const l = findLecturer(id);
    if (!l) return;
    openModal({
      title: 'Edit Lecturer',
      subtitle: l.email,
      confirmText: 'Save',
      body: `
        <div class="field"><label>Title</label><input class="input" id="f_title" value="${esc(l.title || '')}" /></div>
        <div class="field"><label>Full name</label><input class="input" id="f_full_name" value="${esc(l.full_name)}" /></div>
        <div class="field"><label>Email</label><input class="input" id="f_email" type="email" value="${esc(l.email)}" /></div>
        <div class="field"><label>Phone</label><input class="input" id="f_phone" value="${esc(l.phone || '')}" /></div>
        <div class="field"><label>Staff ID</label><input class="input" id="f_staff_id" value="${esc(l.staff_id)}" /></div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          title: bd.querySelector('#f_title').value.trim() || null,
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          staff_id: bd.querySelector('#f_staff_id').value.trim(),
          department_id: l.department_id,
        };
        const { ok, data } = await api('/api/admin/lecturers/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Lecturer updated'); load();
      },
    });
  }

  function doDelete(id) {
    const l = findLecturer(id);
    if (!l) return;
    confirmDelete({
      title: 'Delete lecturer?',
      subtitle: l.full_name,
      message: 'This will remove the lecturer account.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/lecturers/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Lecturer deleted'); load();
      },
    });
  }

  function bind() {
    let t;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 350);
    });
    $('#btnReset').addEventListener('click', () => {
      state.search = ''; $('#searchInput').value = ''; load();
    });
    $('#btnNew').addEventListener('click', () => {
      if (!state.departments.length) return;
      const options = state.departments.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
      openModal({
        title: 'Choose department',
        size: 'sm',
        confirmText: 'Continue',
        body: `
          <div class="field">
            <label>Which department is this lecturer in?</label>
            <select class="select" id="f_dept">${options}</select>
          </div>`,
        onConfirm: (bd, close) => {
          const id = parseInt(bd.querySelector('#f_dept').value, 10);
          close(); openCreate(id);
        },
      });
    });
    $('#btnExpandAll').addEventListener('click', () => {
      document.querySelectorAll('.dept-card').forEach(c => {
        if (!c.classList.contains('open')) c.querySelector('.dept-head')?.click();
      });
    });
    $('#btnCollapseAll').addEventListener('click', () => {
      document.querySelectorAll('.dept-card.open').forEach(c =>
        c.querySelector('.dept-head')?.click());
    });
  }

  function boot() {
    if (window.__adminLecturersBooted) return;
    window.__adminLecturersBooted = true;
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1500);
})();