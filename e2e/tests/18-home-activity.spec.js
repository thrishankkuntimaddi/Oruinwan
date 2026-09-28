'use strict';

/**
 * Home → Activity (client/src/features/activity): while Alice sits on Home,
 * Bob DMs her and @mentions her in a channel. Both rows appear live with
 * decrypted previews; opening the DM row opens the conversation and clears
 * the row. The /activity endpoint is members-only.
 */

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm, sendText, seedData } = require('./helpers');

const CHANNEL = `activity-${Date.now().toString(36)}`;

/** In-app navigation without a reload (a reload would ask for the key password). */
const spaNavigate = (page, path) => page.evaluate((p) => {
  window.history.pushState({}, '', p);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, path);

const api = (page) => ({
  token: () => page.evaluate(() => localStorage.getItem('accessToken')),
  async req(method, p, data) {
    return page.request[method](`${E2E.apiUrl}${p}`, { data, headers: { Authorization: `Bearer ${await this.token()}` } });
  },
});

test.describe('home activity', () => {
  test.describe.configure({ mode: 'serial' });
  let alice, bob, carol, contexts, workspaceId, channelId;
  const stamp = Date.now();

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
    [alice, bob, carol] = await Promise.all(contexts.map((c) => c.newPage()));
    await login(bob, 'bob');
    await login(alice, 'alice');
    workspaceId = seedData().workspaceId;
    const res = await api(alice).req('post', '/api/channels', {
      name: CHANNEL, workspaceId, memberIds: [seedData().users.bob.id],
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    const body = await res.json();
    channelId = String(body.channel?._id || body.channel?.id || body._id || body.id);
    await openWorkspace(bob);
    await openWorkspace(alice);
    await spaNavigate(alice, `/workspace/${workspaceId}/home`);
    await expect(alice.getByTestId('home-activity')).toBeVisible();
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  test('the activity endpoint is for workspace members only', async () => {
    const mine = await api(alice).req('get', `/api/v2/messages/workspace/${workspaceId}/activity`);
    expect(mine.status()).toBe(200);
    expect(Array.isArray((await mine.json()).items)).toBe(true);

    await login(carol, 'carol');
    const theirs = await api(carol).req('get', `/api/v2/messages/workspace/${workspaceId}/activity`);
    expect(theirs.status()).toBe(403);
  });

  test('a DM and a channel @mention show up live with decrypted previews', async () => {
    const activity = alice.getByTestId('home-activity');
    const dmText = `review the deck ${stamp}`;
    const mentionText = `launch notes ready ${stamp}`;

    await openDm(bob, 'alice');
    await sendText(bob, dmText);

    const dmRow = activity.locator('[data-testid="activity-row"][data-kind="dm"]').filter({ hasText: 'bob' });
    await expect(dmRow).toBeVisible();
    await expect(dmRow).toContainText(dmText);
    await expect(dmRow.locator('.gl-shell-unread')).toHaveText('1');

    await spaNavigate(bob, `/workspace/${workspaceId}/channel/${channelId}`);
    await bob.waitForURL(new RegExp(`/channel/${channelId}`));
    await sendText(bob, `@alice ${mentionText}`);

    const chRow = activity.locator('[data-testid="activity-row"][data-kind="channel"]').filter({ hasText: CHANNEL });
    await expect(chRow).toBeVisible();
    await expect(chRow).toContainText('1 new · @you');
    await expect(chRow).toContainText(mentionText);
    // Newest first: the channel mention is above the DM.
    await expect(activity.locator('[data-testid="activity-row"]').first()).toContainText(CHANNEL);

    // The Mentions filter keeps only the mention; DMs keeps only the DM.
    await activity.getByRole('tab', { name: /Mentions/ }).click();
    await expect(chRow).toBeVisible();
    await expect(dmRow).toHaveCount(0);
    await activity.getByRole('tab', { name: /DMs/ }).click();
    await expect(dmRow).toBeVisible();
    await expect(chRow).toHaveCount(0);
    await activity.getByRole('tab', { name: /All/ }).click();

    // The section header counts the rows.
    await expect(alice.locator('[data-testid="activity-count"]')).toHaveText(/^[2-9]/);
  });

  test('opening the DM row opens the conversation and clears the row', async () => {
    const activity = alice.getByTestId('home-activity');
    const dmRow = activity.locator('[data-testid="activity-row"][data-kind="dm"]').filter({ hasText: 'bob' });
    await dmRow.click();
    await alice.waitForURL(/\/home\/dm\/[a-f0-9]{24}/);
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: `review the deck ${stamp}` })).toBeVisible();
    await expect(dmRow).toHaveCount(0);

    // Still cleared after leaving the conversation (it was marked read).
    await spaNavigate(alice, `/workspace/${workspaceId}/home`);
    await expect(activity.locator('[data-testid="activity-row"][data-kind="channel"]').filter({ hasText: CHANNEL })).toBeVisible();
    await expect(dmRow).toHaveCount(0);
    await expect.poll(async () => {
      const r = await api(alice).req('get', `/api/v2/messages/workspace/${workspaceId}/activity`);
      return (await r.json()).items.filter((i) => i.type === 'dm').length;
    }).toBe(0);
  });

  test('opening the channel row clears it', async () => {
    const activity = alice.getByTestId('home-activity');
    await activity.locator('[data-testid="activity-row"][data-kind="channel"]').filter({ hasText: CHANNEL }).click();
    await alice.waitForURL(new RegExp(`/channel/${channelId}`));
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: `launch notes ready ${stamp}` })).toBeVisible();
    await spaNavigate(alice, `/workspace/${workspaceId}/home`);
    await expect(activity.locator('[data-testid="activity-row"][data-kind="channel"]')).toHaveCount(0);
  });
});
