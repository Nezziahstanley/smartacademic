// ============================================================
// SMARTACADEMIC — Admin Settings Page Logic
// Self-contained: fetches settings, tracks changes, saves.
// ============================================================

'use strict';

(function () {
  const token = localStorage.getItem('sa_token');

  async function apiFetch(path, opts = {}) {
    const res = await fetch(path, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      ...opts,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  const dirty = {};

  /* ---------- Load settings ---------- */
  async function load() {
    const { ok, data } = await apiFetch('/api/admin/settings');
    if (!ok) {
      console.error('[settings] Failed to load:', data);
      return;
    }
    data.data.forEach(s => {
      const el = document.querySelector(`[data-key="${s.key}"]`);
      if (el) el.value = s.value ?? '';
    });

    // Load sessions
    const sess = await apiFetch('/api/admin/sessions');
    if (sess.ok) {
      const sel = document.querySelector('[data-key="current_session_id"]');
      const current = sel.value;
      sel.innerHTML = '<option value="">— Select session —</option>' +
        sess.data.data.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
      sel.value = current;
    }

    // Load semesters
    const sem = await apiFetch('/api/admin/semesters');
    if (sem.ok) {
      const sel = document.querySelector('[data-key="current_semester_id"]');
      const current = sel.value;
      sel.innerHTML = '<option value="">— Select semester —</option>' +
        sem.data.data.map(x => `<option value="${x.id}">${x.session_name} — ${x.name}</option>`).join('');
      sel.value = current;
    }

    console.log('[settings] loaded');
  }

  /* ---------- Track dirty fields ---------- */
  function bindDirtyTracking() {
    document.querySelectorAll('[data-key]').forEach(el => {
      const handler = () => { dirty[el.dataset.key] = el.value; };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  /* ---------- Save ---------- */
  async function saveAll() {
    const items = Object.entries(dirty).map(([key, value]) => ({ key, value }));
    const msgEl = document.getElementById('saveMsg');

    if (!items.length) {
      msgEl.className = 'msg msg-info show';
      msgEl.textContent = 'No changes to save.';
      setTimeout(() => msgEl.className = 'msg', 2500);
      return;
    }

    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    try {
      const res = await apiFetch('/api/admin/settings/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        msgEl.className = 'msg msg-error show';
        msgEl.textContent = res.data?.error || 'Failed to save.';
        return;
      }

      msgEl.className = 'msg msg-success show';
      msgEl.textContent = `✅ ${res.data.message || items.length + ' settings saved.'}`;
      Object.keys(dirty).forEach(k => delete dirty[k]);
      setTimeout(() => msgEl.className = 'msg', 3000);
    } catch (err) {
      msgEl.className = 'msg msg-error show';
      msgEl.textContent = 'Network error: ' + err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save All Changes';
    }
  }

  /* ---------- Tabs ---------- */
  function bindTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    if (window.__settingsBooted) return;
    window.__settingsBooted = true;
    console.log('[settings] booting...');
    bindTabs();
    bindDirtyTracking();
    const btn = document.getElementById('btnSave');
    if (btn) btn.addEventListener('click', saveAll);
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000); // fallback
})();