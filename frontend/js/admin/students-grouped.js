// ============================================================
// SMARTACADEMIC — Admin Students (grouped by department)
// Matric numbers are auto-generated on creation.
// ============================================================

'use strict';

(function () {
  const { $, api, esc, initials, openModal, confirmDelete, toast } = window.SACrud;
  const { mount } = window.SAAccordion;

  const state = {
    departments: [],
    search: '',
    meta: null,
    acc: null,
    allStudents: [],
  };

  /* ============================================================
     LOAD
     ============================================================ */
  async function load() {
    const host = $('#accordionHost');
    host.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px;"></div><div class="skeleton" style="height:80px;"></div>';

    const [deptRes, studentsRes] = await Promise.all([
      api('/api/admin/departments/overview'),
      api('/api/admin/students?limit=1000'),
    ]);

    if (!deptRes.ok || !studentsRes.ok) {
      host.innerHTML = '<div class="empty" style="padding:40px;"><div class="empty-icon">⚠</div><h3>Failed to load</h3></div>';
      return;
    }

    state.departments = deptRes.data.data;
    state.allStudents = studentsRes.data.data.items || [];

    const byDept = new Map();
    for (const s of state.allStudents) {
      if (!byDept.has(s.department_id)) byDept.set(s.department_id, []);
      byDept.get(s.department_id).push(s);
    }

    const acc = mount(host, { pageKey: 'admin_students' });
    state.acc = acc;

    const items = state.departments.map(d => {
      const list = byDept.get(d.id) || [];
      const filtered = state.search
        ? list.filter(s =>
            (s.full_name || '').toLowerCase().includes(state.search.toLowerCase()) ||
            (s.matric_no || '').toLowerCase().includes(state.search.toLowerCase()) ||
            (s.email || '').toLowerCase().includes(state.search.toLowerCase())
          )
        : list;

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        meta: {
          students: d.student_count,
          lecturers: d.lecturer_count,
          courses: d.course_count,
        },
        actionsHtml: `
          <button class="btn btn-ghost btn-sm" data-dept-import="${d.id}">📤 Import</button>
          <button class="btn btn-primary btn-sm" data-dept-new="${d.id}">+ Add</button>
        `,
        renderBody: () => renderStudentTable(filtered, d),
        onBodyReady: (bd) => wireBody(bd, d),
      };
    });

    acc.render(items);

    document.querySelectorAll('[data-dept-new]').forEach(b =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        openCreate(parseInt(b.dataset.deptNew, 10));
      }));
    document.querySelectorAll('[data-dept-import]').forEach(b =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        openImportModal(parseInt(b.dataset.deptImport, 10));
      }));
  }

  /* ============================================================
     TABLE
     ============================================================ */
  function renderStudentTable(students, dept) {
    if (!students.length) {
      return `
        <div class="empty" style="padding:40px;">
          <div class="empty-icon">🎓</div>
          <h3>No students ${state.search ? 'match your search' : 'in ' + esc(dept.name)}</h3>
          ${!state.search ? `<p>Click "+ Add" above to add one.</p>` : ''}
        </div>`;
    }

    return `
      <div class="table-wrap" style="box-shadow:none;border:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Matric</th>
              <th>Programme</th>
              <th>Level</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span class="profile-avatar" style="width:32px;height:32px;font-size:12px;${s.photo_url ? `background-image:url('${s.photo_url}');background-size:cover;background-position:center;color:transparent;` : ''}">
                      ${s.photo_url ? '' : esc(initials(s.full_name))}
                    </span>
                    <div>
                      <div style="font-weight:600;">${esc(s.full_name)}</div>
                      <div style="font-size:12px;color:var(--ink-3);">${esc(s.email)}</div>
                    </div>
                  </div>
                </td>
                <td>${esc(s.matric_no)}</td>
                <td>${esc(s.programme_name)}</td>
                <td><span class="badge badge-blue">${s.level}</span></td>
                <td>${s.is_active
                  ? '<span class="badge badge-green">Active</span>'
                  : '<span class="badge badge-gray">Inactive</span>'}</td>
                <td style="text-align:right;">
                  <div class="actions">
                    <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
                    <button class="btn btn-ghost btn-sm" data-del="${s.id}">Delete</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function wireBody(bd, dept) {
    bd.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10), dept)));
    bd.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10), dept)));
  }

  function findStudent(id) {
    return state.allStudents.find(s => s.id === id);
  }

  /* ============================================================
     CREATE — no matric input (auto-generated)
     ============================================================ */
  async function openCreate(departmentId) {
    const { ok, data } = await api('/api/admin/programmes?department_id=' + departmentId);
    const programmes = ok ? data.data : [];

    const dept = state.departments.find(d => d.id === departmentId);

    openModal({
      title: 'New Student',
      subtitle: dept ? dept.name : '',
      confirmText: 'Create',
      body: `
        <div class="field"><label>Full name *</label><input class="input" id="f_full_name" /></div>
        <div class="field"><label>Email *</label><input class="input" id="f_email" type="email" /></div>
        <div class="field"><label>Phone</label><input class="input" id="f_phone" /></div>

        <div class="msg msg-info show" style="margin:10px 0;font-size:13px;">
          🎓 The matric number will be <strong>generated automatically</strong>
          (FPU/&lt;SCHOOL&gt;/&lt;DEPT&gt;/&lt;LEVEL&gt;/&lt;YY&gt;/&lt;NNN&gt;).
        </div>

        <div class="field"><label>Programme *</label>
          <select class="select" id="f_programme">
            ${programmes.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>Level *</label>
            <select class="select" id="f_level">
              ${[100,200,300,400,500].map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Admission year</label><input class="input" id="f_year" type="number" value="${new Date().getFullYear()}" /></div>
        </div>
        <div class="field"><label>Password *</label><input class="input" id="f_password" value="Welcome@${Math.random().toString(36).slice(2,6)}" /></div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          department_id: departmentId,
          programme_id: parseInt(bd.querySelector('#f_programme').value, 10),
          level: parseInt(bd.querySelector('#f_level').value, 10),
          admission_year: parseInt(bd.querySelector('#f_year').value, 10),
          password: bd.querySelector('#f_password').value,
          // matric_no deliberately omitted — server generates it
        };
        const { ok, data } = await api('/api/admin/students', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        toast(`Student created · ${data.data.matric_no || ''}`);
        load();
      },
    });
  }

  /* ============================================================
     EDIT — matric field kept so admins can override for legacy
     ============================================================ */
  async function openEdit(studentId, dept) {
    const s = findStudent(studentId);
    if (!s) return;

    const { ok, data } = await api('/api/admin/programmes?department_id=' + s.department_id);
    const programmes = ok ? data.data : [];

    openModal({
      title: 'Edit Student',
      subtitle: s.email,
      confirmText: 'Save',
      body: `
        <div class="field"><label>Full name</label><input class="input" id="f_full_name" value="${esc(s.full_name)}" /></div>
        <div class="field"><label>Email</label><input class="input" id="f_email" type="email" value="${esc(s.email)}" /></div>
        <div class="field"><label>Phone</label><input class="input" id="f_phone" value="${esc(s.phone || '')}" /></div>
        <div class="field"><label>Matric number</label><input class="input" id="f_matric" value="${esc(s.matric_no)}" />
          <p style="font-size:12px;color:var(--ink-3);margin-top:4px;">
            Change only for legacy overrides. Format: FPU/&lt;SCHOOL&gt;/&lt;DEPT&gt;/&lt;LEVEL&gt;/&lt;YY&gt;/&lt;NNN&gt;
          </p>
        </div>
        <div class="field"><label>Programme</label>
          <select class="select" id="f_programme">
            ${programmes.map(p => `<option value="${p.id}" ${p.id === s.programme_id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>Level</label>
            <select class="select" id="f_level">
              ${[100,200,300,400,500].map(l => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Admission year</label><input class="input" id="f_year" type="number" value="${s.admission_year}" /></div>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          full_name: bd.querySelector('#f_full_name').value.trim(),
          email: bd.querySelector('#f_email').value.trim(),
          phone: bd.querySelector('#f_phone').value.trim() || null,
          matric_no: bd.querySelector('#f_matric').value.trim(),
          department_id: s.department_id,
          programme_id: parseInt(bd.querySelector('#f_programme').value, 10),
          level: parseInt(bd.querySelector('#f_level').value, 10),
          admission_year: parseInt(bd.querySelector('#f_year').value, 10),
        };
        const { ok, data } = await api('/api/admin/students/' + studentId, { method: 'PUT', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Student updated'); load();
      },
    });
  }

  function doDelete(studentId, dept) {
    const s = findStudent(studentId);
    if (!s) return;
    confirmDelete({
      title: 'Delete student?',
      subtitle: s.full_name,
      message: 'This will remove the student and all their records.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/admin/students/' + studentId, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        toast('Student deleted'); load();
      },
    });
  }

  /* ============================================================
     CSV IMPORT
     ============================================================ */
  function openImportModal(departmentId) {
    const dept = state.departments.find(d => d.id === departmentId);
    openModal({
      title: 'Import Students',
      subtitle: dept ? dept.name : '',
      size: 'lg',
      confirmText: 'Choose File',
      body: `
        <div class="msg msg-info show" style="margin-bottom:16px;">
          <strong>CSV format:</strong>
          <code style="font-size:12px;">full_name,email,phone,programme_code,level,admission_year</code>
          <br>
          <a href="/api/admin/students/import/template" download style="color:var(--primary);font-weight:600;margin-top:6px;display:inline-block;">
            📥 Download template
          </a>
          <p style="font-size:13px;margin-top:8px;color:#1e40af;">
            Matric numbers are auto-generated on import.
          </p>
        </div>
      `,
      onConfirm: async (_b, close) => {
        close();
        const input = $('#csvFile');
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const text = await file.text();
          toast('⏳ Importing...');

          const { ok, data } = await api('/api/admin/students/import', {
            method: 'POST',
            body: JSON.stringify({ csv: text, send_emails: true }),
          });
          if (!ok) { alert(data?.error || 'Import failed'); return; }

          const r = data.data;
          let summary = `✅ Imported: ${r.imported}\n⚠️ Skipped: ${r.skipped}`;
          if (r.errors.length) {
            summary += `\n\nErrors:\n${r.errors.slice(0, 5).map(x => `Line ${x.line}: ${x.error}`).join('\n')}`;
          }
          alert(summary);
          load();
          input.value = '';
        };
        input.click();
      },
    });
  }

  /* ============================================================
     GLOBAL CONTROLS
     ============================================================ */
  function bind() {
    let t;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.search = e.target.value.trim();
        load();
      }, 350);
    });

    $('#btnReset').addEventListener('click', () => {
      state.search = '';
      $('#searchInput').value = '';
      load();
    });

    $('#btnNew').addEventListener('click', () => {
      if (state.departments.length === 0) return;
      const options = state.departments.map(d =>
        `<option value="${d.id}">${esc(d.name)}</option>`).join('');
      openModal({
        title: 'Choose department',
        size: 'sm',
        confirmText: 'Continue',
        body: `
          <div class="field">
            <label>Which department is this student in?</label>
            <select class="select" id="f_dept">${options}</select>
          </div>`,
        onConfirm: (bd, close) => {
          const id = parseInt(bd.querySelector('#f_dept').value, 10);
          close();
          openCreate(id);
        },
      });
    });

    $('#btnExpandAll').addEventListener('click', () => {
      document.querySelectorAll('.dept-card').forEach(card => {
        if (!card.classList.contains('open')) card.querySelector('.dept-head')?.click();
      });
    });

    $('#btnCollapseAll').addEventListener('click', () => {
      document.querySelectorAll('.dept-card.open').forEach(card => {
        card.querySelector('.dept-head')?.click();
      });
    });
  }

  function boot() {
    if (window.__adminStudentsBooted) return;
    window.__adminStudentsBooted = true;
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1500);
})();