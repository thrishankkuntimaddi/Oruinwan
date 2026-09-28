'use strict';

/**
 * When do notifications pop? (client/src/features/notifications/notificationPolicy.js)
 * Alice's page gets a fake Notification API (counts OS notifications), a
 * counting AudioContext (chimes) and controllable visibility/focus.
 */

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm, sendText } = require('./helpers');

const STUBS = () => {
  window.__osNotifs = [];
  window.__chimes = 0;
  window.__vis = 'visible';
  window.__focus = true;
  class FakeNotification {
    constructor(title, opts = {}) {
      this.title = title;
      Object.assign(this, opts);
      window.__osNotifs.push({ title, body: opts.body, tag: opts.tag, renotify: opts.renotify });
    }
    close() { if (this.onclose) this.onclose(); }
  }
  FakeNotification.permission = 'granted';
  FakeNotification.requestPermission = () => Promise.resolve('granted');
  window.Notification = FakeNotification;
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => window.__vis !== 'visible' });
  Document.prototype.hasFocus = () => window.__focus;
  const AC = window.AudioContext;
  if (AC) {
    window.AudioContext = class extends AC {
      createOscillator() { window.__chimes += 1; return super.createOscillator(); }
    };
  }
};

const setAttention = (page, visible) => page.evaluate((v) => {
  window.__vis = v ? 'visible' : 'hidden';
  window.__focus = v;
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event(v ? 'focus' : 'blur'));
}, visible);

/** In-app navigation without a reload (a reload would ask for the key password). */
const spaNavigate = (page, path) => page.evaluate((p) => {
  window.history.pushState({}, '', p);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, path);

const osNotifs = (page) => page.evaluate(() => window.__osNotifs.slice());
const chimes = (page) => page.evaluate(() => window.__chimes);
const bobToasts = (page) => page.locator('div[style*="z-index: 9999"] > div').filter({ hasText: 'bob' });
const settle = (page, ms = 1500) => page.waitForTimeout(ms);

async function api(page, method, path, body) {
  return page.evaluate(async ({ url, method, body }) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  }, { url: `${E2E.apiUrl}${path}`, method, body });
}

test.describe('notification pop-ups', () => {
  let alice, bob, contexts, workspaceId, dmPath;
  const stamp = Date.now();

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    await contexts[0].addInitScript(STUBS);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);
    workspaceId = /\/workspace\/([a-f0-9]{24})\//.exec(alice.url())[1];
    await openDm(alice, 'bob'); await openDm(bob, 'alice');
    dmPath = new URL(alice.url()).pathname;
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  test('(1) viewing the DM: no toast, no OS notification, no chime', async () => {
    const text = `seen live ${stamp}`;
    await sendText(bob, text);
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible();
    await settle(alice);
    await expect(bobToasts(alice)).toHaveCount(0);
    expect(await osNotifs(alice)).toHaveLength(0);
    expect(await chimes(alice)).toBe(0);
  });

  test('(4) reply in the open thread: nothing pops and it is not unread', async () => {
    const root = `notif thread root ${stamp}`;
    await sendText(alice, root);
    const open = async (page) => {
      const msg = page.locator('[id^="msg-"]').filter({ hasText: root });
      await msg.hover();
      await msg.locator('button[title="Reply in thread"]').click();
      const panel = page.getByTestId('thread-panel');
      await expect(panel).toBeVisible();
      return panel;
    };
    await open(alice);
    const bobThread = await open(bob);
    await expect(bobThread.getByText('Message...', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await bobThread.locator('[contenteditable="true"]').click();
    await bob.keyboard.type(`thread reply ${stamp}`);
    await bob.keyboard.press('Enter');
    await expect(alice.getByTestId('thread-panel').getByText(`thread reply ${stamp}`)).toBeVisible();

    await expect.poll(async () => {
      const { data } = await api(alice, 'GET', `/api/notifications?workspaceId=${workspaceId}&limit=30`);
      const reply = (data?.notifications || []).find((n) => n.type === 'thread_reply');
      return reply ? reply.read : 'missing';
    }, { timeout: 10_000 }).toBe(true);
    await expect(bobToasts(alice)).toHaveCount(0);
    expect(await osNotifs(alice)).toHaveLength(0);
    await alice.getByTestId('thread-panel').getByTitle('Close').click();
    await bob.getByTestId('thread-panel').getByTitle('Close').click();
  });

  test('(2) elsewhere in the app: one coalesced toast for a burst, no OS notification', async () => {
    await spaNavigate(alice, `/workspace/${workspaceId}/tasks`);
    await alice.waitForURL(/\/tasks/);
    await settle(alice, 1000);
    for (let i = 1; i <= 5; i += 1) await sendText(bob, `burst ${i} ${stamp}`);
    await expect(bobToasts(alice)).toHaveCount(1);
    await expect(bobToasts(alice).first()).toContainText(/[2-5] new messages from bob/);
    await expect.poll(() => alice.evaluate(() => document.querySelector('div[style*="z-index: 9999"]').innerText)).toContain('5 new messages from bob');
    expect(await osNotifs(alice)).toHaveLength(0);
    expect(await chimes(alice)).toBeGreaterThan(0);
  });

  test('(3) hidden tab: exactly one OS notification per conversation, no toast', async () => {
    await expect(bobToasts(alice)).toHaveCount(0, { timeout: 10_000 });
    await setAttention(alice, false);
    const before = (await osNotifs(alice)).length;
    for (let i = 1; i <= 3; i += 1) await sendText(bob, `while away ${i} ${stamp}`);
    await expect.poll(async () => (await osNotifs(alice)).length - before, { timeout: 10_000 }).toBe(3);
    const shown = (await osNotifs(alice)).slice(before);
    const tags = new Set(shown.map((n) => n.tag));
    expect(tags.size).toBe(1);
    expect([...tags][0]).toMatch(/^oruinwan:dm:[a-f0-9]{24}$/);
    expect(shown.every((n) => n.renotify === false)).toBe(true);
    expect(shown[shown.length - 1].title).toBe('3 new messages from bob');
    await expect(bobToasts(alice)).toHaveCount(0);
  });

  test('(5) mentionsOnly: a task notification stays in the bell, DMs still notify', async () => {
    const setMentionsOnly = (on) => alice.evaluate((v) => {
      window.dispatchEvent(new CustomEvent('oruinwan:notification-prefs', { detail: { mentionsOnly: v } }));
    }, on);
    await setMentionsOnly(true);
    let before = (await osNotifs(alice)).length;
    const r1 = await api(alice, 'POST', '/api/notifications/test', { workspaceId, type: 'task_assigned', title: `task-a ${stamp}`, body: 'x' });
    expect(r1.status).toBe(201);
    await settle(alice);
    expect((await osNotifs(alice)).slice(before).map((n) => n.title)).not.toContain(`task-a ${stamp}`);

    await sendText(bob, `dm under mentionsOnly ${stamp}`);
    await expect.poll(async () => (await osNotifs(alice)).length - before).toBe(1);

    await setMentionsOnly(false);
    before = (await osNotifs(alice)).length;
    await api(alice, 'POST', '/api/notifications/test', { workspaceId, type: 'task_assigned', title: `task-b ${stamp}`, body: 'x' });
    await expect.poll(async () => (await osNotifs(alice)).slice(before).map((n) => n.title)).toContain(`task-b ${stamp}`);
  });

  test('back in the app on the DM: nothing pops; Settings test notification still works', async () => {
    await spaNavigate(alice, dmPath);
    await setAttention(alice, true);
    const before = (await osNotifs(alice)).length;
    const text = `back again ${stamp}`;
    await sendText(bob, text);
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible();
    await settle(alice);
    expect((await osNotifs(alice)).length).toBe(before);
    await expect(bobToasts(alice)).toHaveCount(0);

    await spaNavigate(alice, '/settings?tab=notifications');
    await alice.getByRole('button', { name: /Send a test/ }).click();
    await expect.poll(async () => (await osNotifs(alice)).map((n) => n.tag)).toContain('oruinwan-test');
  });
});
