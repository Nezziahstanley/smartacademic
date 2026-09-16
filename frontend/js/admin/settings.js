'use strict';
(function () {
  const { $, api, esc } = window.SACrud;
  let dirty = {}; // key → value

  const GROUP_LABELS = {
    general: 'General',
    academic: 'Academic',
    attendance: 'Attendance',
    assessment: 'Assessment',
    risk: 'Risk Thresholds',
  };

  async function load() {
    const { ok, data } = await api('/api/admin/settings');
    if (!ok) return;

    const grouped = {};
    data.data.forEach(s => {
      const g = s.category || 'general';
      (grouped[g] = grouped[g] || []).push(s);
    });

    const order = ['general', 'academic', 'attendance', 'assessment', 'risk'];
    $('#groups').innerHTML = order
      .filter(g => grouped[g])
      .map(g => `
        <div class="card mb-4">
          <div class="card-header"><div><h3>${esc(GROUP_LABELS[g] || g)}</h3></div></div>
          ${grouped[g].map(s => `
            <div class="field">
              <label>${esc(s.description || s.key)}</label>
              <input class="input" data-key="${esc(s.key)}" value="${esc(s.value)}" />
              <div style="font-size:11.5px;color:var(--muted);margin-top:4px;">Key: ${esc(s.key)}</div>
            </div>`).join('')}
        </div>`).join('');

    document.querySelectorAll('[data-key]').forEach(input => {
      input.addEventListener('input', e => {
        dirty[e.target.dataset.key] = e.target.value;
      });
    });
  }

  async function save() {
    const items = Object.entries(dirty).map(([key, value]) => ({ key, value }));
    if (!items.length) { toast('No changes'); return; }
    const btn = $('#btnSave');
    btn.disabled = true;
    const { ok, data } = await api('/api/admin/settings/bulk', { method: 'POST', body: JSON.stringify({ items }) });
    btn.disabled = false;
    if (!ok) { alert(data?.error || 'Failed'); return; }
    const msg = $('#msg');
    msg.className = 'msg msg-success show';
    msg.textContent = data.message || 'Settings saved.';
    dirty = {};
    setTimeout(() => { msg.className = 'msg'; }, 3000);
  }

  function boot() {
    load();
    $('#btnSave').addEventListener('click', save);
  }
  document.addEventListener('sa:layout-ready', boot);
})();