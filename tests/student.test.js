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

describe('Student endpoints', () => {
  jest.setTimeout(20000);
  let token;

  beforeAll(async () => {
    const r = await post('/api/auth/login', demo.students.green);
    token = r.body.data.token;
  });

  test('GET /api/student/dashboard returns summary', async () => {
    const r = await get('/api/student/dashboard', token);
    expect(r.status).toBe(200);
    expect(r.body.data.summary).toBeDefined();
  });

  test('GET /api/student/profile returns own profile', async () => {
    const r = await get('/api/student/profile', token);
    expect(r.status).toBe(200);
    expect(r.body.data.matric_no).toBeDefined();
  });

  test('GET /api/student/courses returns registered courses', async () => {
    const r = await get('/api/student/courses', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/student/attendance returns byCourse + records', async () => {
    const r = await get('/api/student/attendance', token);
    expect(r.status).toBe(200);
    expect(r.body.data.byCourse).toBeDefined();
  });

  test('GET /api/student/results returns published results', async () => {
    const r = await get('/api/student/results', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/student/gpa-cgpa returns summary', async () => {
    const r = await get('/api/student/gpa-cgpa', token);
    expect(r.status).toBe(200);
    expect(r.body.data.summary).toBeDefined();
  });

  test('GET /api/student/performance returns data', async () => {
    const r = await get('/api/student/performance', token);
    expect(r.status).toBe(200);
    expect(r.body.data.byCourse).toBeDefined();
  });

  test('GET /api/student/academic-status returns risk', async () => {
    const r = await get('/api/student/academic-status', token);
    expect(r.status).toBe(200);
    expect(r.body.data.student).toBeDefined();
  });

  test('GET /api/student/interventions returns list', async () => {
    const r = await get('/api/student/interventions', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('lecturer cannot access student routes', async () => {
    const l = await post('/api/auth/login', demo.lecturer);
    const r = await get('/api/student/dashboard', l.body.data.token);
    expect(r.status).toBe(403);
  });
});