// ============================================================
// Lecturer At-Risk Students
// Two actions per row:
//   📝 Intervene      — Lecturer creates a direct intervention
//   ⬆️ Report to HOD  — Sends a notification to the HOD
// ============================================================

'use strict';

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);

  function token() { return localStorage.getItem('sa_token'); }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: {
        'Authorization': 'Bearer ' + token(),
        'Content-Type': 'application/json',
      },
      ...opts,
    });
    return { ok: res.ok, data: await res.json().catch(() => null) };
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

  function openModal({ title, subtitle = '', body, confirmText = 'Save', onConfirm, size = '' }) {
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
            <button class="btn btn-ghost" data-close type="button">Cancel</button>
            <button class="btn btn-primary" data-confirm type="button">${esc(confirmText)}</button>
          </div>
        </div>
      </div>`;

    const backdrop = root.querySelector('.modal-backdrop');
    const close = () => backdrop.remove();

    backdrop.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', close));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    backdrop.querySelector('[data-confirm]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Working...';
      try {
        await onConfirm(backdrop, close);
      } catch (err) {
        console.error(err);
        alert('Action failed.');
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    });

    return { close, backdrop };
  }

  const state = { items: [] };

  /* ============================================================
     LOAD
     ============================================================ */
  async function load() {
    const tbody = $('#tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const { ok, data } = await api('/api/lecturer/at-risk');
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];

    if (!state.items.length) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">🎉</div>
            <h3>No at-risk students</h3>
            <p>All your students are in good standing.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = state.items.map(s => {
      const cls = (s.risk_category || 'GREEN').toLowerCase();
      return `
        <tr>
          <td><div style="font-weight:600;">${esc(s.full_name)}</div></td>
          <td>${esc(s.matric_no)}</td>
          <td>${esc(s.course_code || '—')}</td>
          <td><span class="badge badge-${cls}"><span class="risk-dot ${cls}"></span>${s.risk_category}</span></td>
          <td><strong>${parseFloat(s.risk_score || 0).toFixed(1)}</strong></td>
          <td>${parseFloat(s.attendance_pct || 0).toFixed(1)}%</td>
          <td>${parseFloat(s.gpa || 0).toFixed(2)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-primary btn-sm" data-intervene="${s.student_id}">📝 Intervene</button>
              <button class="btn btn-ghost btn-sm" data-report="${s.student_id}">⬆️ Report to HOD</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-intervene]').forEach(b =>
      b.addEventListener('click', () => openIntervene(parseInt(b.dataset.intervene, 10))));
    tbody.querySelectorAll('[data-report]').forEach(b =>
      b.addEventListener('click', () => openReport(parseInt(b.dataset.report, 10))));
  }

  /* ============================================================
     INTERVENE — Lecturer creates an intervention directly
     ============================================================ */
  function openIntervene(studentId) {
    const stu = state.items.find(x => x.student_id === studentId);
    if (!stu) return;

    openModal({
      title: 'Create Intervention',
      subtitle: `${stu.full_name} (${stu.matric_no})`,
      confirmText: 'Create',
      body: `
        <div class="field">
          <label>Intervention Type *</label>
          <select class="select" id="f_type">
            <option value="tutorial_recommendation">Tutorial recommendation</option>
            <option value="lecturer_meeting">Lecturer meeting</option>
            <option value="study_support">Study support</option>
            <option value="attendance_improvement">Attendance improvement</option>
            <option value="course_advisory">Course advisory</option>
          </select>
        </div>
        <div class="field">
          <label>Title *</label>
          <input class="input" id="f_title" placeholder="e.g. Meet after class Friday" />
        </div>
        <div class="field">
          <label>Description</label>
          <textarea class="textarea" id="f_desc" rows="3" placeholder="Additional details..."></textarea>
        </div>
        <div class="field">
          <label>Priority</label>
          <select class="select" id="f_priority">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          type: bd.querySelector('#f_type').value,
          title: bd.querySelector('#f_title').value.trim(),
          description: bd.querySelector('#f_desc').value.trim() || null,
          priority: bd.querySelector('#f_priority').value,
        };
        if (!payload.title) { alert('Title is required.'); return; }

        const { ok, data } = await api(`/api/lecturer/at-risk/${studentId}/intervene`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        toast('Intervention created');
      },
    });
  }

  /* ============================================================
     REPORT TO HOD
     ============================================================ */
  function openReport(studentId) {
    const stu = state.items.find(x => x.student_id === studentId);
    if (!stu) return;

    openModal({
      title: 'Report to HOD',
      subtitle: `${stu.full_name} (${stu.matric_no})`,
      confirmText: 'Send Report',
      body: `
        <div class="msg msg-info show" style="margin-bottom:16px;">
          This will send a notification to your HOD asking them to create a formal intervention.
        </div>
        <div class="field">
          <label>Message to HOD (optional)</label>
          <textarea class="textarea" id="f_message" rows="4"
            placeholder="e.g. Missed 5 of last 7 classes. Recommend academic counselling."></textarea>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const payload = {
          message: bd.querySelector('#f_message').value.trim() || null,
        };
        const { ok, data } = await api(`/api/lecturer/at-risk/${studentId}/report-to-hod`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close();
        toast('Report sent to HOD');
      },
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    if (window.__lecturerAtRiskBooted) return;
    window.__lecturerAtRiskBooted = true;
    console.log('[lecturer/at-risk] booting...');
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();