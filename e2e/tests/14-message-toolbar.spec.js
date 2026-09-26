'use strict';

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, openDm, waitForComposerReady, sendText } = require('./helpers');

// The per-message "More" menu, exercised in a DM between alice (author) and bob (reader).
// AI endpoints are mocked: the E2E stack runs without a Gemini key.
test.describe('message toolbar', () => {
  let alice, bob, contexts;

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([
      browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] }),
      browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] }),
    ]);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);
    await openDm(alice, 'bob'); await openDm(bob, 'alice');
    await Promise.all([waitForComposerReady(alice), waitForComposerReady(bob)]);
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  const row = (page, text) => page.locator('[id^="msg-"]').filter({ hasText: text });

  async function openMenu(page, text) {
    const msg = row(page, text).first();
    await msg.hover();
    await msg.locator('button[title="More"]').click();
    return page.getByRole('menu');
  }

  async function menu(page, text, label) {
    const m = await openMenu(page, text);
    await m.getByRole('menuitem', { name: label, exact: true }).click();
  }

  test('copy text puts the decrypted message on the clipboard', async () => {
    const text = `copy me ${Date.now()}`;
    await sendText(alice, text);
    await expect(row(bob, text)).toBeVisible();
    await menu(bob, text, 'Copy text');
    await expect(bob.getByText('Copied', { exact: false }).first()).toBeVisible();
    expect(await bob.evaluate(() => navigator.clipboard.readText())).toContain(text);
  });

  test('pin and unpin update the menu and the pinned panel', async () => {
    const text = `pin me ${Date.now()}`;
    await sendText(alice, text);
    await expect(row(bob, text)).toBeVisible();
    await menu(bob, text, 'Pin message');
    await bob.locator('button[title="Pinned messages"]').click();
    const pinned = bob.getByTestId('pinned-panel');
    await expect(pinned.getByText(text)).toBeVisible();
    await pinned.getByLabel('Close pinned messages').click();
    await expect(pinned).toHaveCount(0);
    // The author sees it pinned live, so their menu offers Unpin.
    const m = await openMenu(alice, text);
    await expect(m.getByRole('menuitem', { name: 'Unpin message', exact: true })).toBeVisible();
    await m.getByRole('menuitem', { name: 'Unpin message', exact: true }).click();
    const again = await openMenu(alice, text);
    await expect(again.getByRole('menuitem', { name: 'Pin message', exact: true })).toBeVisible();
    await alice.keyboard.press('Escape');
  });

  test('save toggles to "Remove from saved"', async () => {
    const text = `save me ${Date.now()}`;
    await sendText(alice, text);
    await expect(row(bob, text)).toBeVisible();
    await menu(bob, text, 'Save message');
    await expect(bob.getByText('Saved', { exact: false }).first()).toBeVisible();
    const m = await openMenu(bob, text);
    await expect(m.getByRole('menuitem', { name: 'Remove from saved', exact: true })).toBeVisible();
    await m.getByRole('menuitem', { name: 'Remove from saved', exact: true }).click();
    await expect(bob.getByText('Removed from saved', { exact: false }).first()).toBeVisible();
  });

  test.describe('edit, history and restore', () => {
    const tag = Date.now();
    const original = `deploy on friday ${tag}`;
    const edited = `deploy on monday ${tag}`;

    test('the author edits inline and the reader sees the new text and an edited marker', async () => {
      await sendText(alice, original);
      await expect(row(bob, original)).toBeVisible();
      const readerMenu = await openMenu(bob, original);
      await expect(readerMenu.getByRole('menuitem', { name: 'Edit message', exact: true })).toHaveCount(0);
      await bob.keyboard.press('Escape');

      await menu(alice, original, 'Edit message');
      const editor = row(alice, `${tag}`).locator('[contenteditable="true"], textarea').last();
      await editor.click();
      await alice.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await alice.keyboard.type(edited);
      await alice.keyboard.press('Enter');

      await expect(row(bob, edited)).toBeVisible();
      await expect(row(bob, edited)).toContainText('(edited)');
      await expect(row(alice, edited)).toContainText('(edited)');
    });

    test('the reader can open the history but cannot restore', async () => {
      await menu(bob, edited, 'Edit history');
      const dialog = bob.getByRole('dialog', { name: 'Edit history' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(original)).toBeVisible();
      await expect(dialog.getByText('Original')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Restore this version' })).toHaveCount(0);
      await dialog.getByLabel('Close').click();
      await expect(dialog).toHaveCount(0);
    });

    test('the author restores the original and everyone sees it was restored', async () => {
      await menu(alice, edited, 'Edit history');
      const dialog = alice.getByRole('dialog', { name: 'Edit history' });
      // Restore the oldest version (the original); the dialog refreshes in place.
      await dialog.getByRole('button', { name: 'Restore this version' }).last().click();
      await expect(dialog.getByText(/Restored from v1/)).toBeVisible();
      await expect(dialog.getByText('3 versions')).toBeVisible();
      await dialog.getByLabel('Close').click();
      await expect(dialog).toHaveCount(0);
      await expect(row(alice, original)).toContainText('restored v1');
      await expect(row(bob, original)).toBeVisible();
      await expect(row(bob, original)).toContainText('restored v1');
      // The history keeps every version, including the one that was rolled back.
      await menu(bob, original, 'Edit history');
      const history = bob.getByRole('dialog', { name: 'Edit history' });
      // The diff renders changed words as separate marks, so match on content.
      await expect(history).toContainText('3 versions');
      await expect(history).toContainText('monday');
      await expect(history).toContainText(/Restored from v1/);
      await history.getByLabel('Close').click();
      await expect(history).toHaveCount(0);
    });

    test('message info shows edit count, restore note and read receipts', async () => {
      await menu(bob, original, 'Message info');
      const info = bob.getByRole('dialog', { name: 'Message info' });
      await expect(info).toBeVisible();
      await expect(info.getByText(/Edited/)).toBeVisible();
      await expect(info.getByText(/Restored from/)).toBeVisible();
      await expect(info.getByText(/Read by \(\d+\)/)).toBeVisible();
      await info.getByLabel('Close').click();
      await expect(info).toHaveCount(0);
    });
  });

  test('translate from the menu shows the translation and can show the original', async () => {
    await bob.route('**/api/v2/messages/ai/translate', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ translated: 'Hola equipo', detectedLang: 'en' }),
    }));
    const text = `hello team ${Date.now()}`;
    await sendText(alice, text);
    await expect(row(bob, text)).toBeVisible();
    await menu(bob, text, 'Translate');
    await bob.getByRole('button', { name: /Spanish/ }).click();
    await expect(row(bob, text)).toContainText('Hola equipo');
    await menu(bob, text, 'Show original');
    await expect(row(bob, text)).not.toContainText('Hola equipo');
    await bob.unroute('**/api/v2/messages/ai/translate');
  });

  test('a thread can be summarised from the root message', async () => {
    const root = `thread to summarise ${Date.now()}`;
    await sendText(alice, root);
    await expect(row(bob, root)).toBeVisible();
    const msg = row(bob, root);
    await msg.hover();
    await msg.locator('button[title="Reply in thread"]').click();
    const panel = bob.getByTestId('thread-panel');
    await waitForComposerReady(panel);
    await panel.locator('[contenteditable="true"]').click();
    await bob.keyboard.type('we agreed to ship it');
    await bob.keyboard.press('Enter');
    await expect(panel.getByText('we agreed to ship it')).toBeVisible();
    await panel.getByTitle('Close').click();

    await alice.route('**/api/v2/messages/ai/thread-summary', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ summary: 'The team agreed to ship it.' }),
    }));
    await expect(row(alice, root)).toContainText(/1 repl/);
    await menu(alice, root, 'Summarize thread');
    const summary = alice.getByRole('dialog');
    await expect(summary.getByText('The team agreed to ship it.')).toBeVisible();
    await summary.getByRole('button', { name: /Copy/ }).click();
    await expect(alice.getByText(/Copied/).first()).toBeVisible();
    await summary.getByLabel('Close').click();
    await expect(summary).toHaveCount(0);
    await alice.unroute('**/api/v2/messages/ai/thread-summary');
  });

  test('delete for me hides only my copy; delete for everyone removes it for both', async () => {
    const mine = `hide from me ${Date.now()}`;
    await sendText(alice, mine);
    await expect(row(bob, mine)).toBeVisible();
    await menu(bob, mine, 'Delete for me');
    await expect(row(bob, mine)).toHaveCount(0);
    await expect(row(alice, mine)).toBeVisible();

    const everyone = `gone for all ${Date.now()}`;
    await sendText(alice, everyone);
    await expect(row(bob, everyone)).toBeVisible();
    const readerMenu = await openMenu(bob, everyone);
    await expect(readerMenu.getByRole('menuitem', { name: 'Delete for everyone', exact: true })).toHaveCount(0);
    await bob.keyboard.press('Escape');
    await menu(alice, everyone, 'Delete for everyone');
    await alice.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(alice.getByText(everyone, { exact: true })).toHaveCount(0);
    await expect(bob.getByText(everyone, { exact: true })).toHaveCount(0);
  });
});
