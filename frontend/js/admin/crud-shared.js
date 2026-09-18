  function openModal({ title, subtitle = '', body, confirmText = 'Save', onConfirm, size = '', onReady }) {
    const root = $('#modalRoot') || (() => {
      const d = document.createElement('div');
      d.id = 'modalRoot';
      document.body.appendChild(d);
      return d;
    })();

    // Track the element that had focus before we opened
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
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      // Restore focus
      try { previouslyFocused && previouslyFocused.focus(); } catch { /* ignore */ }
    }

    // ---- Keyboard support ----
    function onKeydown(e) {
      // Esc → close (treat as cancel)
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      // Enter → confirm, but only if focus is not inside a textarea
      // and not on the Cancel button
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'textarea') return; // let the user type
        if (document.activeElement?.hasAttribute('data-close')) return;

        const confirmBtn = backdrop.querySelector('[data-confirm]');
        if (confirmBtn && !confirmBtn.disabled) {
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

    backdrop.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

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

    if (onReady) setTimeout(() => onReady(backdrop, close), 30);

    // Autofocus first input; if none, focus the confirm button
    const firstInput = backdrop.querySelector('input, select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 60);
    } else {
      setTimeout(() => confirmBtn.focus(), 60);
    }

    return { close, backdrop };
  }