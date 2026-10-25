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

// The page shows a real DM: /messages/dm/<id>, where <id> is not the person's user id.
const isRealDm = (personId) => (url) => url.pathname.includes('/messages/dm/') && !url.pathname.endsWith(personId);

test('a first DM started on the Messages page sends', async ({ browser }) => {
  test.setTimeout(180_000);
  const text = `first message ${Date.now()}`;

  const sender = await signIn(browser, SENDER);
  const workspaceId = sender.url().match(/\/workspace\/([a-f0-9]{24})\//)[1];
  await sender.goto(`${E2E.webUrl}/workspace/${workspaceId}/messages`);
  await sender.getByLabel('Find a person').fill(RECIPIENT);
  await sender.getByText(RECIPIENT, { exact: true }).first().click();

  await sender.waitForURL(isRealDm(seedData().users[RECIPIENT].id), { timeout: 30_000 });
  await sendText(sender, text);

  const recipient = await signIn(browser, RECIPIENT);
  await recipient.getByRole('button', { name: 'Home', exact: true }).first().click();
  await openDm(recipient, SENDER);
  await expect(recipient.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible({ timeout: 30_000 });
});
