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

describe('Lecturer endpoints', () => {
  jest.setTimeout(20000);
  let token;

  beforeAll(async () => {
    const r = await post('/api/auth/login', demo.lecturer);
    token = r.body.data.token;
  });

  test('GET /api/lecturer/dashboard returns courses + at-risk', async () => {
    const r = await get('/api/lecturer/dashboard', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.courses)).toBe(true);
  });

  test('GET /api/lecturer/courses returns my courses', async () => {
    const r = await get('/api/lecturer/courses', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/lecturer/students returns students', async () => {
    const r = await get('/api/lecturer/students', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/lecturer/assessments returns assessments', async () => {
    const r = await get('/api/lecturer/assessments', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/lecturer/results returns results', async () => {
    const r = await get('/api/lecturer/results', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/lecturer/at-risk returns items', async () => {
    const r = await get('/api/lecturer/at-risk', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('admin cannot access lecturer routes', async () => {
    const a = await post('/api/auth/login', demo.admin);
    const r = await get('/api/lecturer/dashboard', a.body.data.token);
    expect(r.status).toBe(403);
  });
});