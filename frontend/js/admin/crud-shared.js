// ============================================================
// SMARTACADEMIC — Shared CRUD helpers
// Loaded by every dashboard page. Provides:
//   $, api, esc, initials, openModal, confirmDelete, toast
// ============================================================

'use strict';

window.SACrud = (function () {
  const $ = (s, r = document) => r.querySelector(s);

  function token() { return localStorage.getItem('sa_token'); }
  function headers() { return { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }; }

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: headers(), ...opts });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initials(name) {
    return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  /* ============================================================
     MODAL — with keyboard support (Esc / Enter / Tab)
     ============================================================ */
  function openModal({ title, subtitle = '', body, confirmText = 'Save', onConfirm, size = '', onReady }) {
    const root = $('#modalRoot') || (() => {
      const d = document.createElement('div');
      d.id = 'modalRoot';
      document.body.appendChild(d);
      return d;
    })();

    // Remember what had focus so we can restore it on close
    const previouslyFocused = document.activeElement;

    root.innerHTML = `
      <div class="modal-backdrop open" role="dialog" aria-modal="true">
        <div class="modal ${size}">
          <div class="modal-head">
            <div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div>
            <button class="modal-close" data-close type="button" aria-label="Close">×</button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost" data-close type="button">Cancel</button>
            <button class="btn btn-primary" data-confirm type="button">${esc(confirmText)}</button>
          </div>
        </div>
      </div>`;

    const backdrop = root.querySelector('.modal-backdrop');

    function close() {
      if (!document.body.contains(backdrop)) return; // already closed
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      try { previouslyFocused && previouslyFocused.focus(); } catch { /* ignore */ }
    }

    // ---- Keyboard support ----
    function onKeydown(e) {
      if (!document.body.contains(backdrop)) return;

      // Esc closes
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      // Enter confirms, unless focus is inside a textarea or on a close button
      if (e.key === 'Enter' && !e.shiftKey) {
        const el = document.activeElement;
        const tag = el?.tagName?.toLowerCase();
        if (tag === 'textarea') return;
        if (el && el.hasAttribute('data-close')) return;

        const confirmBtn = backdrop.querySelector('[data-confirm]');
        if (confirmBtn && !confirmBtn.disabled && confirmBtn.offsetParent !== null) {
          e.preventDefault();
          confirmBtn.click();
        }
        return;
      }

      // Tab trapping — keep focus inside the modal
      if (e.key === 'Tab') {
        const focusables = Array.from(
          backdrop.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null);

        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeydown);

    // ---- Close handlers ----
    backdrop.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', close));

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    // ---- Confirm handler ----
    const confirmBtn = backdrop.querySelector('[data-confirm]');
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      const orig = confirmBtn.textContent;
      confirmBtn.textContent = 'Working...';
      try {
        await onConfirm(backdrop, close);
      } catch (err) {
        console.error(err);
        alert('Action failed.');
      } finally {
        if (document.body.contains(confirmBtn)) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = orig;
        }
      }
    });

    // ---- onReady + autofocus ----
    if (typeof onReady === 'function') {
      setTimeout(() => onReady(backdrop, close), 30);
    }

    const firstInput = backdrop.querySelector('input, select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 60);
    } else {
      setTimeout(() => confirmBtn.focus(), 60);
    }

    return { close, backdrop };
  }

  /* ============================================================
     CONFIRM DIALOG
     ============================================================ */
  async function confirmDelete({ title = 'Delete?', subtitle = '', message = 'This action cannot be undone.', onConfirm }) {
    openModal({
      title,
      subtitle,
      size: 'sm',
      confirmText: 'Delete',
      body: `<p style="color:var(--red)">${esc(message)}</p>`,
      onConfirm: async (bd, close) => { await onConfirm(); close(); },
    });
  }

  /* ============================================================
     TOAST
     ============================================================ */
  function toast(message, type = 'success') {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:999;
      padding:12px 18px; border-radius:10px; font-size:14px; font-weight:600;
      box-shadow:0 10px 30px rgba(0,0,0,.18);
      background:${type === 'error' ? '#fee2e2' : '#dcfce7'};
      color:${type === 'error' ? '#991b1b' : '#166534'};
      transform:translateY(20px); opacity:0; transition:.25s;
    `;
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
    });
    setTimeout(() => {
      el.style.transform = 'translateY(20px)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  return { $, api, esc, initials, openModal, confirmDelete, toast };
})();

/* ============================================================
   DEFENSIVE FALLBACKS
   Fires a fallback boot if a page's dashboard script never
   received 'sa:layout-ready'. Safe to run multiple times —
   page scripts guard against double-booting.
   ============================================================ */
(function () {
  function fallback() {
    if (window.__saFallbackFired) return;
    window.__saFallbackFired = true;
    // Dispatch again so any missed listener gets a chance.
    document.dispatchEvent(new CustomEvent('sa:layout-ready'));
  }

  if (document.readyState === 'complete') {
    setTimeout(fallback, 1800);
  } else {
    window.addEventListener('load', () => setTimeout(fallback, 1800));
  }
})();