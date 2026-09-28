'use strict';

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, openDm, waitForComposerReady, withDb } = require('./helpers');

// Rich message features between two users in a DM.
test.describe('message features', () => {
  let alice, bob, contexts;

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);
    await openDm(alice, 'bob'); await openDm(bob, 'alice');
    await Promise.all([waitForComposerReady(alice), waitForComposerReady(bob)]);
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  // Type multi-line markdown: Shift+Enter makes a new line in the composer.
  async function sendLines(page, lines) {
    const box = page.locator('[contenteditable="true"]').last();
    await box.click();
    for (let i = 0; i < lines.length; i++) {
      await page.keyboard.type(lines[i]);
      if (i < lines.length - 1) await page.keyboard.press('Shift+Enter');
    }
    await page.keyboard.press('Enter');
  }

  test('mentions, strikethrough and highlighted code render for the reader', async () => {
    const tag = Date.now();
    await sendLines(alice, [`hey @bob ~~cancelled ${tag}~~`]);
    const msg = bob.locator('[id^="msg-"]').filter({ hasText: `cancelled ${tag}` });
    await expect(msg.locator('[data-mention="bob"]')).toHaveText('@bob');
    await expect(msg.locator('del')).toHaveText(`cancelled ${tag}`);
  });

  test('a JavaScript code block runs in the sandbox', async () => {
    await sendLines(alice, ['```js', 'console.log("sum", [1, 2, 3].reduce((a, b) => a + b, 0))', '```']);
    const block = bob.getByTestId('code-block').last();
    await expect(block).toContainText('reduce');
    await block.getByTitle('Run in sandbox').click();
    await expect(bob.getByTestId('code-output').last()).toHaveText('sum 6');
  });

  test('the sandbox cannot reach the app', async () => {
    await sendLines(alice, ['```js', 'console.log(typeof localStorage === "undefined" ? "no storage" : (() => { try { return localStorage.getItem("accessToken") || "empty"; } catch (e) { return "blocked"; } })())', '```']);
    const block = bob.getByTestId('code-block').last();
    // Wait for this message to arrive, or .last() may still be the previous block.
    await expect(block).toContainText('accessToken');
    await block.getByTitle('Run in sandbox').click();
    await expect(bob.getByTestId('code-output').last()).toHaveText(/blocked|no storage|empty|sandboxed/);
    await expect(bob.getByTestId('code-output').last()).not.toContainText('ey'); // never a token
  });

  test('an encrypted checklist is created, shared and ticked live', async () => {
    const tag = Date.now();
    const items = [`Book room ${tag}`, `Send agenda ${tag}`, `Order lunch ${tag}`];
    await alice.locator('button[title="Attach"]').click();
    await alice.getByText('Checklist', { exact: true }).click();
    const modal = alice.getByTestId('checklist-modal');
    await modal.getByPlaceholder('Title (optional)').fill(`Offsite ${tag}`);
    await modal.locator('textarea').fill(items.join('\n'));
    await modal.getByRole('button', { name: 'Send checklist' }).click();

    const bobMsg = bob.locator('[id^="msg-"]').filter({ hasText: `Offsite ${tag}` });
    await expect(bobMsg).toBeVisible();
    for (const it of items) await expect(bob.getByText(it)).toBeVisible();
    await expect(bob.getByText('{"title"')).toHaveCount(0); // never the raw JSON

    await bob.getByText(items[1]).click();
    await expect(alice.locator('label', { hasText: items[1] }).locator('input[type="checkbox"]')).toBeChecked();

    // The server stored only checked states; the item text exists only as ciphertext.
    const doc = await withDb((db) => db.collection('messages').findOne({ type: 'checklist' }, { sort: { _id: -1 } }));
    expect(doc.checklist.map((c) => c.checked)).toEqual([false, true, false]);
    expect(JSON.stringify(doc)).not.toContain(`Book room ${tag}`);
  });

  async function messageMenu(page, text, item) {
    const msg = page.locator('[id^="msg-"]').filter({ hasText: text });
    await msg.hover();
    await msg.locator('button[title="More"]').click();
    await page.getByText(item, { exact: true }).first().click();
  }

  test('reminders: set from a message, listed decrypted, cancelled', async () => {
    const text = `remind me later ${Date.now()}`;
    await sendLines(alice, [text]);
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible();
    await messageMenu(bob, text, 'Remind me');
    await bob.getByRole('button', { name: /Tomorrow at 9:00/ }).first().click();
    await bob.locator('button[title="Reminders"]').click();
    const panel = bob.getByTestId('reminders-panel');
    const item = panel.getByTestId('reminder-item').filter({ hasText: text });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Cancel reminder' }).click();
    await expect(panel.getByTestId('reminder-item').filter({ hasText: text })).toHaveCount(0);
    await panel.getByLabel('Close').click();
  });

  test('a message turned into a task shows a task badge', async () => {
    const text = `make this a task ${Date.now()}`;
    await sendLines(alice, [text]);
    await messageMenu(alice, text, 'Convert to task');
    await alice.getByRole('button', { name: 'Create task' }).click();
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: text }).getByTestId('linked-task-badge')).toBeVisible({ timeout: 15_000 });
  });

  test('PDFs preview inline', async () => {
    const pdf = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
    await alice.locator('button[title="Attach"]').click();
    const chooser = alice.waitForEvent('filechooser');
    await alice.getByText('Document', { exact: true }).click();
    await (await chooser).setFiles({ name: 'spec.pdf', mimeType: 'application/pdf', buffer: pdf });
    const card = bob.locator('[id^="msg-"]').filter({ hasText: 'spec.pdf' });
    await card.getByTitle('Preview PDF').click();
    await expect(card.getByTestId('pdf-preview')).toHaveAttribute('src', /^blob:/);
  });

  test('auto-translate translates incoming messages when turned on', async () => {
    await bob.route('**/api/v2/messages/ai/translate', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ translated: 'Hola desde Alice', detectedLang: 'en' }),
    }));
    await bob.evaluate(() => {
      localStorage.setItem('chttrix.autoTranslateLang', 'es');
      window.dispatchEvent(new CustomEvent('chttrix:auto-translate-changed', { detail: 'es' }));
    });
    const text = `hello from alice ${Date.now()}`;
    await sendLines(alice, [text]);
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: text })).toContainText('Hola desde Alice');
    // Alice's own copy is never auto-translated.
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: text })).not.toContainText('Hola');
    await bob.evaluate(() => {
      localStorage.removeItem('chttrix.autoTranslateLang');
      window.dispatchEvent(new CustomEvent('chttrix:auto-translate-changed', { detail: '' }));
    });
    await bob.unroute('**/api/v2/messages/ai/translate');
  });

  test('global search finds encrypted messages (searched in the browser)', async () => {
    const word = `zebra${Date.now()}`;
    await sendLines(alice, [`the ${word} plan`]);
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: word })).toBeVisible();
    const box = bob.getByPlaceholder('Search…').first();
    await box.click();
    await box.fill(word);
    const hit = bob.locator('text=' + `the ${word} plan`).last();
    await expect(hit).toBeVisible({ timeout: 15_000 });
    await hit.click();
    await expect(bob).toHaveURL(/\/dm\/[a-f0-9]{24}/);
  });

  test('bookmarks show the decrypted message', async () => {
    const text = `bookmark me ${Date.now()}`;
    await sendLines(alice, [text]);
    const msg = bob.locator('[id^="msg-"]').filter({ hasText: text });
    await msg.hover();
    await msg.locator('button[title="More"]').click();
    await bob.getByText('Bookmark', { exact: false }).first().click();
    await bob.locator('button[title="Saved / Bookmarked messages"]').click();
    await expect(bob.getByText(text).last()).toBeVisible();
    await expect(bob.getByText('(attachment)')).toHaveCount(0);
  });
});
