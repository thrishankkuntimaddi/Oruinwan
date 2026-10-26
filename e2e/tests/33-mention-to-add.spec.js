'use strict';

// Slack-like mentions in channels: anyone in the workspace can be @mentioned; mentioning someone
// who isn't in the channel offers "Add to channel", and they join (and read the history).

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, openWorkspace, waitForComposerReady, withDb } = require('./helpers');

const token = (page) => page.evaluate(() => localStorage.getItem('accessToken'));
const spaNavigate = (page, p) => page.evaluate((to) => {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, p);

let made = null;
test.afterAll(async () => {
  if (!made) return;
  const { ObjectId } = require(require.resolve('mongodb', { paths: [require('path').join(__dirname, '..', '..', 'server')] }));
  await withDb((db) => db.collection('channels').deleteOne({ _id: new ObjectId(made) }));
});

test('mentioning someone outside the channel offers to add them', async ({ browser }) => {
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

  const created = await page.request.post(`${E2E.apiUrl}/api/channels`, {
    data: { name: `mentions-${t}`, workspaceId: ws, memberIds: [seedData().users.vishnu.id] },
    headers: { Authorization: `Bearer ${await token(page)}` },
  });
  const body = await created.json();
  made = String(body.channel?._id || body.channel?.id || body._id || body.id);

  // The channel list on this page learns about the new channel on navigation.
  await page.reload();
  await spaNavigate(page, `/workspace/${ws}/channel/${made}`);
  await waitForComposerReady(page);
  const composer = page.locator('[contenteditable="true"]').last();
  await composer.click();
  await page.keyboard.type(`welcome @sandeep he is new ${t}`);
  await page.keyboard.press('Escape'); // close the suggestions, keep the text
  await composer.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');

  const bar = page.getByTestId('mention-invite');
  await expect(bar).toBeVisible({ timeout: 30_000 });
  await expect(bar).toContainText("@sandeep isn't in");
  await page.getByTestId('mention-invite-add').click();
  await expect(bar).toBeHidden({ timeout: 30_000 });

  const channel = await page.request.get(`${E2E.apiUrl}/api/channels/${made}/members`, { headers: { Authorization: `Bearer ${await token(page)}` } });
  const members = JSON.stringify(await channel.json());
  expect(members).toContain(seedData().users.sandeep.id);

  await ctx.close();
});

test('mentioning someone else in a 1:1 DM offers a group with the three of you', async ({ browser }) => {
  test.setTimeout(180_000);
  const t = Date.now();
  const { openDm, sendText } = require('./helpers');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, 'vishnu');
  await openWorkspace(page);
  await openDm(page, 'manogna');
  const firstUrl = page.url();
  await sendText(page, `let's ask @sandeep about it ${t}`);

  const offer = page.getByTestId('group-offer');
  await expect(offer).toBeVisible({ timeout: 30_000 });
  await expect(offer).toContainText("@sandeep isn't in this chat");
  await page.getByTestId('group-offer-start').click();
  await page.waitForURL((u) => /\/dm\/[a-f0-9]{24}/.test(String(u)) && String(u) !== firstUrl, { timeout: 30_000 });

  // The new conversation is a group of exactly the three of us.
  const dmId = page.url().match(/\/dm\/([a-f0-9]{24})/)[1];
  const details = await page.request.get(`${E2E.apiUrl}/api/v2/dm/${dmId}`, { headers: { Authorization: `Bearer ${await token(page)}` } });
  const dm = (await details.json()).dm;
  expect(dm.isGroup).toBe(true);
  const ids = (dm.members || dm.participants || []).map((m) => String(m._id || m.id || m)).sort();
  expect(ids).toEqual([seedData().users.vishnu.id, seedData().users.manogna.id, seedData().users.sandeep.id].sort());
  await ctx.close();
});
