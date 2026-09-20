// ============================================================
// SMARTACADEMIC — Auth Pages Script
// Shared logic for login, register, forgot, reset.
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

  const DASHBOARDS = {
    admin:    '/admin/dashboard.html',
    hod:      '/hod/dashboard.html',
    lecturer: '/lecturer/dashboard.html',
    student:  '/student/dashboard.html',
  };

  function showMsg(el, text, type = 'error') {
    if (!el) return;
    el.className = `msg msg-${type} show`;
    el.textContent = text;
  }
  function hideMsg(el) {
    if (!el) return;
    el.className = 'msg';
    el.textContent = '';
  }

  function setLoading(btn, loading, defaultText) {
    if (!btn) return;
    if (loading) {
      btn.dataset.original = btn.dataset.original || btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Please wait...`;
    } else {
      btn.disabled = false;
      btn.innerHTML = defaultText || btn.dataset.original || 'Submit';
    }
  }

  function persistAuth(user, token) {
    localStorage.setItem(STORAGE.TOKEN, token);
    localStorage.setItem(STORAGE.ROLE,  user.role);
    localStorage.setItem(STORAGE.USER,  JSON.stringify(user));
  }

  function redirectToDashboard(role) {
    const target = DASHBOARDS[role] || '/';
    window.location.href = target;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    return { ok: res.ok, status: res.status, data };
  }

  /* Password visibility toggle */
  $$('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const showing = target.type === 'text';
      target.type = showing ? 'password' : 'text';
      btn.textContent = showing ? 'Show' : 'Hide';
    });
  });

  /* Redirect if already logged in */
  const page = document.body.dataset.page || '';
  const existingToken = localStorage.getItem(STORAGE.TOKEN);
  const existingRole  = localStorage.getItem(STORAGE.ROLE);

  if (existingToken && existingRole && page !== 'reset') {
    api('/api/auth/me', { headers: { Authorization: `Bearer ${existingToken}` } })
      .then(({ ok }) => {
        if (ok) redirectToDashboard(existingRole);
        else {
          localStorage.removeItem(STORAGE.TOKEN);
          localStorage.removeItem(STORAGE.ROLE);
          localStorage.removeItem(STORAGE.USER);
        }
      })
      .catch(() => { /* offline — stay on login */ });
  }

  /* LOGIN */
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgEl = $('#loginMsg');
      const btn = $('#loginBtn');
      hideMsg(msgEl);

      const email = $('#email').value.trim();
      const password = $('#password').value;

      if (!email || !password) {
        return showMsg(msgEl, 'Please enter your email and password.', 'error');
      }

      setLoading(btn, true);
      try {
        const { ok, data } = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (!ok) {
          const errText = data && data.error ? data.error : 'Login failed. Please try again.';
          showMsg(msgEl, errText, 'error');
          setLoading(btn, false);
          return;
        }

        const { user, token } = data.data;
        persistAuth(user, token);
        showMsg(msgEl, `Welcome back, ${user.full_name.split(' ')[0]}! Redirecting...`, 'success');
        setTimeout(() => redirectToDashboard(user.role), 700);
      } catch (err) {
        showMsg(msgEl, 'Network error. Please check your connection.', 'error');
        setLoading(btn, false);
      }
    });
  }

  /* REGISTER — tab switching */
  const tabs = $$('.tab');
  const roleInput = $('#role');
  const studentFields = $$('.role-student');
  const lecturerFields = $$('.role-lecturer');

  function activateRole(role) {
    if (roleInput) roleInput.value = role;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.role === role));
    studentFields.forEach(el => el.style.display = role === 'student' ? '' : 'none');
    lecturerFields.forEach(el => el.style.display = role === 'lecturer' ? '' : 'none');
  }

  if (tabs.length) {
    tabs.forEach(t => t.addEventListener('click', () => activateRole(t.dataset.role)));
    activateRole('student');
  }

  /* Departments / programmes */
  const deptSelect = $('#department_id');
  const progSelect = $('#programme_id');

  async function loadDepartments() {
    if (!deptSelect) return;
    try {
      const { ok, data } = await api('/api/auth/departments');
      if (ok && data && Array.isArray(data.data)) {
        deptSelect.innerHTML = '<option value="">Select department</option>' +
          data.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      }
    } catch { /* ignore */ }
  }

  async function loadProgrammes(departmentId) {
    if (!progSelect) return;
    progSelect.innerHTML = '<option value="">Loading...</option>';
    if (!departmentId) {
      progSelect.innerHTML = '<option value="">Select department first</option>';
      return;
    }
    try {
      const { ok, data } = await api(`/api/auth/programmes?department_id=${departmentId}`);
      if (ok && data && Array.isArray(data.data)) {
        progSelect.innerHTML = '<option value="">Select programme</option>' +
          data.data.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }
    } catch { /* ignore */ }
  }

  if (deptSelect) {
    loadDepartments();
    deptSelect.addEventListener('change', () => loadProgrammes(deptSelect.value));
  }

  /* REGISTER submit */
  const registerForm = $('#registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgEl = $('#registerMsg');
      const btn = $('#registerBtn');
      hideMsg(msgEl);

      // Invite flow
      const invToken = new URLSearchParams(location.search).get('invite');
      if (invToken) {
        const payload = {
          token: invToken,
          full_name: document.getElementById('full_name').value.trim(),
          password: document.getElementById('password').value,
          phone: document.getElementById('phone').value.trim() || null,
          department_id: parseInt(document.getElementById('department_id')?.value, 10) || null,
          programme_id: parseInt(document.getElementById('programme_id')?.value, 10) || null,
          level: parseInt(document.getElementById('level')?.value, 10) || null,
          admission_year: parseInt(document.getElementById('admission_year')?.value, 10) || null,
          staff_id: document.getElementById('staff_id')?.value.trim() || null,
          title: document.getElementById('title')?.value.trim() || null,
        };

        setLoading(btn, true);
        try {
          const { ok, data } = await api('/api/auth/accept-invite', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (!ok) {
            showMsg(msgEl, data?.error || 'Registration failed.', 'error');
            setLoading(btn, false);
            return;
          }
          const { user, token } = data.data;
          persistAuth(user, token);
          showMsg(msgEl, '✅ Welcome! Redirecting...', 'success');
          setTimeout(() => redirectToDashboard(user.role), 800);
        } catch (err) {
          showMsg(msgEl, 'Network error.', 'error');
          setLoading(btn, false);
        }
        return;
      }

      // Normal registration — matric_no is NOT sent, server generates it
      const role = roleInput.value;
      const payload = {
        role,
        full_name: $('#full_name').value.trim(),
        email:     $('#email').value.trim(),
        phone:     $('#phone').value.trim() || null,
        password:  $('#password').value,
        department_id: parseInt($('#department_id').value, 10) || null,
      };

      if (role === 'student') {
        payload.programme_id   = parseInt($('#programme_id').value, 10) || null;
        payload.level          = parseInt($('#level').value, 10) || null;
        payload.admission_year = parseInt($('#admission_year').value, 10) || null;
      } else {
        payload.staff_id = $('#staff_id').value.trim();
        payload.title    = $('#title').value.trim() || null;
      }

      if (!payload.full_name || !payload.email || !payload.password) {
        return showMsg(msgEl, 'Please fill in all required fields.', 'error');
      }
      if (payload.password.length < 6) {
        return showMsg(msgEl, 'Password must be at least 6 characters.', 'error');
      }

      setLoading(btn, true);
      try {
        const { ok, data } = await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!ok) {
          const errText = data && data.error ? data.error : 'Registration failed.';
          let detail = errText;
          if (data && Array.isArray(data.details)) {
            detail = data.details.map(d => `${d.field}: ${d.message}`).join(' · ');
          }
          showMsg(msgEl, detail, 'error');
          setLoading(btn, false);
          return;
        }

        if (data.data.pending) {
          let extra = '';
          if (data.data.matric_no) {
            extra = ` Your matric number is ${data.data.matric_no}.`;
          }
          showMsg(msgEl, `✅ Registration successful!${extra} Your account is pending admin approval. You will receive an email and SMS once activated.`, 'success');
          return;
        }

        const { user, token } = data.data;
        persistAuth(user, token);
        showMsg(msgEl, 'Account created! Redirecting...', 'success');
        setTimeout(() => redirectToDashboard(user.role), 800);
      } catch (err) {
        showMsg(msgEl, 'Network error. Please try again.', 'error');
        setLoading(btn, false);
      }
    });
  }

  /* FORGOT PASSWORD */
  const forgotForm = $('#forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgEl = $('#forgotMsg');
      const btn = $('#forgotBtn');
      hideMsg(msgEl);

      const email = $('#email').value.trim();
      if (!email) return showMsg(msgEl, 'Please enter your email.', 'error');

      setLoading(btn, true);
      try {
        const { ok, data } = await api('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });

        if (!ok) {
          showMsg(msgEl, (data && data.error) || 'Request failed.', 'error');
          setLoading(btn, false);
          return;
        }

        showMsg(msgEl, 'If that email exists, a reset link has been sent. Check your inbox.', 'success');

        if (data && data.dev_link) {
          const link = document.createElement('div');
          link.innerHTML = `<br><strong>Dev link:</strong> <a class="link" href="${data.dev_link}">${data.dev_link}</a>`;
          msgEl.appendChild(link);
        }

        setLoading(btn, false);
      } catch (err) {
        showMsg(msgEl, 'Network error. Please try again.', 'error');
        setLoading(btn, false);
      }
    });
  }

  /* RESET PASSWORD */
  const resetForm = $('#resetForm');
  if (resetForm) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const msgEl = $('#resetMsg');
    const tokenField = $('#token');

    if (!token) {
      showMsg(msgEl, 'Invalid or missing reset token. Please request a new reset link.', 'error');
      resetForm.querySelector('button[type=submit]').disabled = true;
    } else if (tokenField) {
      tokenField.value = token;
    }

    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMsg(msgEl);

      const btn = $('#resetBtn');
      const password = $('#password').value;
      const confirm = $('#confirm').value;

      if (!password || password.length < 6) {
        return showMsg(msgEl, 'Password must be at least 6 characters.', 'error');
      }
      if (password !== confirm) {
        return showMsg(msgEl, 'Passwords do not match.', 'error');
      }

      setLoading(btn, true);
      try {
        const { ok, data } = await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: tokenField.value, password }),
        });

        if (!ok) {
          showMsg(msgEl, (data && data.error) || 'Reset failed.', 'error');
          setLoading(btn, false);
          return;
        }

        showMsg(msgEl, 'Password reset successful! Redirecting to login...', 'success');
        setTimeout(() => window.location.href = '/login.html', 1200);
      } catch (err) {
        showMsg(msgEl, 'Network error. Please try again.', 'error');
        setLoading(btn, false);
      }
    });
  }
})();