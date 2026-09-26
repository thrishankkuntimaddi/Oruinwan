'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, waitForComposerReady, sendText, headerMenu, seedData } = require('./helpers');

const CHANNEL = `announce-${Date.now().toString(36)}`;
const NOTICE = 'Only channel admins can post here';

test.describe('channel policies', () => {
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
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  test('a member can mute and unmute the channel', async () => {
    await openChannel(bob);
    await waitForComposerReady(bob);
    await headerMenu(bob, 'Mute Notifications');
    await expect.poll(async () => (await (await api(bob).req('get', `/api/channels/${channelId}/mute`)).json()).isMuted).toBe(true);
    await headerMenu(bob, 'Unmute Notifications');
    await expect.poll(async () => (await (await api(bob).req('get', `/api/channels/${channelId}/mute`)).json()).isMuted).toBe(false);
  });

  test('members cannot change channel policies', async () => {
    expect((await api(bob).req('patch', `/api/channels/${channelId}/posting-policy`, { postingPolicy: 'admins' })).status()).toBe(403);
    expect((await api(bob).req('patch', `/api/channels/${channelId}/mention-policy`, { broadcastMentions: 'admins' })).status()).toBe(403);
  });

  test('an admin restricts posting; members are locked out live and by the server', async () => {
    await openChannel(alice);
    await waitForComposerReady(alice);
    await headerMenu(alice, 'Manage Channel');
    await alice.getByTestId('posting-policy').selectOption('admins');
    await alice.getByTestId('mention-policy').selectOption('admins');
    await alice.keyboard.press('Escape');

    // Bob's composer switches to the notice without a reload.
    await expect(bob.getByText(NOTICE)).toBeVisible({ timeout: 15_000 });

    const denied = await api(bob).req('post', '/api/v2/messages/channel', {
      channelId, ciphertext: 'x', messageIv: 'x', isEncrypted: true,
    });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).code).toBe('POSTING_RESTRICTED');

    const poll = await api(bob).req('post', '/api/v2/messages/poll', { channelId, poll: { question: 'Q?', options: ['a', 'b'] } });
    expect(poll.status()).toBe(403);

    // The admin can still post.
    await sendText(alice, 'Announcement from alice');
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: 'Announcement from alice' })).toBeVisible();

    // Both settings are persisted and shown when the settings reopen.
    const state = await (await api(alice).req('get', `/api/channels/${channelId}/mute`)).json();
    expect(state).toMatchObject({ postingPolicy: 'admins', broadcastMentions: 'admins' });
    await headerMenu(alice, 'Manage Channel');
    await expect(alice.getByTestId('posting-policy')).toHaveValue('admins');
    await expect(alice.getByTestId('mention-policy')).toHaveValue('admins');
    await alice.keyboard.press('Escape');
  });

  test('reopening the channel restores posting for members', async () => {
    const res = await api(alice).req('patch', `/api/channels/${channelId}/posting-policy`, { postingPolicy: 'everyone' });
    expect(res.status()).toBe(200);
    await expect(bob.getByText(NOTICE)).toHaveCount(0, { timeout: 15_000 });
    await sendText(bob, 'Bob can talk again');
  });
});
