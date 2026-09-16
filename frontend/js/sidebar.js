// ============================================================
// SMARTACADEMIC — Sidebar Behavior
// Mobile off-canvas, desktop collapse, active-link highlight,
// and logout. Injected into every dashboard page.
// ============================================================

'use strict';

(function () {
  /* ============================================================
     TOGGLE LOGIC
     ============================================================ */
  function isMobile() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function toggleSidebar() {
    if (isMobile()) {
      document.body.classList.toggle('sidebar-open');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
      const collapsed = document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem('sa_sidebar_collapsed', collapsed ? '1' : '0');
    }
  }

  // Restore collapse preference on desktop
  if (!isMobile() && localStorage.getItem('sa_sidebar_collapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
  }

  // Close mobile menu when resizing back to desktop
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      document.body.classList.remove('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  });

  /* ============================================================
     HIGHLIGHT ACTIVE LINK (based on current path)
     ============================================================ */
  function setActiveLink() {
    const path = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.sb-link').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const matches = href.endsWith('/' + path) || href === path;
      link.classList.toggle('active', matches);
    });
  }

  /* ============================================================
     LOGOUT
     ============================================================ */
  async function logout() {
    const token = localStorage.getItem('sa_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        });
      } catch { /* offline — clear anyway */ }
    }
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_role');
    localStorage.removeItem('sa_user');
    window.location.href = '/login.html';
  }

  /* ============================================================
     PUBLIC API (used by topbar.js and inline scripts)
     ============================================================ */
  window.Sidebar = {
    toggle: toggleSidebar,
    setActiveLink,
    logout,
    init: () => {
      setActiveLink();

      // Sidebar toggle buttons
      document.querySelectorAll('[data-toggle-sidebar]').forEach((btn) =>
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleSidebar();
        })
      );

      // Logout buttons — only elements with explicit data-logout
      document.querySelectorAll('[data-logout]').forEach((el) =>
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          logout();
        })
      );

      // Backdrop click closes mobile sidebar
      const backdrop = document.querySelector('.sb-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => {
          document.body.classList.remove('sidebar-open');
        });
      }
    },
  };
})();