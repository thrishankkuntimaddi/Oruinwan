'use strict';

// Share / copy: a message's link and a whole thread as text, built in the browser from the
// decrypted messages (nothing is uploaded), read back from the clipboard.
const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm, sendText, waitForComposerReady } = require('./helpers');

const readClipboard = (page) => page.evaluate(() => navigator.clipboard.readText());

test.describe('share a message and a thread', () => {
  let page, context;
  const root = `share root ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    page = await context.newPage();
    // No share sheet in this browser: "Share…" copies instead (and the test can read it).
    await page.addInitScript(() => { try { delete Navigator.prototype.share; } catch { /* none */ } });
    await login(page, 'alice');
    await openWorkspace(page);
    await openDm(page, 'bob');
    await sendText(page, root);
  });
  test.afterAll(async () => { await context.close(); });

  test('Copy link and Share… on a message', async () => {
    const msg = page.locator('[id^="msg-"]').filter({ hasText: root });
    await msg.hover();
    await msg.locator('button[title="More"]').first().click();
    await page.getByRole('menuitem', { name: 'Copy link' }).click();
    const link = await readClipboard(page);
    expect(link).toMatch(new RegExp(`^${E2E.webUrl}/workspace/[^/]+/dm/[^/?]+\\?message=[^&]+$`));

    await msg.hover();
    await msg.locator('button[title="More"]').first().click();
    await page.getByRole('menuitem', { name: 'Share…' }).click();
    const shared = await readClipboard(page);
    expect(shared).toContain(`alice: ${root}`);
    expect(shared).toContain(link);
  });

  test('Copy thread copies a transcript with every reply and a link', async () => {
    const msg = page.locator('[id^="msg-"]').filter({ hasText: root });
    await msg.hover();
    await msg.locator('button[title="Reply in thread"]').click();
    const panel = page.getByTestId('thread-panel');
    await expect(panel).toBeVisible();
    await waitForComposerReady(panel);
    await panel.locator('[contenteditable="true"]').click();
    await page.keyboard.type('a reply to share');
    await page.keyboard.press('Enter');
    await expect(panel.getByText('a reply to share')).toBeVisible();

    await panel.getByTestId('thread-share').click();
    await page.getByRole('menuitem', { name: 'Copy thread' }).click();
    const transcript = await readClipboard(page);
    const lines = transcript.split('\n');
    expect(lines[0]).toBe('Thread with bob');
    expect(transcript).toMatch(new RegExp(`\\[[^\\]]+\\] alice: ${root}`));
    expect(transcript).toMatch(/\[[^\]]+\] alice: a reply to share/);
    expect(lines[lines.length - 1]).toMatch(new RegExp(`^${E2E.webUrl}/workspace/[^/]+/dm/[^/?]+\\?thread=`));

    // The link opens the thread.
    await panel.getByTestId('thread-share').click();
    await page.getByRole('menuitem', { name: 'Copy link to thread' }).click();
    const threadUrl = await readClipboard(page);
    await page.goto(threadUrl);
    await expect(page.getByTestId('thread-panel').getByText('a reply to share')).toBeVisible();
  });
});
