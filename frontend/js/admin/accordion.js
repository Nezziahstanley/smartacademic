// ============================================================
// SMARTACADEMIC — Department Accordion Helper
// Reusable component for grouping admin lists by department.
// Persists open state to localStorage per page.
// ============================================================

'use strict';

window.SAAccordion = (function () {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /**
   * Build the outer container that will hold all department cards.
   * Returns an element you can append to.
   */
  function mount(host, { pageKey, headerCols = [] }) {
    const storageKey = `sa_accordion_${pageKey}`;
    let openSet = new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) openSet = new Set(JSON.parse(raw));
    } catch { /* ignore */ }

    function persist() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(openSet)));
      } catch { /* ignore */ }
    }

    /**
     * Render all departments from an array of:
     * {
     *   id, name, code, meta: { ... },
     *   renderBody: () => Promise<string> | string  -- called on expand
     *   summary: string (optional, shown next to title)
     * }
     */
    function render(departments) {
      const list = document.createElement('div');
      list.className = 'dept-accordion';

      list.innerHTML = departments.map(d => {
        const isOpen = openSet.has(d.id);
        return `
          <div class="dept-card ${isOpen ? 'open' : ''}" data-dept-id="${d.id}">
            <div class="dept-head" role="button" tabindex="0" aria-expanded="${isOpen}">
              <span class="dept-chev" aria-hidden="true">▶</span>
              <div class="dept-title">
                <div class="dept-name">${esc(d.name)}</div>
                ${d.code ? `<div class="dept-code">${esc(d.code)}</div>` : ''}
              </div>
              <div class="dept-meta">
                ${renderMeta(d.meta)}
              </div>
              <div class="dept-actions">
                ${d.actionsHtml || ''}
              </div>
            </div>
            <div class="dept-body" ${isOpen ? '' : 'hidden'}>
              <div class="dept-body-inner">
                ${isOpen ? '<div class="skeleton" style="height:60px;"></div>' : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      host.innerHTML = '';
      host.appendChild(list);

      // Wire expand/collapse
      list.querySelectorAll('.dept-card').forEach(card => {
        const id = parseInt(card.dataset.deptId, 10);
        const head = card.querySelector('.dept-head');
        const body = card.querySelector('.dept-body');
        const bodyInner = card.querySelector('.dept-body-inner');

        const dept = departments.find(d => d.id === id);

        async function expand() {
          if (card.classList.contains('open')) return;
          card.classList.add('open');
          head.setAttribute('aria-expanded', 'true');
          body.hidden = false;
          openSet.add(id);
          persist();

          // Load body content
          bodyInner.innerHTML = '<div class="skeleton" style="height:60px;"></div>';
          try {
            const html = await dept.renderBody();
            bodyInner.innerHTML = html;
            if (dept.onBodyReady) dept.onBodyReady(bodyInner);
          } catch (err) {
            bodyInner.innerHTML = `<div class="msg msg-error show">Failed to load: ${esc(err.message)}</div>`;
          }
        }

        function collapse() {
          card.classList.remove('open');
          head.setAttribute('aria-expanded', 'false');
          body.hidden = true;
          openSet.delete(id);
          persist();
        }

        head.addEventListener('click', (e) => {
          // Ignore clicks on inner buttons/links
          if (e.target.closest('.dept-actions')) return;
          if (card.classList.contains('open')) collapse();
          else expand();
        });

        head.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (card.classList.contains('open')) collapse();
            else expand();
          }
        });

        // Auto-expand on initial render if it was open
        if (card.classList.contains('open')) {
          expand();
        }
      });

      return list;
    }

    return { render };
  }

  function renderMeta(meta) {
    if (!meta) return '';
    const chips = [];
    if (meta.students != null)  chips.push(`<span class="meta-chip">🎓 ${meta.students} students</span>`);
    if (meta.lecturers != null) chips.push(`<span class="meta-chip">👨‍🏫 ${meta.lecturers}</span>`);
    if (meta.courses != null)   chips.push(`<span class="meta-chip">📖 ${meta.courses} courses</span>`);
    if (meta.custom) chips.push(meta.custom);
    return chips.join('');
  }

  return { mount, esc };
})();