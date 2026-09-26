'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, seedData } = require('./helpers');

// API-level checks: who may list, create and delete a workspace's outgoing webhooks.
test.describe('webhook access control', () => {
  const tokens = {};
  const ws = () => seedData().workspaceId;

  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: E2E.apiUrl });
    for (const key of ['alice', 'bob', 'carol']) {
      const res = await api.post('/api/auth/login', { data: { email: E2E.users[key].email, password: E2E.password } });
      expect(res.ok(), `login ${key}`).toBeTruthy();
      tokens[key] = (await res.json()).accessToken;
    }
    await api.dispose();
  });

  const as = (request, key) => ({
    get: (p) => request.get(`${E2E.apiUrl}${p}`, { headers: { Authorization: `Bearer ${tokens[key]}` } }),
    post: (p, data) => request.post(`${E2E.apiUrl}${p}`, { data, headers: { Authorization: `Bearer ${tokens[key]}` } }),
    del: (p) => request.delete(`${E2E.apiUrl}${p}`, { headers: { Authorization: `Bearer ${tokens[key]}` } }),
  });

  test('only workspace admins create, members list, and nobody else can see or delete', async ({ request }) => {
    const alice = as(request, 'alice');
    const bob = as(request, 'bob');
    const carol = as(request, 'carol');
    const body = { workspaceId: ws(), event: 'task.created', url: 'https://example.com/hook' };

    expect((await bob.post('/api/v2/integrations/webhooks', body)).status()).toBe(403); // member, not admin
    expect((await carol.post('/api/v2/integrations/webhooks', body)).status()).toBe(403); // outsider
    expect((await alice.post('/api/v2/integrations/webhooks', { ...body, url: 'javascript:alert(1)' })).status()).toBe(400);

    const created = await alice.post('/api/v2/integrations/webhooks', body);
    expect(created.status()).toBe(201);
    const hookId = (await created.json()).webhook._id;

    expect((await bob.get(`/api/v2/integrations/webhooks?workspaceId=${ws()}`)).status()).toBe(200);
    expect((await carol.get(`/api/v2/integrations/webhooks?workspaceId=${ws()}`)).status()).toBe(403);
    expect((await carol.get('/api/v2/integrations/webhooks?workspaceId=not-an-id')).status()).toBe(400);

    // The old hole: anyone could delete any webhook by id.
    expect((await carol.del(`/api/v2/integrations/webhooks/${hookId}`)).status()).toBe(404);
    expect((await bob.del(`/api/v2/integrations/webhooks/${hookId}`)).status()).toBe(404);
    const list = await (await alice.get(`/api/v2/integrations/webhooks?workspaceId=${ws()}`)).json();
    expect(list.webhooks.map((w) => w._id)).toContain(hookId);

    expect((await alice.del(`/api/v2/integrations/webhooks/${hookId}`)).status()).toBe(200);
    const after = await (await alice.get(`/api/v2/integrations/webhooks?workspaceId=${ws()}`)).json();
    expect(after.webhooks.map((w) => w._id)).not.toContain(hookId);
  });
});
