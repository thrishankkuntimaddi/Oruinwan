'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm, sendText, headerMenu, withDb, seedData } = require('./helpers');

// Every action in a DM's header, exercised between two real users.
test.describe('DM header actions', () => {
  let alice, bob, contexts;

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);
    await openDm(alice, 'bob');
    await openDm(bob, 'alice');
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  test('the header shows a signed-in person as active', async () => {
    await expect(alice.getByText('Active now').first()).toBeVisible();
  });

  test('view profile shows the other person', async () => {
    await headerMenu(alice, 'View Profile');
    await expect(alice.getByText(E2E.users.bob.email)).toBeVisible();
    await alice.keyboard.press('Escape');
    await expect(alice.getByText(E2E.users.bob.email)).toBeHidden();
  });

  test('search filters the decrypted conversation', async () => {
    const stamp = Date.now();
    await sendText(alice, `apples ${stamp}`);
    await sendText(alice, `oranges ${stamp}`);
    await alice.locator('button[title="Search in conversation"], button[title="Search"]').first().click();
    await alice.getByPlaceholder(/search/i).last().fill(`apples ${stamp}`);
    await expect(alice.getByTestId('search-results-banner')).toBeVisible();
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: `apples ${stamp}` })).toBeVisible();
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: `oranges ${stamp}` })).toHaveCount(0);
    await alice.getByPlaceholder(/search/i).last().fill('');
  });

  test('pin a message and find it in the pinned panel', async () => {
    const text = `pin me ${Date.now()}`;
    await sendText(alice, text);
    const msg = alice.locator('[id^="msg-"]').filter({ hasText: text });
    await msg.hover();
    await msg.locator('button[title="More"]').click();
    await alice.getByRole('menuitem', { name: 'Pin message' }).or(alice.getByText('Pin message', { exact: true })).first().click();
    await alice.locator('button[title="Pinned messages"]').click();
    const panel = alice.getByTestId('pinned-panel');
    await expect(panel.getByText(text)).toBeVisible();
    await panel.locator('button').first().click(); // close
  });

  test('mute stops DM notifications until unmuted', async () => {
    const { users } = seedData();
    const dmCount = () => withDb((db) => db.collection('notifications').countDocuments({ recipient: new (require(require.resolve('mongodb', { paths: [require('path').join(__dirname, '..', '..', 'server')] })).ObjectId)(users.alice.id), type: 'dm' }));

    await headerMenu(alice, 'Mute Notifications');
    await expect.poll(async () => (await alice.request.get(`${E2E.apiUrl}/api/v2/dm/${alice.url().split('/dm/')[1]}/status`, { headers: { Authorization: `Bearer ${await alice.evaluate(() => localStorage.getItem('accessToken'))}` } })).json()).toMatchObject({ isMuted: true });

    const before = await dmCount();
    await sendText(bob, `while muted ${Date.now()}`);
    await alice.waitForTimeout(1500);
    expect(await dmCount()).toBe(before);

    await headerMenu(alice, 'Unmute Notifications');
    await alice.waitForTimeout(500);
    await sendText(bob, `after unmute ${Date.now()}`);
    await expect.poll(dmCount, { timeout: 10_000 }).toBeGreaterThan(before);
  });

  test('block stops the other person from messaging, unblock restores it', async () => {
    await headerMenu(alice, 'Block User');
    await expect(alice.getByTestId('blocked-notice')).toContainText('You blocked this person');

    // Bob reopens the conversation and is told he can't message.
    await bob.getByRole('button', { name: 'Home' }).first().click();
    await openDm(bob, 'alice');
    await expect(bob.getByTestId('blocked-notice')).toContainText("can't send messages");

    // The server refuses too, whatever the UI does.
    const token = await bob.evaluate(() => localStorage.getItem('accessToken'));
    const dmId = bob.url().split('/dm/')[1];
    const res = await bob.request.post(`${E2E.apiUrl}/api/v2/messages/direct`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { dmSessionId: dmId, ciphertext: 'x', messageIv: 'y', isEncrypted: true },
    });
    expect(res.status()).toBe(403);

    await headerMenu(alice, 'Unblock User');
    await expect(alice.getByTestId('blocked-notice')).toHaveCount(0);
  });

  test('clear chat empties it for me only', async () => {
    const text = `before clear ${Date.now()}`;
    await sendText(alice, text);
    await headerMenu(alice, 'Clear Chat');
    await alice.getByRole('button', { name: /^Clear/ }).last().click();
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: text })).toHaveCount(0);

    await bob.getByRole('button', { name: 'Home' }).first().click();
    await openDm(bob, 'alice');
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible();
  });

  test('delete chat hides it until a new message arrives', async () => {
    await headerMenu(alice, 'Delete Chat');
    await alice.getByRole('button', { name: 'Delete', exact: true }).last().click();
    const token = await alice.evaluate(() => localStorage.getItem('accessToken'));
    const listDms = async () => (await (await alice.request.get(`${E2E.apiUrl}/api/v2/messages/workspace/${seedData().workspaceId}/dms`, { headers: { Authorization: `Bearer ${token}` } })).json()).sessions || [];
    await expect.poll(async () => (await listDms()).length).toBe(0);

    await sendText(bob, `are you there ${Date.now()}`);
    await expect.poll(async () => (await listDms()).length).toBe(1);
  });
});
