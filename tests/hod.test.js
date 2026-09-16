'use strict';
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const demo = require('./fixtures/demo-users');

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function get(path, token) {
  const res = await fetch(BASE + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('HOD endpoints', () => {
  jest.setTimeout(20000);
  let token;

  beforeAll(async () => {
    const r = await post('/api/auth/login', demo.hod);
    token = r.body.data.token;
  });

  test('GET /api/hod/dashboard returns department', async () => {
    const r = await get('/api/hod/dashboard', token);
    expect(r.status).toBe(200);
    expect(r.body.data.department).toBeDefined();
  });

  test('GET /api/hod/students returns list', async () => {
    const r = await get('/api/hod/students', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.items)).toBe(true);
  });

  test('GET /api/hod/lecturers returns list', async () => {
    const r = await get('/api/hod/lecturers', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/hod/courses returns list', async () => {
    const r = await get('/api/hod/courses', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/hod/attendance returns overview', async () => {
    const r = await get('/api/hod/attendance', token);
    expect(r.status).toBe(200);
    expect(r.body.data.byCourse).toBeDefined();
  });

  test('GET /api/hod/performance returns analytics', async () => {
    const r = await get('/api/hod/performance', token);
    expect(r.status).toBe(200);
    expect(r.body.data.byLevel).toBeDefined();
  });

  test('GET /api/hod/risk returns list', async () => {
    const r = await get('/api/hod/risk', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('student cannot access HOD routes', async () => {
    const s = await post('/api/auth/login', demo.students.green);
    const r = await get('/api/hod/dashboard', s.body.data.token);
    expect(r.status).toBe(403);
  });
});