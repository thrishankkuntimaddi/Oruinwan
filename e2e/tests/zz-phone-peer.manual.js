'use strict';

// Manual helper (not part of the suite: the name doesn't end in .spec.js). Bob signs in on the
// web, waits for a call from the phone, accepts it and stays on the call for 40 seconds.
const { test, expect } = require('@playwright/test');
const { login, openWorkspace } = require('./helpers');

test('bob answers a call from the phone', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ permissions: ['microphone', 'camera', 'notifications'] });
  const bob = await ctx.newPage();
  await login(bob, 'bob');
  await openWorkspace(bob);
  console.log('BOB READY');
  const ring = bob.getByTestId('incoming-call');
  await expect(ring).toBeVisible({ timeout: 180_000 });
  console.log('BOB RINGING:', (await ring.innerText()).replace(/\s+/g, ' '));
  await bob.getByTestId('incoming-call-accept').click();
  await expect(bob.getByTestId('call-screen')).toContainText('2 participants', { timeout: 30_000 });
  console.log('BOB IN CALL WITH 2 PARTICIPANTS');
  await bob.waitForTimeout(15_000);
  await bob.getByTestId('call-screen').getByTitle('Leave huddle').click();
  console.log('BOB LEFT');
  await ctx.close();
});
