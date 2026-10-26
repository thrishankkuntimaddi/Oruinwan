'use strict';

// New message with a "To:" bar (Slack-like): one person opens your chat with them right below;
// adding another opens the group with exactly those people, or says there is none yet and starts
// it with your first message.

const { test, expect } = require('@playwright/test');
const { seedData, login, openWorkspace, waitForComposerReady } = require('./helpers');

const spaNavigate = (page, p) => page.evaluate((to) => {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, p);

test('To: one person opens our chat, two open (or start) our group', async ({ browser }) => {
  test.setTimeout(180_000);
  const t = Date.now();
  const ws = seedData().workspaceId;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, 'alice');
  await openWorkspace(page);
  await spaNavigate(page, `/workspace/${ws}/messages/new`);

  const view = page.getByTestId('new-message-view');
  await expect(view).toBeVisible({ timeout: 30_000 });
  const to = view.getByLabel('To');

  await to.fill('bob');
  await view.getByTestId('to-option').filter({ hasText: 'bob' }).first().click();
  await expect(view.getByTestId('to-chip')).toHaveCount(1);
  // Our chat with bob opens below the To bar (or the "say hello" start when we never talked).
  await expect(view.locator('[contenteditable="true"], [aria-label="First message"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/messages\/new$/);

  await to.fill('sandeep');
  await view.getByTestId('to-option').filter({ hasText: 'sandeep' }).first().click();
  await expect(view.getByTestId('to-chip')).toHaveCount(2);

  const none = view.getByTestId('no-conversation');
  const text = `to bar hello ${t}`;
  if (await none.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await expect(none).toContainText("You don't have a group with");
    await view.getByLabel('First message').fill(text);
    await view.getByLabel('First message').press('Enter');
    await page.waitForURL(/\/messages\/dm\/[a-f0-9]{24}/, { timeout: 30_000 });
    await expect(page.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible({ timeout: 30_000 });
  } else {
    // The group already exists (another test made it): it opens right here.
    await waitForComposerReady(page);
    await page.locator('[contenteditable="true"]').last().click();
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await expect(page.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible({ timeout: 30_000 });
  }
  await ctx.close();
});
