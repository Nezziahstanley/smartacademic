'use strict';
(function () {
  const { $, api, esc, openModal, toast } = window.SACrud;
  let courses = [];
  let currentCourseId = new URLSearchParams(location.search).get('course') || '';

  async function loadCourses() {
    const { ok, data } = await api('/api/lecturer/courses');
    if (!ok) return;
    courses = data.data;
    $('#courseFilter').innerHTML = '<option value="">Select course</option>' +
      courses.map(c => `<option value="${c.id}" ${String(c.id) === currentCourseId ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`).join('');
    if (currentCourseId) loadSessions();
  }

  async function loadSessions() {
    if (!currentCourseId) return;
    $('#sessionsWrap').innerHTML = '<div class="skeleton" style="height:100px;"></div>';
    const { ok, data } = await api('/api/lecturer/class-sessions?course_id=' + currentCourseId);
    if (!ok) return;

    const sessions = data.data;
    if (!sessions.length) {
      $('#sessionsWrap').innerHTML = `<div class="empty" style="padding:40px;"><div class="empty-icon">📅</div><h3>No class sessions</h3><p>Click "New Class Session" to create one.</p></div>`;
      return;
    }
    $('#sessionsWrap').innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Date</th><th>Topic</th><th>Recorded</th><th style="text-align:right;">Actions</th>
          </tr></thead>
          <tbody>
            ${sessions.map(s => `
              <tr>
                <td>${new Date(s.session_date).toLocaleDateString()}</td>
                <td>${esc(s.topic || '—')}</td>
                <td>${s.recorded} students</td>
                <td><div class="actions">
                  <button class="btn btn-primary btn-sm" data-record="${s.id}">Record</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    $('#sessionsWrap').querySelectorAll('[data-record]').forEach(b => b.addEventListener('click', () => openAttendance(parseInt(b.dataset.record, 10))));
  }

  async function openAttendance(sessionId) {
    const { ok, data } = await api('/api/lecturer/attendance/' + sessionId);
    if (!ok) { alert('Failed'); return; }
    const { session, students } = data.data;

    const rowsHtml = students.map(s => `
      <tr>
        <td>${esc(s.full_name)}<div style="font-size:12px;color:var(--ink-3);">${esc(s.matric_no)}</div></td>
        <td>
          <select class="select" data-student="${s.id}">
            <option value="">—</option>
            <option value="present" ${s.status === 'present' ? 'selected' : ''}>Present</option>
            <option value="absent" ${s.status === 'absent' ? 'selected' : ''}>Absent</option>
            <option value="excused" ${s.status === 'excused' ? 'selected' : ''}>Excused</option>
          </select>
        </td>
        <td><input class="input" data-remarks="${s.id}" value="${esc(s.remarks || '')}" placeholder="Optional" /></td>
      </tr>`).join('');

    openModal({
      title: 'Record Attendance',
      subtitle: `${session.code} — ${session.title} · ${new Date(session.id ? '' : '').toString().slice(0,0) || ''}`,
      size: 'lg', confirmText: 'Save attendance',
      body: `
        <div class="table-wrap" style="box-shadow:none;">
          <table class="table">
            <thead><tr><th>Student</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <p style="margin-top:12px;font-size:13px;color:var(--ink-3);">Use "—" to leave unrecorded.</p>
      `,
      onConfirm: async (bd, close) => {
        const records = Array.from(bd.querySelectorAll('[data-student]')).map(sel => {
          const sid = parseInt(sel.dataset.student, 10);
          return {
            student_id: sid,
            status: sel.value || null,
            remarks: bd.querySelector(`[data-remarks="${sid}"]`).value.trim() || null,
          };
        }).filter(r => r.status);

        if (!records.length) { alert('No attendance entered.'); return; }

        const { ok } = await api('/api/lecturer/attendance/' + sessionId, {
          method: 'POST', body: JSON.stringify({ records }),
        });
        if (!ok) { alert('Failed'); return; }
        close(); toast('Attendance saved'); loadSessions();
      },
    });
  }

  function openNewSession() {
    if (!currentCourseId) { alert('Select a course first.'); return; }
    openModal({
      title: 'New Class Session', confirmText: 'Create',
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
        const { ok, data } = await api('/api/lecturer/class-sessions', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Session created'); loadSessions();
      },
    });
  }

  function bind() {
    $('#courseFilter').addEventListener('change', e => {
      currentCourseId = e.target.value;
      if (currentCourseId) loadSessions();
      else $('#sessionsWrap').innerHTML = '<div class="empty" style="padding:60px;">Select a course</div>';
    });
    $('#btnNewSession').addEventListener('click', openNewSession);
  }

  async function boot() { await loadCourses(); bind(); }
  document.addEventListener('sa:layout-ready', boot);
})();