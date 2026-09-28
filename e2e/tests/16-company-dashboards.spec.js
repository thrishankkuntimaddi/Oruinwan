'use strict';

/**
 * Company consoles (Owner / Admin / Manager): each role reaches its own
 * console with real data, cannot reach the ones above it, and the API gates
 * agree with the UI.
 */

const { test, expect } = require('@playwright/test');
const { E2E } = require('./helpers');
const { seedCompany, COMPANY } = require('../scripts/seed-company');

let seeded;

async function companyLogin(page, key) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(COMPANY.users[key].email);
  await page.locator('input[name="password"]').fill(COMPANY.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

/**
 * page.goto reloads the app; accounts with password-protected keys then show
 * "Unlock Encryption" (see helpers.login). Unlock it the way a user would.
 */
async function gotoUnlocked(page, path) {
  await page.goto(path);
  const dialog = page.locator('[aria-labelledby="unlock-modal-title"]');
  const shown = await dialog.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
  if (shown) {
    await dialog.getByPlaceholder('Enter your password').fill(COMPANY.password);
    await dialog.getByRole('button', { name: 'Unlock Encryption' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
  }
}

async function apiAs(request, key) {
  const res = await request.post(`${E2E.apiUrl}/api/auth/login`, { data: { email: COMPANY.users[key].email, password: COMPANY.password } });
  expect(res.ok()).toBeTruthy();
  const { accessToken } = await res.json();
  return {
    get: (p) => request.get(`${E2E.apiUrl}${p}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  };
}

const pageTitle = (page) => page.locator('h1.gl-page-title').first();
const nav = (page) => page.locator('aside.cd-side');

test.describe('company dashboards', () => {
  test.beforeAll(async () => { seeded = await seedCompany(); });

  test('owner console: grouped nav, real headcount, console switch', async ({ page }) => {
    await companyLogin(page, 'owner');
    await gotoUnlocked(page, '/owner/dashboard');
    await expect(nav(page).getByText('Owner console')).toBeVisible();
    for (const label of ['Dashboard', 'Admins', 'People', 'Departments', 'Audit logs']) {
      await expect(nav(page).getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(pageTitle(page)).toBeVisible();
    await expect(page.getByText('Something went wrong')).toHaveCount(0);

    await nav(page).getByRole('link', { name: 'People', exact: true }).click();
    await expect(page).toHaveURL(/\/owner\/users$/);
    await expect(page.getByText(COMPANY.users.designer.email).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Admin', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(nav(page).getByText('Admin console')).toBeVisible();
  });

  test('admin console loads and owner-only pages are refused', async ({ page }) => {
    await companyLogin(page, 'admin');
    await gotoUnlocked(page, '/admin/departments');
    await expect(pageTitle(page)).toBeVisible();
    await expect(page.getByText('Engineering').first()).toBeVisible();
    await gotoUnlocked(page, '/owner/dashboard');
    await expect(page).toHaveURL(/\/workspaces/);
  });

  test('manager console is scoped to the managed department', async ({ page }) => {
    await companyLogin(page, 'manager');
    await gotoUnlocked(page, '/manager/dashboard/overview');
    await expect(nav(page).getByText('Manager console')).toBeVisible();
    await expect(page.getByText('Engineering').first()).toBeVisible();
    await expect(page.getByText('No department', { exact: false })).toHaveCount(0);
    await gotoUnlocked(page, '/admin/dashboard');
    await expect(page).toHaveURL(/\/workspaces/);
  });

  test('members are kept out of every console', async ({ page }) => {
    await companyLogin(page, 'dev');
    for (const path of ['/owner/dashboard', '/admin/dashboard', '/manager/dashboard/overview']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/workspaces/);
    }
  });

  test('the API gates match the roles', async ({ request }) => {
    const [owner, admin, manager, dev] = await Promise.all(['owner', 'admin', 'manager', 'dev'].map((k) => apiAs(request, k)));
    const eng = seeded.departments.Engineering;
    const design = seeded.departments.Design;

    expect((await owner.get('/api/owner-dashboard/overview')).status()).toBe(200);
    expect((await admin.get('/api/owner-dashboard/overview')).status()).toBe(403);
    expect((await admin.get('/api/admin-dashboard/users-access')).status()).toBe(200);
    expect((await manager.get('/api/admin-dashboard/users-access')).status()).toBe(403);

    expect((await manager.get(`/api/manager/dashboard/metrics/${eng}`)).status()).toBe(200);
    expect((await manager.get(`/api/manager/dashboard/metrics/${design}`)).status()).toBe(403);
    expect((await dev.get(`/api/manager/dashboard/metrics/${eng}`)).status()).toBe(403);
    expect((await dev.get('/api/managers/tasks')).status()).toBe(403);

    expect((await dev.get(`/api/companies/${seeded.companyId}/metrics`)).status()).toBe(403);
  });
});
