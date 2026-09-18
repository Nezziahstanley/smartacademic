// ============================================================
// SMARTACADEMIC — Admin Courses (grouped by department)
// ============================================================

'use strict';

(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const { mount } = window.SAAccordion;

  const state = {
    departments: [],
    courses: [],
    lecturers: [],
    programmes: [],
    search: '',
  };

  async function load() {
    const host = $('#accordionHost');
    host.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px;"></div><div class="skeleton" style="height:80px;"></div>';

    const [deptRes, courseRes, lectRes] = await Promise.all([
      api('/api/admin/departments/overview'),
      api('/api/admin/courses'),
      api('/api/admin/lecturers?limit=1000'),
    ]);

    if (!deptRes.ok || !courseRes.ok) {
      host.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">⚠</div><h3>Failed to load</h3></div>';
      return;
    }

    state.departments = deptRes.data.data;
    state.courses = courseRes.data.data || [];
    state.lecturers = lectRes.ok ? lectRes.data.data.items : [];

    const byDept = new Map();
    for (const c of state.courses) {
      if (!byDept.has(c.department_id)) byDept.set(c.department_id, []);
      byDept.get(c.department_id).push(c);
    }

    const acc = mount(host, { pageKey: 'admin_courses' });

    const items = state.departments.map(d => {
      const list = byDept.get(d.id) || [];
      const filtered = state.search
        ? list.filter(c =>
            (c.code || '').toLowerCase().includes(state.search.toLowerCase()) ||
            (c.title || '').toLowerCase().includes(state.search.toLowerCase()))
        : list;

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        meta: {
          courses: d.course_count,
          lecturers: d.lecturer_count,
        },
        actionsHtml: `
          <button class="btn btn-primary btn-sm" data-dept-new="${d.id}">+ Add Course</button>
        `,
        renderBody: () => renderCourseTable(filtered, d),
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

  function renderCourseTable(courses, dept) {
    if (!courses.length) {
      return `
        <div class="empty" style="padding:40px;">
          <div class="empty-icon">📖</div>
          <h3>No courses ${state.search ? 'match your search' : 'in ' + esc(dept.name)}</h3>
        </div>`;
    }

    // Group by level inside the department
    const byLevel = new Map();
    for (const c of courses) {
      if (!byLevel.has(c.level)) byLevel.set(c.level, []);
      byLevel.get(c.level).push(c);
    }
    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);

    return levels.map(level => {
      const levelCourses = byLevel.get(level);
      const totalUnits = levelCourses.reduce((s, c) => s + (c.units || 0), 0);
      return `
        <div style="padding:14px 20px 6px;display:flex;align-items:center;gap:12px;">
          <span class="badge badge-blue">Level ${level}</span>
          <span style="font-size:12.5px;color:var(--ink-3);">
            ${levelCourses.length} course(s) · ${totalUnits} units
          </span>
        </div>
        <div class="table-wrap" style="box-shadow:none;border:none;">
          <table class="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Units</th>
                <th>Semester</th>
                <th>Lecturer</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${levelCourses.map(c => `
                <tr>
                  <td><strong>${esc(c.code)}</strong></td>
                  <td>${esc(c.title)}</td>
                  <td><span class="badge badge-blue">${c.units}u</span></td>
                  <td>${esc(c.semester_name)}</td>
                  <td>${esc(c.lecturer_name || '—')}</td>
                  <td style="text-align:right;">
                    <div class="actions">
                      <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Edit</button>
                      <button class="btn btn-ghost btn-sm" data-del="${c.id}">Delete</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }).join('');
  }

  function wireBody(bd) {
    bd.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    bd.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function findCourse(id) { return state.courses.find(c => c.id === id); }

  function formBody(c = {}) {
    const deptId = c.department_id;
    const lectOptions = state.lecturers
      .filter(l => !deptId || l.department_id === deptId)
      .map(l => `<option value="${l.id}" ${c.lecturer_id === l.id ? 'selected' : ''}>${esc(l.full_name)}</option>`)
      .join('');

    return `
      <div class="field-row">
        <div class="field"><label>Code *</label><input class="input" id="f_code" value="${esc(c.code || '')}" /></div>
        <div class="field"><label>Units *</label>
          <select class="select" id="f_units">
            ${[1,2,3,4,5,6].map(u => `<option value="${u}" ${c.units === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label>Title *</label><input class="input" id="f_title" value="${esc(c.title || '')}" /></div>
      <div class="field-row">
        <div class="field"><label>Level *</label>
          <select class="select" id="f_level">
            ${[100,200,300,400,500].map(l => `<option value="${l}" ${c.level === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Semester *</label>
          <select class="select" id="f_semester">
            ${['First','Second','Summer'].map(s => `<option value="${s}" ${c.semester_name === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label>Lecturer</label>
        <select class="select" id="f_lecturer">
          <option value="">— None —</option>
          ${lectOptions}
        </select>
      </div>`;
  }

  function openCreate(departmentId) {
    const dept = state.departments.find(d => d.id === departmentId);
    openModal({
      title: 'New Course',
      subtitle: dept ? dept.name : '',
      confirmText: 'Create',
      body: formBody({ department_id: departmentId }),
      onConfirm: async (bd, close) => {
        const payload = {
          code: bd.querySelector('#f_code').value.trim(),
          title: bd.querySelector('#f_title').value.trim(),
          units: parseInt(bd.querySelector('#f_units').value, 10),
          department_id: departmentId,
          level: parseInt(bd.querySelector('#f_level').value, 10),
          semester_name: bd.querySelector('#f_semester').value,
          lecturer_id: parseInt(bd.querySelector('#f_lecturer').value, 10) || null,
        };
        if (!payload.code || !payload.title) { alert('Code and Title are required'); return; }
        const { ok, data } = await api('/api/admin/courses', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Course created'); load();
      },
    });
  }

  function openEdit(id) {
    const c = findCourse(id);
    if (!c) return;
    openModal({
      title: 'Edit Course',
      subtitle: c.code,
      confirmText: 'Save',
      body: formBody(c),
      onConfirm: async (bd, close) => {
        const payload = {
          code: bd.querySelector('#f_code').value.trim(),
          title: bd.querySelector('#f_title').value.trim(),
          units: parseInt(bd.querySelector('#f_units').value, 10),
          department_id: c.department_id,
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
    const c = findCourse(id);
    if (!c) return;
    confirmDelete({
      title: 'Delete course?',
      subtitle: `${c.code} — ${c.title}`,
      message: 'This will also remove registrations and results.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/courses/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Course deleted'); load();
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
            <label>Which department does this course belong to?</label>
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
    if (window.__adminCoursesBooted) return;
    window.__adminCoursesBooted = true;
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1500);
})();