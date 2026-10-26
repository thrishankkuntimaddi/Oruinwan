'use strict';

// The To: bar from Home, notes to self, a group's "+" (the To: bar with its people), and the
// 1:1 mention offer that opens an existing group instead of starting another.

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, openDm, sendText } = require('./helpers');

test('Home To: bar, notes to self, a group "+", and an existing group offered', async ({ browser }) => {
  test.setTimeout(240_000);
  const t = Date.now();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, 'thrishank');
  await openWorkspace(page);

  // Home's compose button opens the To: bar; picking myself opens my notes.
  await page.locator('[title="New Message"]').first().click();
  const view = page.getByTestId('new-message-view');
  await expect(view).toBeVisible({ timeout: 30_000 });
  await view.getByLabel('To').fill('thrishank');
  await view.getByTestId('to-option').filter({ hasText: '(you)' }).first().click();
  await expect(view.getByTestId('to-conversation')).toBeVisible({ timeout: 30_000 });
  await sendText(page, `note to self ${t}`);

  // Two people: no group yet, so start one.
  await page.locator('[title="New Message"]').first().click();
  for (const who of ['bob', 'shiva']) {
    await view.getByLabel('To').fill(who);
    await view.getByTestId('to-option').filter({ hasText: who }).first().click();
  }
  await expect(view.getByTestId('no-conversation')).toBeVisible({ timeout: 30_000 });
  await view.getByTestId('start-group').click();
  await page.waitForURL(/\/home\/dm\/[a-f0-9]{24}/, { timeout: 30_000 });

  // The group's "+" opens the To: bar with its people; removing one shows our 1:1 chat instead.
  await page.getByTestId('group-edit-people').click();
  await expect(view.getByTestId('to-chip')).toHaveCount(2);
  await view.getByRole('button', { name: 'Remove shiva' }).click();
  await expect(view.getByTestId('to-conversation')).toBeVisible({ timeout: 30_000 });

  // In my DM with bob, mentioning shiva offers to open our existing group.
  await openDm(page, 'bob');
  await sendText(page, `ask @shiva ${t}`);
  const offer = page.getByTestId('group-offer');
  await expect(offer).toContainText('You already have a group', { timeout: 30_000 });
  await expect(page.getByTestId('group-offer-start')).toHaveText('Open group');
  await ctx.close();
});
