'use strict';

// "@here / @channel in threads": the thread composer offers them in a channel, and a reply
// that uses one notifies the channel's members (not just the thread's followers).

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, waitForComposerReady, sendText, seedData } = require('./helpers');

const CHANNEL = `thread-here-${Date.now().toString(36)}`;

test.describe('@here / @channel in a thread', () => {
  test.describe.configure({ mode: 'serial' });
  let alice, bob, contexts, channelId;

  const api = (page) => ({
    token: () => page.evaluate(() => localStorage.getItem('accessToken')),
    async req(method, p, data) {
      return page.request[method](`${E2E.apiUrl}${p}`, { data, headers: { Authorization: `Bearer ${await this.token()}` } });
    },
  });

  async function openChannel(page) {
    await page.getByText(CHANNEL, { exact: true }).first().click();
    await page.waitForURL(new RegExp(`/channel/${channelId}`), { timeout: 30_000 });
  }

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    // Both log in first so their identity keys exist when the channel key is wrapped.
    await login(bob, 'bob');
    await login(alice, 'alice');
    const res = await api(alice).req('post', '/api/channels', {
      name: CHANNEL, workspaceId: seedData().workspaceId, memberIds: [seedData().users.bob.id],
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    const body = await res.json();
    channelId = String(body.channel?._id || body.channel?.id || body._id || body.id);
    await openWorkspace(alice);
    await openWorkspace(bob);
    await openChannel(alice);
    await openChannel(bob);
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  test('the thread composer suggests @here and @channel, and @channel in a reply notifies the channel', async () => {
    const root = `deploy plan ${Date.now()}`;
    await sendText(alice, root);
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: root })).toBeVisible();

    const msg = alice.locator('[id^="msg-"]').filter({ hasText: root });
    await msg.hover();
    await msg.locator('button[title="Reply in thread"]').click();
    const panel = alice.getByTestId('thread-panel');
    await expect(panel).toBeVisible();
    await waitForComposerReady(panel);

    const box = panel.locator('[contenteditable="true"]');
    await box.click();
    await alice.keyboard.type('@he');
    await expect(alice.getByText('Notify online members')).toBeVisible();
    await alice.keyboard.press('Backspace');
    await alice.keyboard.press('Backspace');
    await alice.keyboard.type('ch');
    await expect(alice.getByText('Notify everyone in this channel')).toBeVisible();
    await alice.getByText('Notify everyone in this channel').click();
    await alice.keyboard.type('please review before 5');
    await alice.keyboard.press('Enter');
    await expect(panel.getByText('please review before 5')).toBeVisible();

    // Bob never replied or followed: the @channel in the thread reply is what reaches him.
    const ws = seedData().workspaceId;
    await expect.poll(async () => {
      const r = await api(bob).req('get', `/api/notifications?workspaceId=${ws}&type=mention`);
      const { notifications = [] } = await r.json();
      return notifications.some((n) => n.meta?.channelId === channelId && n.meta?.parentMessageId && n.meta?.isEveryone);
    }, { timeout: 20_000 }).toBe(true);
  });
});
