'use strict';

// Read receipts on the web: my DM message shows one tick when sent and two once the other person
// has opened the conversation, live (no reload).

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, openDm, sendText } = require('./helpers');

async function person(browser, key) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, key);
  await openWorkspace(page);
  return { ctx, page };
}

test('a DM shows sent, then read the moment the other person opens it', async ({ browser }) => {
  test.setTimeout(180_000);
  const t = Date.now();
  const vishnu = await person(browser, 'vishnu');
  const sandeep = await person(browser, 'sandeep');

  await openDm(vishnu.page, 'sandeep');
  await sendText(vishnu.page, `are you there ${t}`);
  const mine = vishnu.page.locator('[id^="msg-"]').filter({ hasText: `are you there ${t}` });
  await expect(mine.getByTestId('receipt-sent')).toBeVisible({ timeout: 30_000 });

  await openDm(sandeep.page, 'vishnu');
  await expect(sandeep.page.locator('[id^="msg-"]').filter({ hasText: `are you there ${t}` })).toBeVisible({ timeout: 30_000 });

  await expect(mine.getByTestId('receipt-read')).toBeVisible({ timeout: 30_000 });

  await Promise.all([vishnu.ctx.close(), sandeep.ctx.close()]);
});
