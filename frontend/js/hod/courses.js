// ============================================================
// HOD Courses — list, create, assign lecturer, edit, delete
// Self-contained with own modal / toast / API helpers.
// ============================================================

'use strict';

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function token() { return localStorage.getItem('sa_token'); }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: {
        'Authorization': 'Bearer ' + token(),
        'Content-Type': 'application/json',
      },
      ...opts,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      padding:12px 18px; border-radius:10px; font-size:14px; font-weight:600;
      box-shadow:0 10px 30px rgba(0,0,0,.18);
      background:${type === 'error' ? '#fee2e2' : '#dcfce7'};
      color:${type === 'error' ? '#991b1b' : '#166534'};
      transform:translateY(20px); opacity:0; transition:.25s;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)'; el.style.opacity = '1';
    });
    setTimeout(() => {
      el.style.transform = 'translateY(20px)'; el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  /**
   * Build a modal. Returns { close, backdrop }.
   */
  function openModal({ title, subtitle = '', body, confirmText = 'Save', cancelText = 'Cancel', onConfirm, size = '' }) {
    const root = $('#modalRoot') || (() => {
      const d = document.createElement('div');
      d.id = 'modalRoot';
      document.body.appendChild(d);
      return d;
    })();

    root.innerHTML = `
      <div class="modal-backdrop open">
        <div class="modal ${size}">
          <div class="modal-head">
            <div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div>
            <button class="modal-close" data-close type="button">×</button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost" data-close type="button">${esc(cancelText)}</button>
            <button class="btn btn-primary" data-confirm type="button">${esc(confirmText)}</button>
          </div>
        </div>
      </div>`;

    const backdrop = root.querySelector('.modal-backdrop');
    const close = () => backdrop.remove();

    backdrop.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    const confirmBtn = backdrop.querySelector('[data-confirm]');
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      const orig = confirmBtn.textContent;
      confirmBtn.textContent = 'Working...';
      try {
        await onConfirm(backdrop, close);
      } catch (err) {
        console.error(err);
        alert('Action failed.');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = orig;
      }
    });

    return { close, backdrop };
  }

  function confirmDialog({ title, message, onConfirm }) {
    openModal({
      title,
      size: 'sm',
      confirmText: 'Delete',
      body: `<p style="color:var(--red);line-height:1.5;">${esc(message)}</p>`,
      onConfirm: async (_bd, close) => {
        await onConfirm();
        close();
      },
    });
  }

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    items: [],
    lecturers: [],
    search: '',
    level: '',
    semester: '',
  };

  /* ============================================================
     LOAD
     ============================================================ */
  async function loadLecturers() {
    const { ok, data } = await api('/api/hod/lecturers');
    if (ok) state.lecturers = data.data || [];
  }

  async function loadCourses() {
    const tbody = $('#tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const { ok, data } = await api('/api/hod/courses');
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];
    render();
  }

  function render() {
    const tbody = $('#tbody');
    if (!tbody) return;

    let items = state.items;
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(c =>
        (c.code || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q)
      );
    }
    if (state.level) items = items.filter(c => String(c.level) === String(state.level));
    if (state.semester) items = items.filter(c => c.semester_name === state.semester);

    if (!items.length) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">📖</div>
            <h3>No courses found</h3>
            <p>Try adjusting filters or add a new course.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(c => `
      <tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td>${esc(c.title)}</td>
        <td><span class="badge badge-blue">${c.units}u</span></td>
        <td>${c.level}</td>
        <td>${esc(c.semester_name)}</td>
        <td>${esc(c.lecturer_name || '—')}</td>
        <td>${c.registered || 0}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-assign="${c.id}" title="Assign lecturer">👨‍🏫 Assign</button>
            <button class="btn btn-ghost btn-sm" data-edit="${c.id}" title="Edit course">Edit</button>
            <button class="btn btn-ghost btn-sm" data-del="${c.id}" title="Delete course">Delete</button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-assign]').forEach(b =>
      b.addEventListener('click', () => openAssign(parseInt(b.dataset.assign, 10))));
    tbody.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    tbody.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  /* ============================================================
     ASSIGN LECTURER
     ============================================================ */
  function openAssign(courseId) {
    const course = state.items.find(c => c.id === courseId);
    if (!course) return;

    if (!state.lecturers.length) {
      alert('No lecturers in your department yet.');
      return;
    }

    const options = state.lecturers.map(l =>
      `<option value="${l.id}">${esc((l.title || '') + ' ' + l.full_name)} (${esc(l.staff_id)})</option>`
    ).join('');

    openModal({
      title: 'Assign Lecturer',
      subtitle: `${course.code} — ${course.title}`,
      confirmText: 'Assign',
      body: `
        <div class="field">
          <label>Choose Lecturer</label>
          <select class="select" id="assignSelect">
            <option value="">— Select a lecturer —</option>
            ${options}
          </select>
        </div>
        <p style="font-size:13px;color:var(--ink-3);margin-top:8px;">
          The selected lecturer will be able to record attendance and enter scores for this course.
        </p>
      `,
      onConfirm: async (bd, close) => {
        const lecturer_id = parseInt(bd.querySelector('#assignSelect').value, 10);
        if (!lecturer_id) {
          alert('Please select a lecturer.');
          return;
        }
        const { ok, data } = await api(`/api/hod/courses/${courseId}/assign-lecturer`, {
          method: 'POST',
          body: JSON.stringify({ lecturer_id }),
        });
        if (!ok) {
          alert(data?.error || 'Failed to assign lecturer.');
          return;
        }
        close();
        toast('Lecturer assigned');
        loadCourses();
      },
    });
  }

  /* ============================================================
     CREATE COURSE
     ============================================================ */
  function openCreate() {
    openModal({
      title: 'New Course',
      subtitle: 'Add a course to your department',
      confirmText: 'Create',
      body: `
        <div class="field-row">
          <div class="field">
            <label>Code *</label>
            <input class="input" id="f_code" placeholder="e.g. CSC401" />
          </div>
          <div class="field">
            <label>Units *</label>
            <select class="select" id="f_units">
              ${[1,2,3,4,5,6].map(u => `<option value="${u}" ${u === 3 ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>Title *</label>
          <input class="input" id="f_title" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Level *</label>
            <select class="select" id="f_level">
              ${[100,200,300,400,500].map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Semester *</label>
            <select class="select" id="f_semester">
              <option value="First">First</option>
              <option value="Second">Second</option>
              <option value="Summer">Summer</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Lecturer (optional)</label>
          <select class="select" id="f_lecturer">
            <option value="">— Assign later —</option>
            ${state.lecturers.map(l => `<option value="${l.id}">${esc((l.title || '') + ' ' + l.full_name)}</option>`).join('')}
          </select>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          code: bd.querySelector('#f_code').value.trim(),
          title: bd.querySelector('#f_title').value.trim(),
          units: parseInt(bd.querySelector('#f_units').value, 10),
          level: parseInt(bd.querySelector('#f_level').value, 10),
          semester_name: bd.querySelector('#f_semester').value,
          lecturer_id: parseInt(bd.querySelector('#f_lecturer').value, 10) || null,
        };
        if (!payload.code || !payload.title) {
          alert('Code and Title are required.');
          return;
        }
        const { ok, data } = await api('/api/hod/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!ok) {
          alert(data?.error || 'Failed to create course.');
          return;
        }
        close();
        toast('Course created');
        loadCourses();
      },
    });
  }

  /* ============================================================
     EDIT COURSE
     ============================================================ */
  function openEdit(courseId) {
    const c = state.items.find(x => x.id === courseId);
    if (!c) return;

    openModal({
      title: 'Edit Course',
      subtitle: c.code,
      confirmText: 'Save Changes',
      body: `
        <div class="field-row">
          <div class="field">
            <label>Code</label>
            <input class="input" id="f_code" value="${esc(c.code)}" />
          </div>
          <div class="field">
            <label>Units</label>
            <select class="select" id="f_units">
              ${[1,2,3,4,5,6].map(u => `<option value="${u}" ${c.units === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>Title</label>
          <input class="input" id="f_title" value="${esc(c.title)}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Level</label>
            <select class="select" id="f_level">
              ${[100,200,300,400,500].map(l => `<option value="${l}" ${c.level === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Semester</label>
            <select class="select" id="f_semester">
              ${['First','Second','Summer'].map(s => `<option value="${s}" ${c.semester_name === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>Lecturer</label>
          <select class="select" id="f_lecturer">
            <option value="">— None —</option>
            ${state.lecturers.map(l => `<option value="${l.id}" ${c.lecturer_id === l.id ? 'selected' : ''}>${esc((l.title || '') + ' ' + l.full_name)}</option>`).join('')}
          </select>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          code: bd.querySelector('#f_code').value.trim(),
          title: bd.querySelector('#f_title').value.trim(),
          units: parseInt(bd.querySelector('#f_units').value, 10),
          level: parseInt(bd.querySelector('#f_level').value, 10),
          semester_name: bd.querySelector('#f_semester').value,
          lecturer_id: parseInt(bd.querySelector('#f_lecturer').value, 10) || null,
        };
        const { ok, data } = await api('/api/hod/courses/' + courseId, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (!ok) {
          alert(data?.error || 'Failed to update.');
          return;
        }
        close();
        toast('Course updated');
        loadCourses();
      },
    });
  }

  /* ============================================================
     DELETE COURSE
     ============================================================ */
  function doDelete(courseId) {
    const c = state.items.find(x => x.id === courseId);
    if (!c) return;

    confirmDialog({
      title: 'Delete Course?',
      message: `Are you sure you want to delete ${c.code} — ${c.title}? All related data will be removed.`,
      onConfirm: async () => {
        const { ok, data } = await api('/api/hod/courses/' + courseId, { method: 'DELETE' });
        if (!ok) {
          alert(data?.error || 'Failed to delete.');
          return;
        }
        toast('Course deleted');
        loadCourses();
      },
    });
  }

  /* ============================================================
     FILTERS
     ============================================================ */
  function bindFilters() {
    const searchInput = $('#searchInput');
    if (searchInput) {
      let t;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.search = e.target.value.trim();
          render();
        }, 250);
      });
    }

    const levelFilter = $('#levelFilter');
    if (levelFilter) {
      levelFilter.addEventListener('change', (e) => {
        state.level = e.target.value;
        render();
      });
    }

    const semesterFilter = $('#semesterFilter');
    if (semesterFilter) {
      semesterFilter.addEventListener('change', (e) => {
        state.semester = e.target.value;
        render();
      });
    }

    const resetBtn = $('#btnReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.search = '';
        state.level = '';
        state.semester = '';
        if (searchInput) searchInput.value = '';
        if (levelFilter) levelFilter.value = '';
        if (semesterFilter) semesterFilter.value = '';
        render();
      });
    }

    const newBtn = $('#btnNew');
    if (newBtn) {
      newBtn.addEventListener('click', openCreate);
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  async function boot() {
    if (window.__hodCoursesBooted) return;
    window.__hodCoursesBooted = true;
    console.log('[hod/courses] booting...');
    await loadLecturers();
    bindFilters();
    await loadCourses();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();