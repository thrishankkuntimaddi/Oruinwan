'use strict';

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, withDb, seedData } = require('./helpers');

function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

test.describe('tasks', () => {
  test('a user creates a task and it is saved and listed', async ({ page }) => {
    const title = `E2E task ${Date.now()}`;

    await login(page, 'alice');
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Tasks' }).first().click();
    await page.waitForURL(/\/workspace\/[a-f0-9]{24}\/tasks/);

    await page.getByRole('button', { name: /^Create$/ }).first().click();
    await page.getByPlaceholder('Task title…').fill(title);

    const channel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select channel' }) });
    const firstChannel = await channel.locator('option').nth(1).getAttribute('value');
    await channel.selectOption(firstChannel);
    await page.locator('input[type="date"]').first().fill(isoDate(3));

    const created = page.waitForResponse((r) => r.url().includes('/api/v2/tasks') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create Task' }).click();
    expect((await created).status()).toBeLessThan(300);

    await expect(page.getByText(title).first()).toBeVisible();

    const saved = await withDb((db) => db.collection('tasks').findOne({ title }));
    expect(saved).toBeTruthy();
    expect(String(saved.workspace)).toBe(seedData().workspaceId);
  });
});
