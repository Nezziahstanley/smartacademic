'use strict';
(function () {
  const { $, api, esc, openModal, toast } = window.SACrud;

  const ICONS = {
    risk_alert: '⚠', attendance_alert: '📅', result: '📊',
    intervention: '🤝', announcement: '📢', system: 'ℹ',
  };

  function relTime(iso) {
    const d = new Date(iso);
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  async function load() {
    $('#list').innerHTML = '<li class="skeleton" style="height:60px;"></li>';
    const { ok, data } = await api('/api/notifications/all?limit=40');
    if (!ok) { $('#list').innerHTML = '<li style="text-align:center;padding:30px;color:var(--red);">Failed to load.</li>'; return; }
    if (!data.data.length) {
      $('#list').innerHTML = '<li class="empty" style="padding:40px 0;"><div class="empty-icon">🔔</div><h3>No notifications yet</h3></li>';
      return;
    }
    $('#list').innerHTML = data.data.map(n => `
      <li class="activity-item">
        <div class="activity-ico">${ICONS[n.type] || 'ℹ'}</div>
        <div class="activity-body">
          <strong>${esc(n.title)}</strong>
          <p>${esc(n.message)}</p>
          <div class="activity-time">
            To: ${esc(n.user_name)} (${esc(n.email)}) · ${relTime(n.created_at)}
          </div>
        </div>
      </li>`).join('');
  }

  function openBroadcast() {
    openModal({
      title: 'Broadcast notification', confirmText: 'Send',
      body: `
        <div class="field"><label>Title *</label><input class="input" id="f_title" placeholder="e.g. Exam timetable released" /></div>
        <div class="field"><label>Message *</label><textarea class="textarea" id="f_msg" rows="4" placeholder="Write the announcement..."></textarea></div>
        <div class="field"><label>Target roles</label>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">
            <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" value="admin" /> Admin</label>
            <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" value="hod" /> HOD</label>
            <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" value="lecturer" /> Lecturer</label>
            <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" value="student" checked /> Student</label>
          </div>
        </div>
      `,
      onConfirm: async (bd, close) => {
        const roles = Array.from(bd.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
        const payload = {
          title: bd.querySelector('#f_title').value.trim(),
          message: bd.querySelector('#f_msg').value.trim(),
          roles: roles.length ? roles : ['student'],
        };
        if (!payload.title || !payload.message) { alert('Title and message required'); return; }
        const { ok, data } = await api('/api/notifications/broadcast', { method: 'POST', body: JSON.stringify(payload) });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast(`Sent to ${data.count} users`); load();
      },
    });
  }

  function boot() {
    $('#btnBroadcast').addEventListener('click', openBroadcast);
    load();
  }
  document.addEventListener('sa:layout-ready', boot);
})();