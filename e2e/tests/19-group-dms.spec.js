'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, sendText, headerMenu, withPg, seedData } = require('./helpers');

// Group DMs between three real people: create, everyone decrypts, remove and add back
// (history starts again from the moment they rejoin), and a group call.
test.describe('group DMs', () => {
  let alice, bob, carol, contexts, groupPath;
  const stamp = Date.now();
  const groupName = `Launch crew ${stamp}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    // Carol isn't in the seeded workspace; let her in for this file only.
    const { workspaceId, users } = seedData();
    await withPg((q) => q(
      `INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET status = 'active', removed_at = NULL`,
      [workspaceId, users.carol.id],
    ));
    contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
    [alice, bob, carol] = await Promise.all(contexts.map((c) => c.newPage()));
    for (const [page, who] of [[bob, 'bob'], [carol, 'carol'], [alice, 'alice']]) {
      await login(page, who);
      await openWorkspace(page);
    }
  });

  test.afterAll(async () => {
    await Promise.all((contexts || []).map((c) => c.close()));
    const { workspaceId, users } = seedData();
    await withPg((q) => q('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, users.carol.id]));
  });

  const groupRow = (page) => page.getByRole('link').filter({ hasText: groupName }).first();

  test('start a named group with two people', async () => {
    await alice.locator('[title="Add Direct Messages"]').first().click();
    const dialog = alice.getByRole('dialog', { name: 'New message' });
    await dialog.getByRole('checkbox', { name: 'Add bob to a group' }).click();
    await dialog.getByRole('checkbox', { name: 'Add carol to a group' }).click();
    await dialog.getByLabel('Group name').fill(groupName);
    await dialog.getByRole('button', { name: 'Start group (3)' }).click();
    await alice.waitForURL(/\/dm\/[a-f0-9]{24}/, { timeout: 30_000 });
    groupPath = new URL(alice.url()).pathname;
    await expect(alice.getByText('3 people · group')).toBeVisible();
    await expect(alice.locator('[id^="msg-"], div').filter({ hasText: /created this group/ }).first()).toBeVisible();
  });

  test('everyone sees the group and reads each other', async () => {
    await sendText(alice, `hello group ${stamp}`);

    for (const page of [bob, carol]) {
      await expect(groupRow(page)).toBeVisible({ timeout: 20_000 });
      await groupRow(page).click();
      await expect(page.locator('[id^="msg-"]').filter({ hasText: `hello group ${stamp}` })).toBeVisible({ timeout: 20_000 });
    }

    await sendText(carol, `carol here ${stamp}`);
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: `carol here ${stamp}` })).toBeVisible({ timeout: 20_000 });
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: `carol here ${stamp}` })).toBeVisible({ timeout: 20_000 });
  });

  test('the creator removes someone; they lose the group', async () => {
    await headerMenu(alice, 'Group info');
    const info = alice.getByTestId('group-info');
    await expect(info).toContainText('3 people');
    await info.getByRole('button', { name: 'Remove carol' }).click();
    await expect(info).toContainText('2 people');
    await info.getByRole('button', { name: 'Close' }).click();
    await expect(alice.getByText(/You removed carol/)).toBeVisible();

    // Carol is sent away and the group leaves her list; the server refuses her too.
    await expect(groupRow(carol)).toHaveCount(0, { timeout: 20_000 });
    const token = await carol.evaluate(() => localStorage.getItem('accessToken'));
    const dmId = groupPath.split('/dm/')[1];
    const res = await carol.request.get(`${E2E.apiUrl}/api/v2/messages/workspace/${seedData().workspaceId}/dm/${dmId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(403);
  });

  test('added back, she only sees messages from then on', async () => {
    await headerMenu(alice, 'Group info');
    const info = alice.getByTestId('group-info');
    await info.getByRole('button', { name: 'Add people' }).click();
    await info.getByLabel('Search people to add').fill('carol');
    await info.locator('label').filter({ hasText: 'carol' }).getByRole('checkbox').check();
    await info.getByRole('button', { name: /^Add 1/ }).click();
    await expect(info).toContainText('3 people');
    await info.getByRole('button', { name: 'Close' }).click();

    await sendText(alice, `welcome back ${stamp}`);
    await expect(groupRow(carol)).toBeVisible({ timeout: 20_000 });
    await groupRow(carol).click();
    await expect(carol.locator('[id^="msg-"]').filter({ hasText: `welcome back ${stamp}` })).toBeVisible({ timeout: 20_000 });
    await expect(carol.locator('[id^="msg-"]').filter({ hasText: `hello group ${stamp}` })).toHaveCount(0);
  });

  test('a group call: others in the group can join', async () => {
    await alice.locator('button[title="Start Voice Call"]').first().click();
    await expect(alice.getByTestId('call-screen')).toBeVisible();
    const banner = bob.getByTestId('huddle-announcement');
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await banner.getByRole('button', { name: 'Join' }).click();
    await expect(bob.getByTestId('call-screen')).toContainText('2 participants', { timeout: 30_000 });
    await bob.getByTestId('call-screen').getByTitle('Leave huddle').click();
    await alice.getByTestId('call-screen').getByTitle('Leave huddle').click();
    await expect(alice.getByTestId('call-screen')).toBeHidden();
  });
});
