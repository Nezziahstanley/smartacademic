'use strict';
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';

async function post(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function get(path, token = null) {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const res = await fetch(BASE + path, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('SMARTACADEMIC — Integration', () => {
  jest.setTimeout(20000);

  let adminToken, hodToken, lecturerToken, studentToken;

  test('health check returns ok', async () => {
    const r = await get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });

  test('admin can log in', async () => {
    const r = await post('/api/auth/login', { email: 'admin@smartacademic.edu', password: 'Admin@123' });
    expect(r.status).toBe(200);
    expect(r.body.data.token).toBeDefined();
    adminToken = r.body.data.token;
  });

  test('HOD can log in', async () => {
    const r = await post('/api/auth/login', { email: 'hod.csc@smartacademic.edu', password: 'Hod@123' });
    expect(r.status).toBe(200);
    hodToken = r.body.data.token;
  });

  test('Lecturer can log in', async () => {
    const r = await post('/api/auth/login', { email: 'lecturer.csc1@smartacademic.edu', password: 'Lect@123' });
    expect(r.status).toBe(200);
    lecturerToken = r.body.data.token;
  });

  test('Student can log in', async () => {
    const r = await post('/api/auth/login', { email: 'student.a@smartacademic.edu', password: 'Student@123' });
    expect(r.status).toBe(200);
    studentToken = r.body.data.token;
  });

  test('unauthenticated access to admin route returns 401', async () => {
    const r = await get('/api/admin/users');
    expect(r.status).toBe(401);
  });

  test('student cannot access admin routes', async () => {
    const r = await get('/api/admin/users', studentToken);
    expect(r.status).toBe(403);
  });

  test('admin can list users', async () => {
    const r = await get('/api/admin/users', adminToken);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.items)).toBe(true);
  });

  test('admin dashboard returns stats', async () => {
    const r = await get('/api/admin/dashboard', adminToken);
    expect(r.status).toBe(200);
    expect(r.body.data.stats).toBeDefined();
  });

  test('HOD dashboard returns department data', async () => {
    const r = await get('/api/hod/dashboard', hodToken);
    expect(r.status).toBe(200);
    expect(r.body.data.department).toBeDefined();
  });

  test('lecturer dashboard returns courses', async () => {
    const r = await get('/api/lecturer/dashboard', lecturerToken);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.courses)).toBe(true);
  });

  test('student dashboard returns summary', async () => {
    const r = await get('/api/student/dashboard', studentToken);
    expect(r.status).toBe(200);
    expect(r.body.data.summary).toBeDefined();
  });

  test('student cannot access another student via HOD route', async () => {
    const r = await get('/api/hod/students', studentToken);
    expect(r.status).toBe(403);
  });

  test('validation rejects bad register payload', async () => {
    const r = await post('/api/auth/register', { role: 'student', email: 'bad' });
    expect(r.status).toBe(422);
  });
});