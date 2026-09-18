// ============================================================
// Lecturer Attendance
// - Scoped to lecturer's own courses
// - Bulk "Mark all present"
// - Unsaved-changes guard
// - Excel export
// - Session status pills
// ============================================================

'use strict';

(function () {
  const { $, api, esc, openModal, toast } = window.SACrud;

  let courses = [];
  let currentCourseId = new URLSearchParams(location.search).get('course') || '';
  let currentSessions = [];
  let statusFilter = 'all';

  /* ============================================================
     LOAD COURSES
     ============================================================ */
  async function loadCourses() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    courses = data.data;

    $('#courseFilter').innerHTML =
      '<option value="">Select course…</option>' +
      courses.map(c =>
        `<option value="${c.id}" ${String(c.id) === currentCourseId ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)} (${c.registered})</option>`
      ).join('');

    if (currentCourseId) loadSessions();
    toggleHeaderButtons();
  }

  function toggleHeaderButtons() {
    $('#btnNewSession').disabled = !currentCourseId;
    $('#btnExport').disabled = !currentCourseId;
  }

  /* ============================================================
     LOAD SESSIONS
     ============================================================ */
  async function loadSessions() {
    if (!currentCourseId) return;

    $('#sessionsWrap').innerHTML = '<div class="skeleton" style="height:100px;"></div>';
    $('#statusPills').style.display = 'none';

    const { ok, data } = await api('/api/lecturer/class-sessions?course_id=' + currentCourseId);
    if (!ok) return;

    currentSessions = data.data;
    computeStatusCounts();

    if (!currentSessions.length) {
      $('#sessionsWrap').innerHTML = `
        <div class="empty" style="padding:40px;">
          <div class="empty-icon">📅</div>
          <h3>No class sessions</h3>
          <p>Click "New Class Session" to create one.</p>
        </div>`;
      return;
    }

    // Determine total students in the course (from the first session)
    const totalStudents = courses.find(c => String(c.id) === String(currentCourseId))?.registered || 0;

    const filtered = statusFilter === 'all'
      ? currentSessions
      : currentSessions.filter(s => classifySession(s, totalStudents) === statusFilter);

    if (!filtered.length) {
      $('#sessionsWrap').innerHTML = `
        <div class="empty" style="padding:40px;">
          <div class="empty-icon">🔎</div>
          <h3>No sessions match this filter</h3>
          <p>Try a different filter above.</p>
        </div>`;
      return;
    }

    $('#sessionsWrap').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Topic</th>
              <th>Recorded</th>
              <th>Coverage</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(s => {
              const pct = totalStudents ? Math.round((s.recorded / totalStudents) * 100) : 0;
              const cls = pct === 100 ? 'green' : pct > 0 ? 'yellow' : 'gray';
              return `
                <tr>
                  <td>${new Date(s.session_date).toLocaleDateString()}</td>
                  <td>${esc(s.topic || '—')}</td>
                  <td>${s.recorded} / ${totalStudents}</td>
                  <td><span class="badge badge-${cls}">${pct}%</span></td>
                  <td><div class="actions">
                    <button class="btn btn-primary btn-sm" data-record="${s.id}">Record</button>
                  </div></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    $('#sessionsWrap').querySelectorAll('[data-record]').forEach(b =>
      b.addEventListener('click', () => openAttendance(parseInt(b.dataset.record, 10))));
  }

  function classifySession(session, totalStudents) {
    if (!totalStudents) return 'empty';
    if (session.recorded === 0) return 'empty';
    if (session.recorded >= totalStudents) return 'complete';
    return 'partial';
  }

  function computeStatusCounts() {
    const total = courses.find(c => String(c.id) === String(currentCourseId))?.registered || 0;
    let cAll = currentSessions.length, cComplete = 0, cPartial = 0, cEmpty = 0;
    for (const s of currentSessions) {
      const k = classifySession(s, total);
      if (k === 'complete') cComplete++;
      else if (k === 'partial') cPartial++;
      else cEmpty++;
    }
    $('#cAll').textContent = cAll;
    $('#cComplete').textContent = cComplete;
    $('#cPartial').textContent = cPartial;
    $('#cEmpty').textContent = cEmpty;
    $('#statusPills').style.display = 'flex';
  }

  /* ============================================================
     ATTENDANCE MODAL
     ============================================================ */
  async function openAttendance(sessionId) {
    const { ok, data } = await api('/api/lecturer/attendance/' + sessionId);
    if (!ok) { alert('Failed to load attendance'); return; }

    const { session, students } = data.data;

    // Track original state for unsaved-changes detection
    const original = students.map(s => s.status || '');
    let dirty = false;
    let closeRequested = false;

    const rowsHtml = students.map(s => `
      <tr data-row="${s.id}">
        <td>
          <div style="font-weight:600;">${esc(s.full_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(s.matric_no)}</div>
        </td>
        <td>
          <select class="select" data-status="${s.id}">
            <option value="">—</option>
            <option value="present" ${s.status === 'present' ? 'selected' : ''}>Present</option>
            <option value="absent"  ${s.status === 'absent'  ? 'selected' : ''}>Absent</option>
            <option value="excused" ${s.status === 'excused' ? 'selected' : ''}>Excused</option>
          </select>
        </td>
        <td><input class="input" data-remarks="${s.id}" value="${esc(s.remarks || '')}" placeholder="Optional" /></td>
      </tr>`).join('');

    const modal = openModal({
      title: 'Record Attendance',
      subtitle: `${session.code} — ${session.title}`,
      size: 'lg',
      confirmText: 'Save attendance',
      body: `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
          <button type="button" class="btn btn-ghost btn-sm" id="mkAllPresent">✓ Mark all present</button>
          <button type="button" class="btn btn-ghost btn-sm" id="mkAllAbsent">✕ Mark all absent</button>
          <button type="button" class="btn btn-ghost btn-sm" id="clearAll">— Clear all</button>
          <span style="margin-left:auto;font-size:13px;color:var(--ink-3);" id="counter">0 present / ${students.length}</span>
        </div>
        <div class="table-wrap" style="box-shadow:none;max-height:480px;overflow-y:auto;">
          <table class="table">
            <thead><tr><th>Student</th><th style="width:140px;">Status</th><th>Remarks</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <p style="margin-top:12px;font-size:13px;color:var(--ink-3);">Use "—" to leave unrecorded.</p>
      `,
      onConfirm: async (bd, close) => {
        const records = Array.from(bd.querySelectorAll('[data-status]')).map(sel => {
          const sid = parseInt(sel.dataset.status, 10);
          return {
            student_id: sid,
            status: sel.value || null,
            remarks: bd.querySelector(`[data-remarks="${sid}"]`).value.trim() || null,
          };
        }).filter(r => r.status);

        if (!records.length) { alert('No attendance entered.'); return; }

        const { ok } = await api('/api/lecturer/attendance/' + sessionId, {
          method: 'POST',
          body: JSON.stringify({ records }),
        });
        if (!ok) { alert('Failed to save'); return; }
        dirty = false;
        close();
        toast('✅ Attendance saved');
        loadSessions();
      },
    });

    const bd = modal.backdrop;

    // ---- Bulk actions ----
    const setAll = (status) => {
      bd.querySelectorAll('[data-status]').forEach(sel => { sel.value = status; });
      updateCounter();
      checkDirty();
    };

    bd.querySelector('#mkAllPresent').addEventListener('click', () => setAll('present'));
    bd.querySelector('#mkAllAbsent').addEventListener('click', () => setAll('absent'));
    bd.querySelector('#clearAll').addEventListener('click', () => setAll(''));

    function updateCounter() {
      const present = bd.querySelectorAll('[data-status]').length
        ? Array.from(bd.querySelectorAll('[data-status]')).filter(s => s.value === 'present').length
        : 0;
      const total = bd.querySelectorAll('[data-status]').length;
      bd.querySelector('#counter').textContent = `${present} present / ${total}`;
    }

    function checkDirty() {
      const current = Array.from(bd.querySelectorAll('[data-status]')).map(s => s.value);
      dirty = JSON.stringify(current) !== JSON.stringify(original);
    }

    bd.querySelectorAll('[data-status], [data-remarks]').forEach(el => {
      el.addEventListener('input', () => { updateCounter(); checkDirty(); });
      el.addEventListener('change', () => { updateCounter(); checkDirty(); });
    });

    updateCounter();

    // ---- Unsaved-changes guard ----
    // Override the modal's close handlers to intercept
    bd.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!dirty) return; // let it close normally
        e.stopImmediatePropagation();
        e.preventDefault();
        confirmDiscard(() => {
          dirty = false;
          modal.close();
        });
      }, true); // capture phase
    });

    // Also intercept backdrop clicks
    const originalBackdrop = bd.getAttribute('data-click-bound');
    bd.addEventListener('click', (e) => {
      if (e.target !== bd) return;
      if (!dirty) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      confirmDiscard(() => {
        dirty = false;
        modal.close();
      });
    }, true);

    // Browser tab close
    window.addEventListener('beforeunload', (e) => {
      if (dirty && !closeRequested) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function confirmDiscard(onConfirm) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
    onConfirm();
  }

  /* ============================================================
     NEW SESSION MODAL
     ============================================================ */
  function openNewSession() {
    if (!currentCourseId) { alert('Select a course first.'); return; }

    openModal({
      title: 'New Class Session',
      confirmText: 'Create',
      body: `
        <div class="field"><label>Date *</label><input class="input" id="f_date" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
        <div class="field-row">
          <div class="field"><label>Start time</label><input class="input" id="f_start" type="time" /></div>
          <div class="field"><label>End time</label><input class="input" id="f_end" type="time" /></div>
        </div>
        <div class="field"><label>Topic</label><input class="input" id="f_topic" placeholder="e.g. Introduction to Trees" /></div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          course_id: parseInt(currentCourseId, 10),
          session_date: bd.querySelector('#f_date').value,
          start_time: bd.querySelector('#f_start').value || null,
          end_time: bd.querySelector('#f_end').value || null,
          topic: bd.querySelector('#f_topic').value.trim() || null,
        };
        const { ok, data } = await api('/api/lecturer/class-sessions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        toast('Session created');
        loadSessions();
      },
    });
  }

  /* ============================================================
     EXPORT — client-side CSV via the current session list
     ============================================================ */
  async function exportAttendance() {
    if (!currentCourseId) return;

    toast('⏳ Building export…');

    // Fetch full attendance summary for the course
    const { ok, data } = await api('/api/lecturer/attendance-summary/' + currentCourseId);
    if (!ok) { alert('Failed to export'); return; }

    const rows = data.data;
    if (!rows.length) { alert('No attendance data for this course.'); return; }

    const course = courses.find(c => String(c.id) === String(currentCourseId));
    const header = ['Student', 'Matric', 'Total Sessions', 'Present', 'Absent', 'Attendance %'];
    const lines = [header.join(',')];

    rows.forEach(r => {
      lines.push([
        `"${r.full_name}"`,
        r.matric_no,
        r.total,
        r.present,
        r.absent,
        r.pct ?? 0,
      ].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${course.code}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast('✅ Downloaded');
  }

  /* ============================================================
     BIND
     ============================================================ */
  function bind() {
    $('#courseFilter').addEventListener('change', e => {
      currentCourseId = e.target.value;
      statusFilter = 'all';
      document.querySelectorAll('#statusPills .pill').forEach(p =>
        p.classList.toggle('active', p.dataset.status === 'all'));
      toggleHeaderButtons();
      if (currentCourseId) loadSessions();
      else {
        $('#sessionsWrap').innerHTML = `
          <div class="empty" style="padding:60px 20px;">
            <div class="empty-icon">📅</div>
            <h3>Select a course</h3>
            <p>Choose one of your courses to view or record attendance.</p>
          </div>`;
        $('#statusPills').style.display = 'none';
      }
    });

    $('#btnNewSession').addEventListener('click', openNewSession);
    $('#btnExport').addEventListener('click', exportAttendance);

    document.querySelectorAll('#statusPills .pill').forEach(p => {
      p.addEventListener('click', () => {
        document.querySelectorAll('#statusPills .pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        statusFilter = p.dataset.status;
        loadSessions();
      });
    });

    $('#btnReset').addEventListener('click', () => {
      currentCourseId = '';
      statusFilter = 'all';
      $('#courseFilter').value = '';
      document.querySelectorAll('#statusPills .pill').forEach(p =>
        p.classList.toggle('active', p.dataset.status === 'all'));
      toggleHeaderButtons();
      $('#sessionsWrap').innerHTML = `
        <div class="empty" style="padding:60px 20px;">
          <div class="empty-icon">📅</div>
          <h3>Select a course</h3>
        </div>`;
      $('#statusPills').style.display = 'none';
    });
  }

  async function boot() {
    if (window.__lecturerAttendanceBooted) return;
    window.__lecturerAttendanceBooted = true;
    await loadCourses();
    bind();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();