// ============================================================
// HOD Profile — view, edit, upload photo, change password
// ============================================================

'use strict';

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);

  function token() { return localStorage.getItem('sa_token'); }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: {
        'Authorization': 'Bearer ' + token(),
        'Content-Type': 'application/json',
      },
      ...opts,
    });
    return { ok: res.ok, data: await res.json().catch(() => null) };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      padding:12px 18px; border-radius:10px; font-size:14px; font-weight:600;
      box-shadow:0 10px 30px rgba(0,0,0,.18);
      background:${type === 'error' ? '#fee2e2' : '#dcfce7'};
      color:${type === 'error' ? '#991b1b' : '#166534'};
      transform:translateY(20px); opacity:0; transition:.25s;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)'; el.style.opacity = '1';
    });
    setTimeout(() => {
      el.style.transform = 'translateY(20px)'; el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  let currentUser = null;

  async function load() {
    const { ok, data } = await api('/api/auth/me');
    if (!ok) return;
    currentUser = data.data.user;
    renderProfileCard();
    renderPhotoPreview();
  }

  function renderProfileCard() {
    const u = currentUser;
    const card = $('#profileCard');
    if (!card) return;

    const initials = u.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarStyle = u.photo_url
      ? `background-image:url('${u.photo_url}');background-size:cover;background-position:center;color:transparent;`
      : '';

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#166534,#ca8a04);display:grid;place-items:center;color:#fff;font-size:22px;font-weight:800;${avatarStyle}">${initials}</div>
        <div>
          <div style="font-size:18px;font-weight:800;">${esc(u.full_name)}</div>
          <div style="color:var(--ink-3);font-size:13px;">${esc(u.email)}</div>
        </div>
      </div>
      <div class="grid-2" style="gap:16px;">
        <div><div style="font-size:12px;color:var(--ink-3);">Role</div><strong>Head of Department</strong></div>
        <div><div style="font-size:12px;color:var(--ink-3);">Status</div><strong>${u.is_active ? 'Active' : 'Inactive'}</strong></div>
        <div><div style="font-size:12px;color:var(--ink-3);">Phone</div><strong>${esc(u.phone || '—')}</strong></div>
        <div><div style="font-size:12px;color:var(--ink-3);">User ID</div><strong>#${u.id}</strong></div>
      </div>
      <button class="btn btn-ghost w-full mt-4" id="btnEdit" type="button">✏️ Edit Profile</button>
    `;
    const btn = $('#btnEdit');
    if (btn) btn.addEventListener('click', openEdit);
  }

  function renderPhotoPreview() {
    const u = currentUser;
    const preview = $('#photoPreview');
    const removeBtn = $('#btnRemovePhoto');
    if (!preview) return;

    const initials = u.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    if (u.photo_url) {
      preview.style.backgroundImage = `url('${u.photo_url}')`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      preview.textContent = '';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      preview.style.backgroundImage = '';
      preview.textContent = initials;
      if (removeBtn) removeBtn.style.display = 'none';
    }
  }

  function openEdit() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);display:grid;place-items:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.25);">
        <h2 style="margin:0 0 18px;font-size:20px;">Edit Profile</h2>
        <div style="margin-bottom:16px;"><label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Full Name</label><input id="editName" class="input" value="${esc(currentUser.full_name)}" /></div>
        <div style="margin-bottom:16px;"><label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Email</label><input class="input" value="${esc(currentUser.email)}" disabled /></div>
        <div style="margin-bottom:20px;"><label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Phone</label><input id="editPhone" class="input" value="${esc(currentUser.phone || '')}" /></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-ghost" id="editCancel" type="button">Cancel</button>
          <button class="btn btn-primary" id="editSave" type="button">Save Changes</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    $('#editCancel').addEventListener('click', close);

    $('#editSave').addEventListener('click', async () => {
      const payload = {
        full_name: $('#editName').value.trim(),
        phone: $('#editPhone').value.trim() || null,
      };
      const { ok, data } = await api('/api/hod/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!ok) { alert(data?.error || 'Failed'); return; }
      close(); toast('Profile updated'); load();
    });
  }

  function bindPhotoUpload() {
    const uploadBtn = $('#btnUploadPhoto');
    const removeBtn = $('#btnRemovePhoto');
    const input = $('#photoInput');
    if (!uploadBtn || !input) return;

    uploadBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('Max 2 MB'); input.value = ''; return; }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 500;
          const ctx = canvas.getContext('2d');
          const s = Math.min(img.width, img.height);
          const sx = (img.width - s) / 2;
          const sy = (img.height - s) / 2;
          ctx.drawImage(img, sx, sy, s, s, 0, 0, 500, 500);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          uploadBtn.disabled = true;
          uploadBtn.textContent = '⏳ Uploading...';

          try {
            const { ok, data } = await api('/api/hod/profile/photo', {
              method: 'POST',
              body: JSON.stringify({ photo: dataUrl }),
            });
            if (!ok) { alert(data?.error || 'Upload failed'); return; }
            toast('Photo updated');
            await load();
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '📷 Upload New Photo';
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      input.value = '';
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!confirm('Remove your photo?')) return;
        await api('/api/hod/profile/photo', { method: 'DELETE' });
        toast('Photo removed'); await load();
      });
    }
  }

  function bindPasswordForm() {
    const form = $('#pwForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#pwMsg');
      msg.className = 'msg';

      const cur = $('#pwCurrent').value;
      const nw = $('#pwNew').value;
      const cf = $('#pwConfirm').value;

      if (nw.length < 6) { msg.className = 'msg msg-error show'; msg.textContent = 'Min 6 chars'; return; }
      if (nw !== cf) { msg.className = 'msg msg-error show'; msg.textContent = 'Passwords do not match'; return; }

      const btn = $('#pwBtn'); btn.disabled = true;
      try {
        const { ok, data } = await api('/api/hod/change-password', {
          method: 'POST',
          body: JSON.stringify({ current_password: cur, new_password: nw }),
        });
        if (!ok) { msg.className = 'msg msg-error show'; msg.textContent = data?.error || 'Failed'; return; }
        msg.className = 'msg msg-success show'; msg.textContent = '✅ Password changed';
        form.reset();
      } finally { btn.disabled = false; }
    });
  }

  function boot() {
    if (window.__hodProfileBooted) return;
    window.__hodProfileBooted = true;
    console.log('[hod/profile] booting...');
    bindPhotoUpload();
    bindPasswordForm();
    load();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();