// Shared CRUD helpers for admin pages
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

  function openModal({ title, subtitle = '', body, confirmText = 'Save', onConfirm, size = '', onReady }) {
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
            <button class="modal-close" data-close>×</button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn btn-primary" data-confirm>${esc(confirmText)}</button>
          </div>
        </div>
      </div>`;

    const backdrop = root.querySelector('.modal-backdrop');
    const close = () => backdrop.remove();

    backdrop.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    const confirmBtn = backdrop.querySelector('[data-confirm]');
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      const orig = confirmBtn.textContent;
      confirmBtn.textContent = 'Working...';
      try { await onConfirm(backdrop, close); }
      catch (err) { console.error(err); alert('Action failed.'); }
      finally { confirmBtn.disabled = false; confirmBtn.textContent = orig; }
    });

    if (onReady) setTimeout(() => onReady(backdrop, close), 30);
    const firstInput = backdrop.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 60);

    return { close, backdrop };
  }

  async function confirmDelete({ title = 'Delete?', subtitle = '', message = 'This action cannot be undone.', onConfirm }) {
    openModal({
      title, subtitle, size: 'sm', confirmText: 'Delete',
      body: `<p style="color:var(--red)">${esc(message)}</p>`,
      onConfirm: async (bd, close) => { await onConfirm(); close(); },
    });
  }

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
    requestAnimationFrame(() => { el.style.transform = 'translateY(0)'; el.style.opacity = '1'; });
    setTimeout(() => {
      el.style.transform = 'translateY(20px)'; el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  return { $, api, esc, initials, openModal, confirmDelete, toast };
})();