'use strict';

// Starting a brand-new DM from the Messages page opened the chat under the other person's user
// id instead of a real DM, so the first message failed ("This conversation's encryption key is
// not ready yet") on the web and desktop apps until the DM was made elsewhere, e.g. on the phone.
//
// The accounts below are seeded test users (scripts/config.js) that have never messaged each other.

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, openWorkspace, sendText, openDm } = require('./helpers');

const SENDER = 'thrishank';
const RECIPIENT = 'sandeep';

async function signIn(browser, user) {
  const page = await (await browser.newContext()).newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), () => page.getByRole('button', { name: 'Skip tour' }).click());
  await login(page, user);
  await openWorkspace(page);
  return page;
}

test('a first DM started on the Messages page sends', async ({ browser }) => {
  test.setTimeout(180_000);
  const text = `first message ${Date.now()}`;

  const sender = await signIn(browser, SENDER);
  const workspaceId = sender.url().match(/\/workspace\/([a-f0-9]{24})\//)[1];
  // The Messages page opens on New message (the To: bar): one person opens our real DM below it.
  await sender.goto(`${E2E.webUrl}/workspace/${workspaceId}/messages`);
  const view = sender.getByTestId('new-message-view');
  await view.getByLabel('To').fill(RECIPIENT);
  await view.getByTestId('to-option').filter({ hasText: RECIPIENT }).first().click();
  const conv = view.getByTestId('to-conversation');
  await expect(conv).toBeVisible({ timeout: 30_000 });
  expect(await conv.getAttribute('data-conversation-id')).not.toBe(seedData().users[RECIPIENT].id);
  await sendText(sender, text);

  const recipient = await signIn(browser, RECIPIENT);
  await recipient.getByRole('button', { name: 'Home', exact: true }).first().click();
  await openDm(recipient, SENDER);
  await expect(recipient.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible({ timeout: 30_000 });
});
