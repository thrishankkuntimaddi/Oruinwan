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

  test('the sign-in page offers Google and email only', async ({ page }) => {
    // The E2E server has a Google client id but no SMS keys.
    const providers = page.waitForResponse((r) => r.url().includes('/api/auth/providers'));
    await page.goto('/login');
    expect(await (await providers).json()).toEqual({ google: true, googleClientId: 'e2e-google-client-id', googleDesktopClientId: null, sms: false });
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: /GitHub|LinkedIn/ })).toHaveCount(0);
  });

  test('creating an account asks for a date of birth, not a phone number', async ({ page }) => {
    await page.goto('/login?mode=signup');
    await expect(page.locator('input[name="dob"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
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

test.describe('company sign-up', () => {
  test('the phone number needs no SMS code when the server cannot send SMS', async ({ page }) => {
    await page.goto('/register-company');
    await page.locator('input[name="companyName"]').fill('Phone Optional Co');
    await page.locator('input[name="companyDomain"]').fill('phone-optional-e2e.test');
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    // Only the email keeps its Verify button: the E2E server has no SMS keys.
    await expect(page.getByRole('button', { name: 'Verify' })).toHaveCount(1);
  });

  // A Gmail address with no account yet is looked up in its canonical form (dots, +tags) too;
  // that lookup once sent invalid SQL, so every new Google user got "Google login failed".
  test('Google sign-in with a new Gmail address offers to create the account', async ({ request }) => {
    const email = `New.Person+${Date.now()}@gmail.com`;
    const res = await request.post(`${E2E.apiUrl}/api/auth/google-login`, { data: { accessToken: `e2e-google:${email}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.needsSignup).toBe(true);
    expect(body.email).toBe(email);
    expect(body.signupToken).toBeTruthy();
  });
});
