// ============================================================
// SMARTACADEMIC — Table scroll hint
// Adds a ".is-scrollable" class to any .table-wrap whose table
// overflows its container, so we can show a scroll hint.
// Runs on every page via layout-ready.
// ============================================================

'use strict';

(function () {
  function markScrollable() {
    document.querySelectorAll('.table-wrap').forEach(wrap => {
      const overflow = wrap.scrollWidth > wrap.clientWidth;
      wrap.classList.toggle('is-scrollable', overflow);
    });
  }

  function boot() {
    if (window.__tableScrollBooted) return;
    window.__tableScrollBooted = true;

    markScrollable();

    window.addEventListener('resize', () => {
      clearTimeout(window.__tblScrollT);
      window.__tblScrollT = setTimeout(markScrollable, 150);
    });

    // Re-check whenever the DOM mutates (tables load asynchronously)
    const mo = new MutationObserver(() => markScrollable());
    mo.observe(document.body, { childList: true, subtree: true });

    // Final sweep after all page scripts have settled
    setTimeout(markScrollable, 1200);
  }

  document.addEventListener('sa:layout-ready', boot);
  if (document.readyState === 'complete') {
    setTimeout(boot, 500);
  } else {
    window.addEventListener('load', () => setTimeout(boot, 500));
  }
})();