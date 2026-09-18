// ============================================================
// SMARTACADEMIC — Topbar + Component Loader
// Loads sidebar.html and topbar.html into the page, hydrates
// user info (including profile photo), wires notifications
// with deep-link navigation, profile menu, and Help & Support.
// Enforces authentication on every dashboard page.
// ============================================================

'use strict';

(function () {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE = {
    TOKEN: 'sa_token',
    ROLE:  'sa_role',
    USER:  'sa_user',
  };

  const ROLE_LABELS = {
    admin:    'Administrator',
    hod:      'Head of Department',
    lecturer: 'Lecturer',
    student:  'Student',
  };

  /* ============================================================
     1. AUTH GUARD
     ============================================================ */
  const token = localStorage.getItem(STORAGE.TOKEN);
  const role  = localStorage.getItem(STORAGE.ROLE);

  if (!token || !role) {
    window.location.href = '/login.html';
    return;
  }

  document.body.dataset.role = role;

  let currentUser = null;

  /* ============================================================
     2. COMPONENT LOADER
     ============================================================ */
  async function injectComponent(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to load ' + url);
      el.innerHTML = await res.text();
    } catch (err) {
      console.warn('[topbar] Component load failed:', url, err.message);
    }
  }

  /* ============================================================
     3. NOTIFICATIONS
     ============================================================ */
  async function loadNotifications() {
    try {
      const res = await fetch('/api/notifications?limit=10', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) return { items: [], unread: 0 };
      const json = await res.json();
      return json.data || { items: [], unread: 0 };
    } catch {
      return { items: [], unread: 0 };
    }
  }

  function renderNotifications(container, data) {
    const list = container.querySelector('.np-list');
    const badge = document.querySelector('.tb-badge[data-notif-badge]');

    if (badge) {
      badge.textContent = data.unread > 0 ? data.unread : '';
      badge.dataset.count = data.unread;
    }

    if (!list) return;

    if (!data.items || data.items.length === 0) {
      list.innerHTML = `
        <div class="empty" style="padding: 40px 20px;">
          <div class="empty-icon">🔔</div>
          <h3>No notifications</h3>
          <p>You're all caught up.</p>
        </div>`;
      return;
    }

    list.innerHTML = data.items.map((n) => {
      const time = formatRelativeTime(n.created_at);
      const typeCls = n.type || 'system';
      const icon = typeIcon(typeCls);
      const link = n.link ? `data-link="${escapeHtml(n.link)}"` : '';
      const clickable = n.link ? 'style="cursor:pointer;"' : '';
      return `
        <div class="np-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" ${link} ${clickable}>
          <div class="np-ico ${typeCls}">${icon}</div>
          <div class="np-body">
            <strong>${escapeHtml(n.title)}</strong>
            <p>${escapeHtml(n.message)}</p>
            <div class="np-time">${time}</div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = parseInt(el.dataset.id, 10);
        const link = el.dataset.link;

        // Mark read first (best effort)
        if (el.classList.contains('unread')) {
          try {
            await fetch('/api/notifications/' + id + '/read', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + token },
            });
            el.classList.remove('unread');
            // Decrement badge
            const badge = document.querySelector('.tb-badge[data-notif-badge]');
            if (badge) {
              const n = Math.max(0, parseInt(badge.dataset.count || '0', 10) - 1);
              badge.textContent = n > 0 ? n : '';
              badge.dataset.count = n;
            }
          } catch { /* ignore */ }
        }

        // Navigate if there's a deep-link
        if (link) window.location.href = link;
      });
    });
  }

  function typeIcon(type) {
    return {
      risk_alert: '⚠',
      attendance_alert: '📅',
      result: '📊',
      intervention: '🤝',
      announcement: '📢',
      system: 'ℹ',
    }[type] || 'ℹ';
  }

  function formatRelativeTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================================
     4. HYDRATE USER (name, role, email, PHOTO)
     ============================================================ */
  function hydrateUser(user) {
    currentUser = user;
    const name = user.full_name || 'User';
    const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    // Avatar (photo OR initials)
    $$('[data-user-avatar]').forEach(el => {
      if (user.photo_url) {
        el.textContent = '';
        el.style.backgroundImage = `url('${user.photo_url}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.color = 'transparent';
      } else {
        el.textContent = initials;
        el.style.backgroundImage = '';
        el.style.color = '';
      }
    });

    $$('[data-user-name]').forEach(el => el.textContent = name);
    $$('[data-user-role]').forEach(el => el.textContent = ROLE_LABELS[user.role_name] || user.role_name);
    $$('[data-user-email]').forEach(el => el.textContent = user.email);

    const sbRole = $('[data-sidebar-role]');
    if (sbRole) sbRole.textContent = ROLE_LABELS[user.role_name] || user.role_name;
  }

  /* ============================================================
     5. PROFILE MENU
     ============================================================ */
  function wireProfileMenu() {
    const profile = $('.profile');
    if (!profile) return;

    const btn = profile.querySelector('.profile-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        profile.classList.toggle('open');
      });
    }

    document.addEventListener('click', (e) => {
      if (!profile.contains(e.target)) profile.classList.remove('open');
    });

    const base =
      role === 'admin'    ? '/admin' :
      role === 'hod'      ? '/hod' :
      role === 'lecturer' ? '/lecturer' :
                            '/student';

    const profileLink  = profile.querySelector('[data-profile-link]');
    const settingsLink = profile.querySelector('[data-settings-link]');
    const helpLink     = profile.querySelector('[data-help-link]');

    if (profileLink) {
      profileLink.setAttribute('href', `${base}/profile.html`);
    }

    if (settingsLink) {
      if (role === 'admin') {
        settingsLink.setAttribute('href', '/admin/settings.html');
      } else {
        settingsLink.setAttribute('href', `${base}/profile.html#change-password`);
      }
    }

    if (helpLink) {
      if (role === 'student') {
        helpLink.setAttribute('href', '/student/support.html');
      } else {
        helpLink.setAttribute('href', '#');
        helpLink.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          profile.classList.remove('open');
          showHelpModal();
        });
      }
    }

    profile.querySelectorAll('.pm-item').forEach(item => {
      if (item.hasAttribute('data-logout')) return;
      if (item === helpLink) return;
      item.addEventListener('click', () => {
        setTimeout(() => profile.classList.remove('open'), 150);
      });
    });
  }

  /* ============================================================
     6. HELP MODAL
     ============================================================ */
  function showHelpModal() {
    const existing = document.getElementById('saHelpModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'saHelpModal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(15,23,42,.55);
      backdrop-filter: blur(4px);
      display: grid; place-items: center;
      padding: 20px;
    `;
    modal.innerHTML = `
      <div style="
        background: #fff; border-radius: 16px; max-width: 520px;
        width: 100%; padding: 28px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 20px 50px rgba(0,0,0,.25);
        max-height: 90vh; overflow-y: auto;
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <h2 style="margin:0;font-size:20px;color:#0f172a;">Help &amp; Support</h2>
            <p style="margin:4px 0 0;color:#64748b;font-size:14px;">We're here to help you with SMARTACADEMIC</p>
          </div>
          <button id="saHelpClose" style="
            width:32px;height:32px;border:none;background:#f1f5f9;border-radius:8px;
            cursor:pointer;font-size:18px;color:#64748b;
          ">×</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <a href="mailto:chosenmopol2003@gmail.com" style="
            display:flex;gap:12px;align-items:center;padding:14px;
            background:#f8fafc;border-radius:10px;text-decoration:none;color:#0f172a;
            border:1px solid #e2e8f0;
          ">
            <div style="width:40px;height:40px;border-radius:10px;background:#eef2ff;color:#166534;display:grid;place-items:center;font-size:18px;">📧</div>
            <div>
              <div style="font-weight:700;font-size:14px;">Email Support</div>
              <div style="font-size:13px;color:#64748b;">chosenmopol2003@gmail.com</div>
            </div>
          </a>

          <a href="https://wa.me/2347041145338" target="_blank" style="
            display:flex;gap:12px;align-items:center;padding:14px;
            background:#f0fdf4;border-radius:10px;text-decoration:none;color:#0f172a;
            border:1px solid #bbf7d0;
          ">
            <div style="width:40px;height:40px;border-radius:10px;background:#dcfce7;color:#16a34a;display:grid;place-items:center;font-size:18px;">💬</div>
            <div>
              <div style="font-weight:700;font-size:14px;">WhatsApp</div>
              <div style="font-size:13px;color:#64748b;">+234 704 114 5338</div>
            </div>
          </a>

          <a href="tel:+2349016162662" style="
            display:flex;gap:12px;align-items:center;padding:14px;
            background:#fffbeb;border-radius:10px;text-decoration:none;color:#0f172a;
            border:1px solid #fde68a;
          ">
            <div style="width:40px;height:40px;border-radius:10px;background:#fef3c7;color:#d97706;display:grid;place-items:center;font-size:18px;">📞</div>
            <div>
              <div style="font-weight:700;font-size:14px;">Phone Call</div>
              <div style="font-size:13px;color:#64748b;">0901 616 2662</div>
            </div>
          </a>
        </div>

        <button id="saHelpClose2" style="
          width:100%;margin-top:20px;padding:12px;border:none;border-radius:10px;
          background:#166534;color:#fff;font-weight:700;font-size:14px;cursor:pointer;
        ">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('saHelpClose').addEventListener('click', close);
    document.getElementById('saHelpClose2').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  /* ============================================================
     7. NOTIFICATIONS PANEL
     ============================================================ */
  function wireNotifications() {
    const btn = $('[data-toggle-notifs]');
    const panel = $('#notifPanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        const data = await loadNotifications();
        renderNotifications(panel, data);
      }
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    const markAll = panel.querySelector('[data-mark-all-read]');
    if (markAll) {
      markAll.addEventListener('click', async () => {
        try {
          await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
          });
          const data = await loadNotifications();
          renderNotifications(panel, data);
        } catch { /* ignore */ }
      });
    }
  }

  /* ============================================================
     8. BOOTSTRAP
     ============================================================ */
  async function boot() {
    await Promise.all([
      injectComponent('sidebarSlot', '/components/sidebar.html'),
      injectComponent('topbarSlot',  '/components/topbar.html'),
    ]);

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) {
        localStorage.removeItem(STORAGE.TOKEN);
        localStorage.removeItem(STORAGE.ROLE);
        localStorage.removeItem(STORAGE.USER);
        window.location.href = '/login.html';
        return;
      }
      const json = await res.json();
      hydrateUser(json.data.user);
      localStorage.setItem(STORAGE.USER, JSON.stringify(json.data.user));
    } catch {
      const cached = localStorage.getItem(STORAGE.USER);
      if (cached) {
        try { hydrateUser(JSON.parse(cached)); } catch { /* ignore */ }
      }
    }

    if (window.Sidebar) window.Sidebar.init();

    wireProfileMenu();
    wireNotifications();

    document.dispatchEvent(new CustomEvent('sa:layout-ready'));
  }

  window.AuthContext = {
    get token() { return localStorage.getItem(STORAGE.TOKEN); },
    get role()  { return localStorage.getItem(STORAGE.ROLE); },
    get user()  { return currentUser; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();