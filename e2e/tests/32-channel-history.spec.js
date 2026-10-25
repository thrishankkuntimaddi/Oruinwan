'use strict';

// Someone who joins a channel reads everything said there before they joined (Slack-like),
// decrypted, including threads.

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, openWorkspace, sendText, waitForComposerReady, withDb } = require('./helpers');

const token = (page) => page.evaluate(() => localStorage.getItem('accessToken'));
const spaNavigate = (page, p) => page.evaluate((to) => {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, p);

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

let made = null;
test.afterAll(async () => {
  if (!made) return;
  const { ObjectId } = require(require.resolve('mongodb', { paths: [require('path').join(__dirname, '..', '..', 'server')] }));
  await withDb((db) => db.collection('channels').deleteOne({ _id: new ObjectId(made) }));
});

test('a new channel member sees the messages from before they joined', async ({ browser }) => {
  test.setTimeout(240_000);
  const t = Date.now();
  const ws = seedData().workspaceId;
  const alice = await person(browser, 'alice');

  const created = await alice.page.request.post(`${E2E.apiUrl}/api/channels`, {
    data: { name: `history-${t}`, workspaceId: ws, memberIds: [seedData().users.vishnu.id] },
    headers: { Authorization: `Bearer ${await token(alice.page)}` },
  });
  expect(created.status(), await created.text()).toBeLessThan(300);
  const body = await created.json();
  made = String(body.channel?._id || body.channel?.id || body._id || body.id);

  await spaNavigate(alice.page, `/workspace/${ws}/channel/${made}`);
  await waitForComposerReady(alice.page);
  await sendText(alice.page, `before you joined ${t}`);

  // Sandeep is added afterwards, then opens the channel.
  const added = await alice.page.request.post(`${E2E.apiUrl}/api/channels/${made}/invite`, {
    data: { userId: seedData().users.sandeep.id },
    headers: { Authorization: `Bearer ${await token(alice.page)}` },
  });
  expect(added.status(), await added.text()).toBe(200);

  const sandeep = await person(browser, 'sandeep');
  await spaNavigate(sandeep.page, `/workspace/${ws}/channel/${made}`);
  await waitForComposerReady(sandeep.page);
  await expect(sandeep.page.locator('[id^="msg-"]').filter({ hasText: `before you joined ${t}` })).toBeVisible({ timeout: 45_000 });

  await Promise.all([alice.ctx.close(), sandeep.ctx.close()]);
});
