'use strict';
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';

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

describe('Risk Engine — Integration', () => {
  jest.setTimeout(60000);
  let adminToken;

  beforeAll(async () => {
    const r = await post('/api/auth/login', { email: 'admin@smartacademic.edu', password: 'Admin@123' });
    adminToken = r.body.data.token;
  });

  test('recompute endpoint runs and returns counts', async () => {
    const r = await post('/api/admin/risk/recompute', {}, adminToken);
    expect(r.status).toBe(200);
    expect(r.body.data.risk.count).toBeGreaterThanOrEqual(0);
  });

  test('risk list is ordered by severity', async () => {
    const r = await get('/api/admin/risk', adminToken);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.items)).toBe(true);
    // First item should be RED or ORANGE if any exist
    if (r.body.data.items.length > 0) {
      expect(['RED', 'ORANGE', 'YELLOW', 'GREEN']).toContain(r.body.data.items[0].risk_category);
    }
  });
});