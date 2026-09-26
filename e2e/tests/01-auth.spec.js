'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace } = require('./helpers');

test.describe('sign in', () => {
  test('a user signs in with email and password and reaches their workspace', async ({ page }) => {
    await login(page, 'alice');
    await expect(page.getByText(E2E.workspaceName).first()).toBeVisible();
    await openWorkspace(page);
    await expect(page).toHaveURL(/\/workspace\/[a-f0-9]{24}\/home/);
  });

  test('a wrong password is rejected with an error and no navigation', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(E2E.users.bob.email);
    await page.locator('input[name="password"]').fill('not-the-password');
    const response = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
    await page.locator('button[type="submit"]').click();
    expect((await response).status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/login/);
  });
});
