'use strict';

const { test, expect } = require('@playwright/test');

test('the public status page reports live checks, not canned numbers', async ({ page }) => {
  await page.goto('/status');
  await expect(page.getByTestId('status-summary')).toHaveText('All Systems Operational', { timeout: 20_000 });
  for (const key of ['api', 'database', 'realtime']) {
    await expect(page.getByTestId(`status-${key}`)).toContainText('Operational');
  }
  await expect(page.getByTestId('status-api')).toContainText(/\d+ms/);
  await expect(page.getByText('30d uptime')).toHaveCount(0);
});
