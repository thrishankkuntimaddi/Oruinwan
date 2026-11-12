'use strict';

const path = require('path');
const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, seedData, withDb } = require('./helpers');

const platform = (f) => path.join(__dirname, '..', '..', 'platform', 'crypto', f);

async function tokenOf(api, key) {
  const res = await api.post('/api/auth/login', { data: { email: E2E.users[key].email, password: E2E.password } });
  expect(res.ok(), `login ${key}`).toBeTruthy();
  return (await res.json()).accessToken;
}

/** The shared client (platform/crypto/privateChatClient.js) talking to the real server as `key`. */
async function clientFor(api, key) {
  const { createPrivateChats, memoryStore } = await import(platform('privateChatClient.js'));
  const token = await tokenOf(api, key);
  const call = async (method, p, { data, params } = {}) => {
    const res = await api.fetch(`/api/private${p}`, { method, data, params, headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok()) throw Object.assign(new Error(body.message || `HTTP ${res.status()}`), { status: res.status(), code: body.code });
    return body;
  };
  const http = {
    get: (p, query) => call('GET', p, { params: Object.fromEntries(Object.entries(query || {}).filter(([, v]) => v != null)) }),
    post: (p, data) => call('POST', p, { data }),
    put: (p, data) => call('PUT', p, { data }),
    del: (p) => call('DELETE', p),
  };
  return { client: createPrivateChats({ http, userId: seedData().users[key].id, store: memoryStore(), label: `e2e ${key}` }), call, token };
}

async function goInApp(page, p) {
  await page.evaluate((to) => { window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')); }, p);
  await page.waitForURL((u) => u.pathname === p);
}

test.describe('private chats (end-to-end encrypted)', () => {
  test('the server stores only ciphertext, enforces its rules, and the web app reads and writes', async ({ page, playwright }) => {
    const { workspaceId: ws, users } = seedData();
    const api = await playwright.request.newContext({ baseURL: E2E.apiUrl });
    const alice = await clientFor(api, 'alice');
    const bob = await clientFor(api, 'bob');
    const carol = await clientFor(api, 'carol');

    await alice.client.ensureDevice();
    await bob.client.ensureDevice();
    const chat = await alice.client.open(ws, users.bob.id);
    expect(chat.participants.sort()).toEqual([users.alice.id, users.bob.id].sort());
    // Opening again (from either side) is the same chat.
    expect((await bob.client.open(ws, users.alice.id)).id).toBe(chat.id);

    const secret = `launch code ${Date.now()}`;
    await alice.client.send(chat, secret);
    const [read] = await bob.client.messages(chat);
    expect(read).toMatchObject({ mine: false, text: secret });

    // Nothing readable at rest: the stored envelope has no plaintext and the server has no key.
    const stored = await withDb((db) => db.collection('privatemessages').find({ chat: { $exists: true } }).toArray());
    expect(stored.length).toBeGreaterThan(0);
    expect(JSON.stringify(stored)).not.toContain(secret);
    const devices = await withDb((db) => db.collection('privatedevices').find({}).toArray());
    expect(Object.keys(devices[0]).sort()).not.toContain('privateKey');

    // Carol (outside the workspace) can't open a chat, read it, or list their devices.
    await expect(carol.client.open(ws, users.alice.id)).rejects.toMatchObject({ status: 403 });
    await expect(carol.call('GET', `/chats/${chat.id}/messages`)).rejects.toMatchObject({ status: 404 });
    await carol.client.ensureDevice();
    await expect(carol.call('GET', '/devices', { params: { userIds: users.alice.id } })).rejects.toMatchObject({ status: 403 });

    // Bob can't post as Alice or from a device that isn't his.
    const env = (await bob.call('GET', `/chats/${chat.id}/messages`)).messages[0].envelope;
    await expect(bob.call('POST', `/chats/${chat.id}/messages`, { data: { clientId: 'f'.repeat(32), envelope: env } }))
      .rejects.toMatchObject({ status: 400, code: 'BAD_ENVELOPE' });

    // Safety numbers agree on both sides.
    expect((await alice.client.safety(chat)).number).toBe((await bob.client.safety(chat)).number);

    // The web app: Alice's browser is a new device, so the earlier message isn't readable there;
    // what she sends from the browser, Bob's device reads.
    await login(page, 'alice');
    await openWorkspace(page);
    await goInApp(page, `/workspace/${ws}/private/${chat.id}`);
    await expect(page.getByRole('heading', { name: 'Private chats' })).toBeVisible();
    await expect(page.getByText(/Sent before this device joined/)).toBeVisible();
    const fromWeb = `from the browser ${Date.now()}`;
    await page.getByLabel('Private message').fill(fromWeb);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(fromWeb)).toBeVisible();
    await expect.poll(async () => (await bob.client.messages(chat)).map((m) => m.text)).toContain(fromWeb);
    await page.getByRole('button', { name: 'Safety number' }).click();
    await expect(page.getByTestId('safety-number')).toHaveText(/^(\d{5} ){11}\d{5}$/);
    await api.dispose();
  });
});
