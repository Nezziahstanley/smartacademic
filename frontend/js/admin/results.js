'use strict';
(function () {
  const { $, api, esc, openModal, confirmDelete, toast } = window.SACrud;
  const state = { items: [], course_id: '', search: '' };

  async function loadCourses() {
    const { ok, data } = await api('/api/admin/courses');
    if (ok) $('#courseFilter').innerHTML = '<option value="">All courses</option>' +
      data.data.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('');
  }

  async function load() {
    $('#tbody').innerHTML = '<tr><td colspan="8"><div class="skeleton" style="height:22px;"></div></td></tr>';
    const p = new URLSearchParams();
    if (state.course_id) p.set('course_id', state.course_id);
    const { ok, data } = await api('/api/admin/results?' + p.toString());
    if (!ok) { $('#tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--red);">Failed.</td></tr>'; return; }
    state.items = data.data;
    render();
  }

  function render() {
    const body = $('#tbody');
    let items = state.items;
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(r =>
        r.student_name.toLowerCase().includes(q) || r.matric_no.toLowerCase().includes(q)
      );
    }
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:40px;"><div class="empty-icon">📈</div><h3>No results</h3></div></td></tr>';
      return;
    }
    const gradeBadge = (g) => ({
      A: 'badge-green', B: 'badge-blue', C: 'badge-blue',
      D: 'badge-yellow', E: 'badge-yellow', F: 'badge-red'
    }[g] || 'badge-gray');

    body.innerHTML = items.map(r => `
      <tr>
        <td>
          <div style="font-weight:600;">${esc(r.student_name)}</div>
          <div style="font-size:12px;color:var(--ink-3);">${esc(r.matric_no)}</div>
        </td>
        <td><strong>${esc(r.code)}</strong> — ${esc(r.title)}</td>
        <td>${parseFloat(r.ca_score || 0).toFixed(1)}</td>
        <td>${parseFloat(r.exam_score || 0).toFixed(1)}</td>
        <td><strong>${parseFloat(r.total_score || 0).toFixed(1)}</strong></td>
        <td><span class="badge ${gradeBadge(r.grade)}">${esc(r.grade || '—')}</span></td>
        <td>${r.is_published
          ? '<span class="badge badge-green">Published</span>'
          : '<span class="badge badge-gray">Draft</span>'}</td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-pub="${r.id}">${r.is_published ? 'Unpublish' : 'Publish'}</button>
          <button class="btn btn-ghost btn-sm" data-del="${r.id}">Delete</button>
        </div></td>
      </tr>`).join('');

    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(parseInt(b.dataset.edit, 10))));
    body.querySelectorAll('[data-pub]').forEach(b => b.addEventListener('click', () => doPublish(parseInt(b.dataset.pub, 10))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(parseInt(b.dataset.del, 10))));
  }

  function openEdit(id) {
    const r = state.items.find(x => x.id === id);
    if (!r) return;
    openModal({
      title: 'Edit result', subtitle: `${r.student_name} — ${r.code}`, confirmText: 'Save',
      body: `
        <div class="field-row">
          <div class="field"><label>CA score (max 30)</label>
            <input class="input" id="f_ca" type="number" min="0" max="30" step="0.1" value="${r.ca_score || 0}" />
          </div>
          <div class="field"><label>Exam score (max 70)</label>
            <input class="input" id="f_exam" type="number" min="0" max="70" step="0.1" value="${r.exam_score || 0}" />
          </div>
        </div>
        <p style="color:var(--ink-3);font-size:13px;">Grade will be recalculated automatically.</p>`,
      onConfirm: async (bd, close) => {
        const ca_score = parseFloat(bd.querySelector('#f_ca').value);
        const exam_score = parseFloat(bd.querySelector('#f_exam').value);
        const { ok, data } = await api('/api/admin/results/' + id, {
          method: 'PUT', body: JSON.stringify({ ca_score, exam_score }),
        });
        if (!ok) { alert(data?.error || 'Failed'); return; }
        close(); toast('Result updated'); load();
      },
    });
  }

  async function doPublish(id) {
    const r = state.items.find(x => x.id === id);
    if (!r) return;
    const { ok } = await api('/api/admin/results/' + id + '/publish', {
      method: 'POST',
      body: JSON.stringify({ is_published: !r.is_published }),
    });
    if (!ok) { alert('Failed'); return; }
    toast(r.is_published ? 'Unpublished' : 'Published');
    load();
  }

  function doDelete(id) {
    const r = state.items.find(x => x.id === id);
    confirmDelete({
      title: 'Delete result?', subtitle: r ? `${r.student_name} — ${r.code}` : '',
      onConfirm: async () => {
        const { ok } = await api('/api/admin/results/' + id, { method: 'DELETE' });
        if (!ok) { alert('Failed'); return; }
        toast('Deleted'); load();
      },
    });
  }

  function bind() {
    $('#courseFilter').addEventListener('change', e => { state.course_id = e.target.value; load(); });
    let t;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 200);
    });
    $('#btnReset').addEventListener('click', () => {
      state.course_id = ''; state.search = '';
      $('#courseFilter').value = ''; $('#searchInput').value = '';
      load();
    });
  }

  async function boot() { await loadCourses(); bind(); load(); }
  document.addEventListener('sa:layout-ready', boot);
})();