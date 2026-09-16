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

describe('Admin endpoints', () => {
  jest.setTimeout(20000);
  let token;

  beforeAll(async () => {
    const r = await post('/api/auth/login', demo.admin);
    token = r.body.data.token;
  });

  test('GET /api/admin/dashboard returns stats', async () => {
    const r = await get('/api/admin/dashboard', token);
    expect(r.status).toBe(200);
    expect(r.body.data.stats.students).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/admin/users returns paginated users', async () => {
    const r = await get('/api/admin/users?limit=5', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.items)).toBe(true);
  });

  test('GET /api/admin/students returns students', async () => {
    const r = await get('/api/admin/students', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.items)).toBe(true);
  });

  test('GET /api/admin/risk returns items + summary', async () => {
    const r = await get('/api/admin/risk', token);
    expect(r.status).toBe(200);
    expect(r.body.data.summary).toBeDefined();
  });

  test('POST /api/admin/risk/recompute runs successfully', async () => {
    const r = await post('/api/admin/risk/recompute', {}, token);
    expect(r.status).toBe(200);
    expect(r.body.data.risk).toBeDefined();
  });

  test('GET /api/admin/settings returns groups', async () => {
    const r = await get('/api/admin/settings', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('GET /api/admin/audit-logs returns items', async () => {
    const r = await get('/api/admin/audit-logs', token);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.items)).toBe(true);
  });

  test('GET /api/admin/unknown-route returns 404', async () => {
    const r = await get('/api/admin/nope', token);
    expect(r.status).toBe(404);
  });
});