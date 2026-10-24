'use strict';

// Channels work for everyone, not only the owner: a member creates a channel and the others in it
// write and read; the owner creates one for members, including one who had never signed in when
// it was made (they get the key on first open and can write straight away).

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, openWorkspace, sendText, waitForComposerReady } = require('./helpers');

const token = (page) => page.evaluate(() => localStorage.getItem('accessToken'));
const message = (page, text) => page.locator('[id^="msg-"]').filter({ hasText: text });
const spaNavigate = (page, path) => page.evaluate((p) => {
  window.history.pushState({}, '', p);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, path);

async function signIn(browser, key) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, key);
  await openWorkspace(page);
  return { ctx, page };
}

async function createChannel(page, name, memberKeys) {
  const res = await page.request.post(`${E2E.apiUrl}/api/channels`, {
    data: { name, workspaceId: seedData().workspaceId, memberIds: memberKeys.map((k) => seedData().users[k].id) },
    headers: { Authorization: `Bearer ${await token(page)}` },
  });
  expect(res.status(), await res.text()).toBeLessThan(300);
  const body = await res.json();
  return String(body.channel?._id || body.channel?.id || body._id || body.id);
}

async function openChannel(page, channelId) {
  await spaNavigate(page, `/workspace/${seedData().workspaceId}/channel/${channelId}`);
  await page.waitForURL(new RegExp(`/channel/${channelId}`), { timeout: 30_000 });
  await waitForComposerReady(page);
}

test('members create channels and message in them; the owner\'s channels work for members too', async ({ browser }) => {
  test.setTimeout(300_000);
  const t = Date.now();
  const vishnu = await signIn(browser, 'vishnu');
  const sandeep = await signIn(browser, 'sandeep');

  // A member's channel: both members write, both read.
  const memberChannel = await createChannel(vishnu.page, `members-${t}`, ['sandeep']);
  await openChannel(vishnu.page, memberChannel);
  await sendText(vishnu.page, `vishnu in his channel ${t}`);
  await openChannel(sandeep.page, memberChannel);
  await expect(message(sandeep.page, `vishnu in his channel ${t}`)).toBeVisible({ timeout: 30_000 });
  await sendText(sandeep.page, `sandeep answers ${t}`);
  await expect(message(vishnu.page, `sandeep answers ${t}`)).toBeVisible({ timeout: 30_000 });

  // The owner's channel for two members, one of whom (manogna) has never signed in on the web.
  const alice = await signIn(browser, 'alice');
  const ownerChannel = await createChannel(alice.page, `team-${t}`, ['vishnu', 'manogna']);
  await openChannel(alice.page, ownerChannel);
  await sendText(alice.page, `owner hello ${t}`);
  await openChannel(vishnu.page, ownerChannel);
  await expect(message(vishnu.page, `owner hello ${t}`)).toBeVisible({ timeout: 30_000 });
  await sendText(vishnu.page, `member reply ${t}`);
  await expect(message(alice.page, `member reply ${t}`)).toBeVisible({ timeout: 30_000 });

  const manogna = await signIn(browser, 'manogna');
  await openChannel(manogna.page, ownerChannel);
  await expect(message(manogna.page, `owner hello ${t}`)).toBeVisible({ timeout: 30_000 });
  await expect(message(manogna.page, `member reply ${t}`)).toBeVisible({ timeout: 30_000 });
  await sendText(manogna.page, `late member writes ${t}`);
  await expect(message(vishnu.page, `late member writes ${t}`)).toBeVisible({ timeout: 30_000 });
  await expect(manogna.page.getByText(/encryption key is not (ready|available)/i)).toHaveCount(0);

  await Promise.all([vishnu, sandeep, alice, manogna].map((s) => s.ctx.close()));
});
