// ============================================================
// HOD Interventions — list, create, update, monitor
// Self-contained — no reliance on inline scripts
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

  function confirmDialog({ title, message, confirmText = 'Confirm', onConfirm }) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed; inset:0; z-index:9998; background:rgba(15,23,42,.55);
      backdrop-filter:blur(4px); display:grid; place-items:center; padding:20px;
    `;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25);">
        <h2 style="margin:0 0 10px;font-size:18px;">${esc(title)}</h2>
        <p style="margin:0 0 20px;color:var(--ink-3);line-height:1.5;">${esc(message)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-ghost" data-cancel type="button">Cancel</button>
          <button class="btn btn-primary" data-confirm type="button">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('[data-cancel]').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('[data-confirm]').addEventListener('click', async () => {
      await onConfirm();
      close();
    });
  }

  const state = { status: '', items: [] };

  const PRIORITY_BADGE = { low: 'badge-gray', medium: 'badge-blue', high: 'badge-orange', critical: 'badge-red' };
  const STATUS_BADGE = { Pending: 'badge-yellow', 'In Progress': 'badge-blue', Completed: 'badge-green', Closed: 'badge-gray' };
  const TYPE_LABELS = {
    academic_counselling: 'Academic counselling',
    tutorial_recommendation: 'Tutorial recommendation',
    lecturer_meeting: 'Lecturer meeting',
    hod_meeting: 'HOD meeting',
    attendance_improvement: 'Attendance improvement',
    study_support: 'Study support',
    course_advisory: 'Course advisory',
    other: 'Other',
  };

  /* ============================================================
     LOAD
     ============================================================ */
  async function load() {
    const tbody = $('#tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:22px;"></div></td></tr>';

    const p = new URLSearchParams();
    if (state.status) p.set('status', state.status);

    const { ok, data } = await api('/api/hod/interventions?' + p.toString());
    if (!ok) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--red);">Failed to load.</td></tr>';
      return;
    }

    state.items = data.data || [];

    if (state.items.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty" style="padding:40px;">
            <div class="empty-icon">🤝</div>
            <h3>No interventions</h3>
            <p>Create one from the Students page.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = state.items.map(i => `
      <tr>
        <td>
          <div style="font-weight:600;">${esc(i.student_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(i.matric_no)}</div>
        </td>
        <td>${esc(i.title)}</td>
        <td><span class="badge badge-gray">${esc(TYPE_LABELS[i.type] || i.type)}</span></td>
        <td>${esc(i.assignee_name || '—')}</td>
        <td><span class="badge ${PRIORITY_BADGE[i.priority] || 'badge-gray'}">${esc(i.priority)}</span></td>
        <td><span class="badge ${STATUS_BADGE[i.status] || 'badge-gray'}">${esc(i.status)}</span></td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-edit="${i.id}">Update</button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
  }

  /* ============================================================
     EDIT MODAL
     ============================================================ */
  function openEdit(id) {
    const item = state.items.find(x => x.id === id);
    if (!item) return;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed; inset:0; z-index:9998; background:rgba(15,23,42,.55);
      backdrop-filter:blur(4px); display:grid; place-items:center; padding:20px;
    `;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:520px;width:100%;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto;">
        <h2 style="margin:0 0 6px;font-size:20px;">Update Intervention</h2>
        <p style="margin:0 0 20px;color:var(--ink-3);font-size:13.5px;">${esc(item.student_name)} — ${esc(item.title)}</p>

        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Status</label>
          <select id="editStatus" class="select">
            ${['Pending','In Progress','Completed','Closed'].map(s =>
              `<option value="${s}" ${item.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Priority</label>
          <select id="editPriority" class="select">
            ${['low','medium','high','critical'].map(p =>
              `<option value="${p}" ${item.priority === p ? 'selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Notes</label>
          <textarea id="editNotes" class="textarea" rows="3">${esc(item.notes || '')}</textarea>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-ghost" data-cancel type="button">Cancel</button>
          <button class="btn btn-primary" data-save type="button">Save Changes</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('[data-cancel]').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('[data-save]').addEventListener('click', async () => {
      const payload = {
        status: modal.querySelector('#editStatus').value,
        priority: modal.querySelector('#editPriority').value,
        notes: modal.querySelector('#editNotes').value.trim() || null,
      };
      const { ok, data } = await api('/api/hod/interventions/' + id, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!ok) {
        alert(data?.error || 'Failed to update');
        return;
      }
      close();
      toast('Intervention updated');
      load();
    });
  }

  /* ============================================================
     FILTERS
     ============================================================ */
  function bind() {
    const statusFilter = $('#statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        state.status = e.target.value;
        load();
      });
    }

    const resetBtn = $('#btnReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.status = '';
        if (statusFilter) statusFilter.value = '';
        load();
      });
    }

    const newBtn = $('#btnNew');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        toast('Create interventions from the Students page', 'error');
      });
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    if (window.__hodInterventionsBooted) return;
    window.__hodInterventionsBooted = true;
    console.log('[hod/interventions] booting...');
    bind();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();