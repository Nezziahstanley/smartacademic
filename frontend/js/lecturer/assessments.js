// ============================================================
// Lecturer Assessments
// - Course-scoped
// - Bulk "leave blank to remove" + unsaved-changes guard
// - Export scored data to CSV
// ============================================================

'use strict';

(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;

  const state = {
    course_id: new URLSearchParams(location.search).get('course') || '',
    type: '',
    courses: [],
    items: [],
  };

  const TYPE_LABELS = { assignment: 'Assignment', test: 'Test', ca: 'CA', exam: 'Exam' };
  const TYPE_BADGE  = { assignment: 'badge-blue', test: 'badge-yellow', ca: 'badge-orange', exam: 'badge-red' };

  /* ============================================================
     LOAD COURSES
     ============================================================ */
  async function loadCourses() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    state.courses = data.data;

    $('#courseFilter').innerHTML =
      '<option value="">All my courses</option>' +
      state.courses.map(c =>
        `<option value="${c.id}" ${String(c.id) === state.course_id ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`
      ).join('');

    toggleExport();
  }

  function toggleExport() {
    $('#btnExport').disabled = !state.course_id;
  }

  /* ============================================================
     LOAD ASSESSMENTS
     ============================================================ */
  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const p = new URLSearchParams();
    if (state.course_id) p.set('course_id', state.course_id);

    const { ok, data } = await api('/api/lecturer/assessments?' + p.toString());
    if (!ok) {
      $('#tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    let items = data.data || [];
    if (state.type) items = items.filter(a => a.type === state.type);
    state.items = items;

    if (!items.length) {
      $('#tbody').innerHTML = `
        <tr><td colspan="8">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">📝</div>
            <h3>No assessments yet</h3>
            <p>Click "+ New Assessment" to create one.</p>
          </div>
        </td></tr>`;
      return;
    }

    $('#tbody').innerHTML = items.map(a => `
      <tr>
        <td><strong>${esc(a.course_code)}</strong></td>
        <td><span class="badge ${TYPE_BADGE[a.type] || 'badge-gray'}">${esc(TYPE_LABELS[a.type] || a.type)}</span></td>
        <td>${esc(a.title)}</td>
        <td>${a.max_score}</td>
        <td>${a.weight || 0}%</td>
        <td>${a.scored || 0}</td>
        <td>${a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}</td>
        <td><div class="actions">
          <button class="btn btn-primary btn-sm" data-scores="${a.id}">Enter Scores</button>
          <button class="btn btn-ghost btn-sm" data-del="${a.id}">Delete</button>
        </div></td>
      </tr>`).join('');

    $('#tbody').querySelectorAll('[data-scores]').forEach(b =>
      b.addEventListener('click', () => openScores(parseInt(b.dataset.scores, 10))));
    $('#tbody').querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => delAssessment(parseInt(b.dataset.del, 10))));
  }

  /* ============================================================
     CREATE ASSESSMENT
     ============================================================ */
  function openCreate() {
    if (!state.courses.length) {
      alert('You have no courses to add assessments to.');
      return;
    }

    openModal({
      title: 'New Assessment',
      subtitle: 'Create an assignment, test, CA, or exam',
      confirmText: 'Create',
      body: `
        <div class="field">
          <label>Course *</label>
          <select class="select" id="f_course">
            ${state.courses.map(c =>
              `<option value="${c.id}" ${String(c.id) === state.course_id ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Type *</label>
            <select class="select" id="f_type">
              <option value="assignment">Assignment</option>
              <option value="test">Test</option>
              <option value="ca">CA</option>
              <option value="exam">Exam</option>
            </select>
          </div>
          <div class="field">
            <label>Max Score *</label>
            <input class="input" id="f_max" type="number" value="30" min="1" max="100" />
          </div>
        </div>
        <div class="field">
          <label>Title *</label>
          <input class="input" id="f_title" placeholder="e.g. CA 1" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Weight (%)</label>
            <input class="input" id="f_weight" type="number" value="15" min="0" max="100" />
          </div>
          <div class="field">
            <label>Due Date</label>
            <input class="input" id="f_due" type="date" />
          </div>
        </div>
        <p style="font-size:12px;color:var(--ink-3);margin-top:8px;">
          💡 Total CA weights should sum to 30, exam weight to 70.
        </p>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          course_id: parseInt(bd.querySelector('#f_course').value, 10),
          type: bd.querySelector('#f_type').value,
          title: bd.querySelector('#f_title').value.trim(),
          max_score: parseInt(bd.querySelector('#f_max').value, 10),
          weight: parseInt(bd.querySelector('#f_weight').value, 10) || 0,
          due_date: bd.querySelector('#f_due').value || null,
        };
        if (!payload.title) { alert('Title is required.'); return; }
        if (!payload.max_score || payload.max_score < 1) { alert('Max score must be at least 1.'); return; }

        const { ok, data } = await api('/api/lecturer/assessments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!ok) { alert(data?.error || 'Failed to create assessment.'); return; }
        close();
        toast('✅ Assessment created');
        load();
      },
    });
  }

  /* ============================================================
     SCORES MODAL (bulk + guard)
     ============================================================ */
  async function openScores(assessmentId) {
    const { ok, data } = await api('/api/lecturer/assessments/' + assessmentId + '/scores');
    if (!ok) { alert('Failed to load scores.'); return; }

    const { assessment, students } = data.data;
    const original = students.map(s => s.score ?? '');
    let dirty = false;

    const rowsHtml = students.map(s => `
      <tr>
        <td>
          <div style="font-weight:600;">${esc(s.full_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(s.matric_no)}</div>
        </td>
        <td>
          <input class="input" type="number" min="0" max="${assessment.max_score}" step="0.1"
                 data-student="${s.id}"
                 value="${s.score !== null && s.score !== undefined ? s.score : ''}"
                 style="max-width:120px;" />
        </td>
      </tr>`).join('');

    const modal = openModal({
      title: 'Enter Scores',
      subtitle: `${assessment.code} — ${assessment.title} (max ${assessment.max_score})`,
      size: 'lg',
      confirmText: 'Save Scores',
      body: `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
          <button type="button" class="btn btn-ghost btn-sm" id="fillMax">Fill max</button>
          <button type="button" class="btn btn-ghost btn-sm" id="fillZero">Fill zero</button>
          <button type="button" class="btn btn-ghost btn-sm" id="clearAll">Clear all</button>
          <span style="margin-left:auto;font-size:13px;color:var(--ink-3);" id="counter">0 / ${students.length} scored</span>
        </div>
        <div class="msg msg-info show" style="margin-bottom:14px;">
          Leave blank to remove a score. Max is <strong>${assessment.max_score}</strong>.
        </div>
        <div class="table-wrap" style="box-shadow:none;max-height:450px;overflow-y:auto;">
          <table class="table">
            <thead><tr><th>Student</th><th style="width:140px;">Score</th></tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="2" style="text-align:center;color:var(--ink-3);">No students registered for this course.</td></tr>'}</tbody>
          </table>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const inputs = bd.querySelectorAll('[data-student]');
        const scores = [];
        let hasError = false;

        inputs.forEach(inp => {
          const val = inp.value === '' ? null : parseFloat(inp.value);
          if (val !== null && (isNaN(val) || val < 0 || val > assessment.max_score)) {
            hasError = true;
            inp.style.borderColor = 'var(--red)';
          }
          scores.push({ student_id: parseInt(inp.dataset.student, 10), score: val });
        });

        if (hasError) {
          alert('Some scores are invalid. Please check the highlighted fields.');
          return;
        }

        const { ok, data } = await api('/api/lecturer/assessments/' + assessmentId + '/scores', {
          method: 'POST',
          body: JSON.stringify({ scores }),
        });
        if (!ok) { alert(data?.error || 'Failed to save scores.'); return; }
        dirty = false;
        close();
        toast('✅ Scores saved');
        load();
      },
    });

    const bd = modal.backdrop;

    function updateCounter() {
      const filled = Array.from(bd.querySelectorAll('[data-student]')).filter(i => i.value !== '').length;
      bd.querySelector('#counter').textContent = `${filled} / ${students.length} scored`;
    }

    function checkDirty() {
      const current = Array.from(bd.querySelectorAll('[data-student]')).map(i => i.value);
      dirty = JSON.stringify(current) !== JSON.stringify(original);
    }

    bd.querySelectorAll('[data-student]').forEach(inp => {
      inp.addEventListener('input', () => { updateCounter(); checkDirty(); inp.style.borderColor = ''; });
    });

    bd.querySelector('#fillMax').addEventListener('click', () => {
      bd.querySelectorAll('[data-student]').forEach(i => i.value = assessment.max_score);
      updateCounter(); checkDirty();
    });
    bd.querySelector('#fillZero').addEventListener('click', () => {
      bd.querySelectorAll('[data-student]').forEach(i => i.value = 0);
      updateCounter(); checkDirty();
    });
    bd.querySelector('#clearAll').addEventListener('click', () => {
      bd.querySelectorAll('[data-student]').forEach(i => i.value = '');
      updateCounter(); checkDirty();
    });

    updateCounter();

    // Unsaved-changes guard
    bd.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!dirty) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        if (confirm('You have unsaved scores. Discard them?')) {
          dirty = false;
          modal.close();
        }
      }, true);
    });

    bd.addEventListener('click', (e) => {
      if (e.target !== bd) return;
      if (!dirty) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (confirm('You have unsaved scores. Discard them?')) {
        dirty = false;
        modal.close();
      }
    }, true);
  }

  /* ============================================================
     DELETE
     ============================================================ */
  function delAssessment(id) {
    confirmDelete({
      title: 'Delete assessment?',
      message: 'All scores for this assessment will also be deleted. This cannot be undone.',
      onConfirm: async () => {
        const { ok, data } = await api('/api/lecturer/assessments/' + id, { method: 'DELETE' });
        if (!ok) { alert(data?.error || 'Failed to delete.'); return; }
        toast('Assessment deleted');
        load();
      },
    });
  }

  /* ============================================================
     EXPORT
     ============================================================ */
  async function exportExcel() {
    if (!state.course_id) return;

    toast('⏳ Building export…');

    // Fetch all assessments for the course, then export their scored rows
    const { ok, data } = await api('/api/lecturer/assessments?course_id=' + state.course_id);
    if (!ok) { alert('Failed to load assessments'); return; }

    const assessments = data.data.filter(a => (a.scored || 0) > 0);
    if (!assessments.length) { alert('No scored assessments to export.'); return; }

    // Collect all rows: student, matric, assessment title, score
    const allRows = [];
    for (const a of assessments) {
      const { ok: ok2, data: data2 } = await api('/api/lecturer/assessments/' + a.id + '/scores');
      if (!ok2) continue;
      data2.data.students.forEach(s => {
        if (s.score === null || s.score === undefined) return;
        allRows.push({
          student: s.full_name,
          matric: s.matric_no,
          assessment: a.title,
          type: a.type,
          score: s.score,
          max: a.max_score,
        });
      });
    }

    if (!allRows.length) { alert('No scores to export.'); return; }

    const header = ['Student', 'Matric', 'Assessment', 'Type', 'Score', 'Max'];
    const lines = [header.join(',')];
    allRows.forEach(r => lines.push(
      `"${r.student}",${r.matric},"${r.assessment}",${r.type},${r.score},${r.max}`
    ));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const course = state.courses.find(c => String(c.id) === String(state.course_id));
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessments-${course.code}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast('✅ Downloaded');
  }

  /* ============================================================
     BIND
     ============================================================ */
  function bind() {
    $('#courseFilter').addEventListener('change', e => {
      state.course_id = e.target.value;
      toggleExport();
      load();
    });

    $('#typeFilter').addEventListener('change', e => {
      state.type = e.target.value;
      load();
    });

    $('#btnReset').addEventListener('click', () => {
      state.course_id = '';
      state.type = '';
      $('#courseFilter').value = '';
      $('#typeFilter').value = '';
      toggleExport();
      load();
    });

    $('#btnNew').addEventListener('click', openCreate);
    $('#btnExport').addEventListener('click', exportExcel);
  }

  async function boot() {
    if (window.__lecturerAssessmentsBooted) return;
    window.__lecturerAssessmentsBooted = true;
    await loadCourses();
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();