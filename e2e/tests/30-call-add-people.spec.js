'use strict';

// Adding people to a running call must never drop it: the added person is rung, answers and
// joins (everyone connected to everyone), and someone who declines or doesn't answer leaves the
// call as it was.

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, openDm, waitForComposerReady } = require('./helpers');

const trackPeerConnections = () => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...args) { const pc = new Orig(...args); window.__pcs.push(pc); return pc; };
  window.RTCPeerConnection.prototype = Orig.prototype;
};
const liveCount = (page) => page.evaluate(() => window.__pcs.filter((pc) => pc.connectionState === 'connected').length);
const atLeast = (page, n) => page.waitForFunction((count) => window.__pcs.filter((pc) => pc.connectionState === 'connected').length >= count, n, { timeout: 45_000 });

async function people(browser, keys) {
  const out = {};
  for (const key of keys) {
    const ctx = await browser.newContext({ permissions: ['microphone', 'camera', 'notifications'] });
    await ctx.addInitScript(trackPeerConnections);
    const page = await ctx.newPage();
    await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
      await page.getByRole('button', { name: 'Skip tour' }).click();
    });
    await login(page, key);
    await openWorkspace(page);
    out[key] = { ctx, page };
  }
  return out;
}

async function addToCall(page, name) {
  await page.getByTestId('call-add-people').click();
  const dialog = page.getByRole('dialog', { name: 'Add people to the call' });
  await dialog.getByPlaceholder('Search people').fill(name);
  await dialog.getByRole('listitem').filter({ hasText: name }).first().click();
  await dialog.getByTestId('call-add-confirm').click();
}

test('adding someone to a DM call rings them; they join and nobody is dropped', async ({ browser }) => {
  test.setTimeout(300_000);
  const p = await people(browser, ['alice', 'bob', 'vishnu', 'sandeep']);

  await openDm(p.alice.page, 'bob');
  await waitForComposerReady(p.alice.page);
  await p.alice.page.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  await p.bob.page.getByTestId('incoming-call-accept').click();
  await Promise.all([atLeast(p.alice.page, 1), atLeast(p.bob.page, 1)]);

  // Someone declines being added: the call goes on.
  await addToCall(p.alice.page, 'sandeep');
  await expect(p.sandeep.page.getByTestId('incoming-call')).toBeVisible({ timeout: 30_000 });
  await p.sandeep.page.getByTestId('incoming-call-decline').click();
  await p.alice.page.waitForTimeout(3000);
  await expect(p.alice.page.getByTestId('call-screen')).toBeVisible();
  await expect(p.bob.page.getByTestId('call-screen')).toBeVisible();
  expect(await liveCount(p.alice.page)).toBeGreaterThanOrEqual(1);

  // Someone answers: three people, each connected to the other two.
  await addToCall(p.bob.page, 'vishnu');
  await expect(p.vishnu.page.getByTestId('incoming-call')).toBeVisible({ timeout: 30_000 });
  await p.vishnu.page.getByTestId('incoming-call-accept').click();
  await Promise.all([atLeast(p.alice.page, 2), atLeast(p.bob.page, 2), atLeast(p.vishnu.page, 2)]);

  // Still all there a little later (nobody was hung up by the invite).
  await p.alice.page.waitForTimeout(5000);
  for (const k of ['alice', 'bob', 'vishnu']) {
    await expect(p[k].page.getByTestId('call-screen')).toBeVisible();
    expect(await liveCount(p[k].page)).toBeGreaterThanOrEqual(2);
  }

  // The person added leaves: the original two stay connected.
  await p.vishnu.page.getByTestId('call-screen').getByRole('button', { name: /leave|hang up|end/i }).first().click();
  await p.alice.page.waitForTimeout(3000);
  await expect(p.alice.page.getByTestId('call-screen')).toBeVisible();
  await expect(p.bob.page.getByTestId('call-screen')).toBeVisible();

  for (const k of Object.keys(p)) await p[k].ctx.close();
});
