const { test } = require('@playwright/test');
const { login, openWorkspace } = require('./helpers');
test('avatar screenshots', async ({ browser }) => {
  for (const [me, other] of [['alice', 'bob'], ['bob', 'alice']]) {
    const page = await (await browser.newContext()).newPage();
    await login(page, me); await openWorkspace(page);
    await page.locator('[title="Add Direct Messages"]').first().click();
    await page.getByPlaceholder('Search by name or email…').fill(other);
    await page.getByText(other, { exact: true }).last().click();
    await page.waitForURL(/\/dm\/[a-f0-9]{24}/);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `.auth/messages-panel-${me}.png`, clip: { x: 0, y: 0, width: 700, height: 320 } });
    await page.getByRole('button', { name: 'Home' }).first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `.auth/home-panel-${me}.png`, clip: { x: 0, y: 0, width: 700, height: 500 } });
  }
});
