'use strict';

// The website on a phone runs the phone app's interface (served at /m/). Calls must work there
// like in the Android app: a call from the web rings the phone browser (incoming-call screen),
// answering connects both sides, and the phone browser can call back.

const { test, expect, devices } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm, waitForComposerReady } = require('./helpers');

const trackPeerConnections = () => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...args) { const pc = new Orig(...args); window.__pcs.push(pc); return pc; };
  window.RTCPeerConnection.prototype = Orig.prototype;
};
const connected = (page) => page.waitForFunction(() => window.__pcs.some((pc) => pc.connectionState === 'connected'), null, { timeout: 45_000 });
const chatsTab = (page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Chats/ });

async function phoneSignIn(browser, key) {
  const user = E2E.users[key];
  const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['microphone', 'camera', 'notifications'] });
  await ctx.addInitScript(trackPeerConnections);
  const page = await ctx.newPage();
  await page.goto(E2E.phoneUrl);
  await page.getByTestId('get-started').click();
  await page.getByPlaceholder('name@example.com').fill(user.email);
  await page.getByTestId('email-continue').click();
  await page.getByLabel('Password', { exact: true }).fill(E2E.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText(E2E.workspaceName).first().click();
  await expect(chatsTab(page)).toBeVisible({ timeout: 30_000 });
  return { ctx, page };
}

async function webSignIn(browser, key) {
  const ctx = await browser.newContext({ permissions: ['microphone', 'camera', 'notifications'] });
  await ctx.addInitScript(trackPeerConnections);
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, key);
  await openWorkspace(page);
  return { ctx, page };
}

test('a web call rings the phone browser, which answers and connects', async ({ browser }) => {
  test.setTimeout(240_000);
  const phone = await phoneSignIn(browser, 'sandeep');
  const web = await webSignIn(browser, 'vishnu');

  await openDm(web.page, 'sandeep');
  await waitForComposerReady(web.page);
  await web.page.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  await expect(web.page.getByTestId('call-screen')).toBeVisible();

  // The phone browser shows the incoming-call screen (with the browser's ringtone) and answers.
  const ring = phone.page.getByTestId('huddle-ring');
  await expect(ring).toBeVisible({ timeout: 30_000 });
  await expect(ring).toContainText('vishnu');
  await phone.page.getByTestId('huddle-ring-join').click();
  await expect(ring).toBeHidden({ timeout: 30_000 });

  await Promise.all([connected(web.page), connected(phone.page)]);

  await Promise.all([phone.ctx.close(), web.ctx.close()]);
});
