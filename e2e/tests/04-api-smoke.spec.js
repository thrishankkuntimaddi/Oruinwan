'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, seedData } = require('./helpers');

// Endpoints behind the module registry and the release flags, called with a real session.
test('module endpoints respond for a signed-in user', async ({ page }) => {
  await login(page, 'alice');
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  const get = (p) => page.request.get(`${E2E.apiUrl}${p}`, { headers: { Authorization: `Bearer ${token}` } });

  const notifications = await get(`/api/notifications?workspaceId=${seedData().workspaceId}`);
  expect(notifications.status()).toBe(200);
  expect((await get('/api/notifications')).status()).toBe(400);

  const ice = await get('/api/v2/huddles/ice-servers');
  expect(ice.status()).toBe(200);
  const iceBody = await ice.json();
  expect(iceBody.iceServers.length).toBeGreaterThan(0);
  expect(iceBody.turn).toBe(false); // no TURN configured in the test stack

  const flags = await (await get('/api/flags')).json();
  expect(flags.flags).toEqual({ billing: false, sso: false, integrations: false, community: false });

  const sso = await get('/api/auth/sso/google');
  expect(sso.status()).toBe(404);
});
