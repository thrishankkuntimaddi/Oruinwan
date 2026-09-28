'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, waitForComposerReady, sendText, seedData } = require('./helpers');

const CHANNEL = `mentions-${Date.now().toString(36)}`;

test.describe('mention profile card', () => {
  test.describe.configure({ mode: 'serial' });
  let alice, bob, contexts, channelId;
  const text = `ping @bob about the launch ${Date.now()}`;

  const token = (page) => page.evaluate(() => localStorage.getItem('accessToken'));
  const composer = (scope) => scope.locator('[contenteditable="true"]').last();
  const card = (page) => page.getByRole('dialog').filter({ has: page.getByTestId('profile-card-name') });
  const mentionIn = (scope) => scope.locator('[id^="msg-"], [data-testid="thread-panel"]').filter({ hasText: 'about the launch' })
    .locator('[data-mention="bob"]').first();

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    // Both log in first so their identity keys exist when the channel key is wrapped.
    await login(bob, 'bob');
    await login(alice, 'alice');
    const res = await alice.request.post(`${E2E.apiUrl}/api/channels`, {
      data: { name: CHANNEL, workspaceId: seedData().workspaceId, memberIds: [seedData().users.bob.id] },
      headers: { Authorization: `Bearer ${await token(alice)}` },
    });
    expect(res.status(), await res.text()).toBeLessThan(300);
    const body = await res.json();
    channelId = String(body.channel?._id || body.channel?.id || body._id || body.id);
    await openWorkspace(alice);
    await alice.getByText(CHANNEL, { exact: true }).first().click();
    await alice.waitForURL(new RegExp(`/channel/${channelId}`), { timeout: 30_000 });
    await waitForComposerReady(alice);
    await sendText(alice, text);
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  test('the card endpoint is limited to co-workers', async () => {
    const auth = { Authorization: `Bearer ${await token(alice)}` };
    const ok = await alice.request.get(`${E2E.apiUrl}/api/users/card`, { params: { username: 'bob', workspaceId: seedData().workspaceId }, headers: auth });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).card).toMatchObject({ username: 'bob', email: E2E.users.bob.email, workspaceRole: expect.any(String) });
    const missing = await alice.request.get(`${E2E.apiUrl}/api/users/card`, { params: { username: 'nobody-here', workspaceId: seedData().workspaceId }, headers: auth });
    expect(missing.status()).toBe(404);
  });

  test('clicking a mention shows the person, and Mention inserts @bob into the composer', async () => {
    const chip = mentionIn(alice);
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('role', 'button');
    await chip.click();
    const dialog = card(alice);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('profile-card-name')).toHaveText('bob');
    await expect(dialog.getByTestId('profile-card-email')).toHaveText(E2E.users.bob.email);

    await dialog.getByRole('button', { name: /Mention/ }).click();
    await expect(dialog).toBeHidden();
    await expect(composer(alice).locator('[data-mention="bob"]')).toHaveText('@bob');
  });

  test('Escape closes the card and keyboard opens it again', async () => {
    const chip = mentionIn(alice);
    await chip.focus();
    await alice.keyboard.press('Enter');
    await expect(card(alice)).toBeVisible();
    await alice.keyboard.press('Escape');
    await expect(card(alice)).toBeHidden();
  });

  test('a mention inside a thread inserts into the thread composer', async () => {
    const msg = alice.locator('[id^="msg-"]').filter({ hasText: 'about the launch' });
    await msg.hover();
    await msg.locator('button[title="Reply in thread"]').click();
    const panel = alice.getByTestId('thread-panel');
    await expect(panel).toBeVisible();
    await waitForComposerReady(panel);
    await panel.locator('[data-mention="bob"]').first().click();
    await card(alice).getByRole('button', { name: /Mention/ }).click();
    await expect(panel.locator('[contenteditable="true"] [data-mention="bob"]')).toHaveCount(1);
    await panel.getByTitle('Close').click();
  });

  test('Message opens the DM with that person', async () => {
    await mentionIn(alice).click();
    await card(alice).getByRole('button', { name: /^Message$/ }).click();
    await alice.waitForURL(/\/dm\/[a-f0-9]{24}/, { timeout: 30_000 });
    await waitForComposerReady(alice);
  });
});
