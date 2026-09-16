// ============================================================
// SMARTACADEMIC — Admin Profile Page
// Loads profile, uploads photo, edits name/phone, changes password.
// Self-contained — does not rely on inline scripts.
// ============================================================

'use strict';

(function () {
  function getToken() { return localStorage.getItem('sa_token'); }

  async function apiFetch(path, opts = {}) {
    const res = await fetch(path, {
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json',
      },
      ...opts,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
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

  /* ============================================================
     LOAD PROFILE
     ============================================================ */
  async function load() {
    const { ok, data } = await apiFetch('/api/auth/me');
    if (!ok) {
      console.error('[admin/profile] Failed to load user');
      return;
    }
    currentUser = data.data.user;
    renderProfileCard();
    renderPhoto();
  }

  function renderProfileCard() {
    const u = currentUser;
    const card = document.getElementById('profileCard');
    if (!card) return;

    const initials = u.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarStyle = u.photo_url
      ? `background-image:url('${u.photo_url}');background-size:cover;background-position:center;color:transparent;`
      : '';

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#166534,#ca8a04);display:grid;place-items:center;color:#fff;font-size:22px;font-weight:800;${avatarStyle}">
          ${initials}
        </div>
        <div>
          <div style="font-size:18px;font-weight:800;">${esc(u.full_name)}</div>
          <div style="color:var(--ink-3);font-size:13px;">${esc(u.email)}</div>
        </div>
      </div>

      <div class="grid-2" style="gap:16px;">
        <div><div style="font-size:12px;color:var(--ink-3);">Role</div><strong>Administrator</strong></div>
        <div><div style="font-size:12px;color:var(--ink-3);">Status</div><strong>${u.is_active ? 'Active' : 'Inactive'}</strong></div>
        <div><div style="font-size:12px;color:var(--ink-3);">Phone</div><strong>${esc(u.phone || '—')}</strong></div>
        <div><div style="font-size:12px;color:var(--ink-3);">User ID</div><strong>#${u.id}</strong></div>
      </div>

      <button class="btn btn-ghost w-full mt-4" id="btnEdit" type="button">✏️ Edit Profile</button>
    `;

    const btn = document.getElementById('btnEdit');
    if (btn) btn.addEventListener('click', openEdit);
  }

  function renderPhoto() {
    const u = currentUser;
    const preview = document.getElementById('photoPreview');
    const removeBtn = document.getElementById('btnRemovePhoto');
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

  /* ============================================================
     EDIT NAME / PHONE MODAL
     ============================================================ */
  function openEdit() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed; inset:0; z-index:9998; background:rgba(15,23,42,.55);
      backdrop-filter:blur(4px); display:grid; place-items:center; padding:20px;
    `;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.25);">
        <h2 style="margin:0 0 18px;font-size:20px;">Edit Profile</h2>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Full Name</label>
          <input id="editName" class="input" value="${esc(currentUser.full_name)}" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Email (cannot change)</label>
          <input class="input" value="${esc(currentUser.email)}" disabled />
        </div>
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:13.5px;font-weight:600;margin-bottom:6px;">Phone</label>
          <input id="editPhone" class="input" value="${esc(currentUser.phone || '')}" />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-ghost" id="editCancel" type="button">Cancel</button>
          <button class="btn btn-primary" id="editSave" type="button">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.getElementById('editCancel').addEventListener('click', close);

    document.getElementById('editSave').addEventListener('click', async () => {
      const payload = {
        full_name: document.getElementById('editName').value.trim(),
        phone: document.getElementById('editPhone').value.trim() || null,
      };
      const { ok, data } = await apiFetch('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!ok) { alert(data?.error || 'Failed'); return; }
      close();
      toast('Profile updated');
      load();
    });
  }

  /* ============================================================
     PHOTO UPLOAD
     ============================================================ */
  function bindPhotoUpload() {
    const uploadBtn = document.getElementById('btnUploadPhoto');
    const removeBtn = document.getElementById('btnRemovePhoto');
    const input = document.getElementById('photoInput');
    if (!uploadBtn || !input) return;

    uploadBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('File too large. Max 2 MB.');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = async () => {
          // Center-crop to square + resize to 500×500
          const canvas = document.createElement('canvas');
          const size = 500;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          const sSize = Math.min(img.width, img.height);
          const sx = (img.width - sSize) / 2;
          const sy = (img.height - sSize) / 2;
          ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          uploadBtn.disabled = true;
          uploadBtn.textContent = '⏳ Uploading...';

          try {
            const { ok, data } = await apiFetch('/api/admin/profile/photo', {
              method: 'POST',
              body: JSON.stringify({ photo: dataUrl }),
            });

            if (!ok) {
              alert(data?.error || 'Upload failed');
              return;
            }
            toast('Photo updated');
            await load();
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '📷 Upload New Photo';
          }
        };
        img.onerror = () => alert('Could not read image file.');
        img.src = ev.target.result;
      };
      reader.onerror = () => alert('Could not read file.');
      reader.readAsDataURL(file);

      input.value = '';
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!confirm('Remove your profile photo?')) return;
        const { ok } = await apiFetch('/api/admin/profile/photo', { method: 'DELETE' });
        if (!ok) { alert('Failed'); return; }
        toast('Photo removed');
        await load();
      });
    }
  }

  /* ============================================================
     CHANGE PASSWORD
     ============================================================ */
  function bindPasswordForm() {
    const form = document.getElementById('pwForm');
    if (!form) return;

    // Password visibility toggles
    document.querySelectorAll('.pw-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = document.getElementById(btn.dataset.target);
        if (!t) return;
        const showing = t.type === 'text';
        t.type = showing ? 'password' : 'text';
        btn.textContent = showing ? 'Show' : 'Hide';
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('pwMsg');
      msg.className = 'msg';

      const current_password = document.getElementById('pwCurrent').value;
      const new_password = document.getElementById('pwNew').value;
      const confirm = document.getElementById('pwConfirm').value;

      if (new_password.length < 6) {
        msg.className = 'msg msg-error show';
        msg.textContent = 'New password must be at least 6 characters.';
        return;
      }
      if (new_password !== confirm) {
        msg.className = 'msg msg-error show';
        msg.textContent = 'Passwords do not match.';
        return;
      }

      const btn = document.getElementById('pwBtn');
      btn.disabled = true;
      try {
        const { ok, data } = await apiFetch('/api/admin/change-password', {
          method: 'POST',
          body: JSON.stringify({ current_password, new_password }),
        });
        if (!ok) {
          msg.className = 'msg msg-error show';
          msg.textContent = data?.error || 'Failed';
          return;
        }
        msg.className = 'msg msg-success show';
        msg.textContent = '✅ Password changed successfully.';
        form.reset();
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ============================================================
     RECENT ACTIVITY
     ============================================================ */
  async function loadActivity() {
    const list = document.getElementById('activityList');
    if (!list) return;

    const { ok, data } = await apiFetch('/api/admin/audit-logs?limit=5');
    if (!ok || !data.data?.items?.length) {
      list.innerHTML = '<li style="text-align:center;padding:20px;color:var(--ink-3);">No recent activity.</li>';
      return;
    }
    list.innerHTML = data.data.items.map(l => `
      <li class="activity-item">
        <div class="activity-ico">📌</div>
        <div class="activity-body">
          <strong>${esc(l.action)}</strong>
          <p>${esc(l.module || '')} ${l.affected_record ? '· ' + esc(l.affected_record) : ''}</p>
          <div class="activity-time">${new Date(l.created_at).toLocaleString()}</div>
        </div>
      </li>`).join('');
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    if (window.__adminProfileBooted) return;
    window.__adminProfileBooted = true;
    console.log('[admin/profile] booting...');

    bindPhotoUpload();
    bindPasswordForm();
    load();
    loadActivity();
  }

  document.addEventListener('sa:layout-ready', boot);
  setTimeout(boot, 1000);
})();