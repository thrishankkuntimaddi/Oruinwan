'use strict';

// A workspace has a profile beyond its icon and colour: an admin uploads a logo and a cover and
// writes a tagline, website and location; every member sees them, and a plain member can't change them.

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login } = require('./helpers');

// A 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function signIn(browser, key) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, key);
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  const headers = { Authorization: `Bearer ${token}` };
  return { ctx, page, headers };
}

test('an admin sets the workspace profile and members see it', async ({ browser }) => {
  const ws = seedData().workspaceId;
  const admin = await signIn(browser, 'thrishank'); // workspace admin
  const member = await signIn(browser, 'bob');

  const logo = await admin.page.request.post(`${E2E.apiUrl}/api/workspaces/${ws}/profile/logo`, {
    headers: admin.headers, multipart: { image: { name: 'logo.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(logo.status(), await logo.text()).toBe(200);
  expect((await logo.json()).profile.logoUrl).toMatch(/workspace-profiles/);

  const text = await admin.page.request.put(`${E2E.apiUrl}/api/workspaces/${ws}`, {
    headers: admin.headers, data: { profile: { tagline: 'Where the team ships', website: 'poelys.com', location: 'Hyderabad' } },
  });
  expect(text.status(), await text.text()).toBe(200);

  // Members see it in their workspace list, and the logo is readable by link.
  const list = await member.page.request.get(`${E2E.apiUrl}/api/workspaces/my`, { headers: member.headers });
  const mine = (await list.json()).workspaces.find((w) => String(w.id) === ws);
  expect(mine.profile).toMatchObject({ tagline: 'Where the team ships', website: 'https://poelys.com/', location: 'Hyderabad' });
  const image = await member.page.request.get(`${E2E.apiUrl}${mine.profile.logoUrl}`);
  expect(image.status()).toBe(200);

  // A member can't change it; an SVG is refused.
  const refused = await member.page.request.put(`${E2E.apiUrl}/api/workspaces/${ws}`, { headers: member.headers, data: { profile: { tagline: 'mine now' } } });
  expect(refused.status()).toBe(403);
  const svg = await admin.page.request.post(`${E2E.apiUrl}/api/workspaces/${ws}/profile/cover`, {
    headers: admin.headers, multipart: { image: { name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') } },
  });
  expect(svg.status()).toBe(400);

  // Removing the logo brings the icon back.
  const removed = await admin.page.request.delete(`${E2E.apiUrl}/api/workspaces/${ws}/profile/logo`, { headers: admin.headers });
  expect((await removed.json()).profile.logoUrl).toBeNull();
  await admin.page.request.put(`${E2E.apiUrl}/api/workspaces/${ws}`, { headers: admin.headers, data: { profile: { tagline: '', website: '', location: '' } } });

  await Promise.all([admin.ctx.close(), member.ctx.close()]);
});
