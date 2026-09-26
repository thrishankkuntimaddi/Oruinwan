'use strict';

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, openDm, waitForComposerReady } = require('./helpers');

// 8x8 red PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEVHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');

test.describe('composer', () => {
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

  const composer = (page) => page.locator('[contenteditable="true"]').last();

  test('emoji picker inserts into the message and it sends', async () => {
    await composer(alice).click();
    await alice.keyboard.type('party ');
    await alice.locator('button[title="Emoji"]').click();
    await alice.getByRole('button', { name: '🎉' }).click();
    await expect(composer(alice)).toContainText('party 🎉');
    await alice.keyboard.press('Enter');
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: 'party 🎉' })).toBeVisible();
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: 'party 🎉' })).toBeVisible();
  });

  test('photo upload shows an inline image for both people', async () => {
    await alice.locator('button[title="Attach"]').click();
    const chooser = alice.waitForEvent('filechooser');
    await alice.getByText('Photo', { exact: true }).click();
    await (await chooser).setFiles({ name: 'red.png', mimeType: 'image/png', buffer: PNG });
    const loaded = (page) => page.waitForFunction(() => [...document.querySelectorAll('[id^="msg-"] img')]
      .some((img) => img.src.includes('/api/v2/uploads/file') && img.naturalWidth > 0), null, { timeout: 20_000 });
    await Promise.all([loaded(alice), loaded(bob)]);
  });

  test('document upload shows a file card', async () => {
    await alice.locator('button[title="Attach"]').click();
    const chooser = alice.waitForEvent('filechooser');
    await alice.getByText('Document', { exact: true }).click();
    await (await chooser).setFiles({ name: 'meeting-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('agenda') });
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: 'meeting-notes.txt' })).toBeVisible();
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: 'meeting-notes.txt' })).toBeVisible();
  });

  test('voice message records, sends and plays back', async () => {
    const before = await bob.locator('[id^="msg-"] audio').count();
    await alice.locator('button[title="Voice note"]').click();
    await alice.locator('button[title="Start recording"]').click();
    await alice.waitForTimeout(1500);
    await alice.locator('button[title="Stop recording"]').click();
    await alice.locator('button[title="Send voice message"]').click();
    await expect(bob.locator('[id^="msg-"] audio')).toHaveCount(before + 1, { timeout: 20_000 });
    await expect(alice.locator('button[title="Send voice message"]')).toHaveCount(0);
  });

  test('bold formatting is sent as bold', async () => {
    const text = `strong words ${Date.now()}`;
    await composer(alice).click();
    await alice.locator('button[title="Bold"]').click();
    await alice.keyboard.type(text);
    await alice.keyboard.press('Enter');
    await expect(bob.locator('[id^="msg-"] strong').filter({ hasText: text })).toBeVisible();
  });

  test('/shrug sends the shrug, rendered intact', async () => {
    await composer(alice).click();
    await alice.keyboard.type('/shrug oh well');
    await alice.keyboard.press('Escape'); // close the command menu, keep the text
    await alice.keyboard.press('Enter');
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: 'oh well ¯\\_(ツ)_/¯' })).toBeVisible();
  });

  test('/code inserts a code block instead of sending', async () => {
    await composer(alice).click();
    await alice.keyboard.type('/code js');
    await alice.keyboard.press('Escape');
    await alice.keyboard.press('Enter');
    await expect(composer(alice)).toContainText('```js');
    await composer(alice).evaluate((el) => { el.innerHTML = ''; });
  });

  test('meeting from the attach menu posts a meeting card', async () => {
    const title = `Planning ${Date.now()}`;
    await alice.locator('button[title="Attach"]').click();
    await alice.getByText('Meeting', { exact: true }).first().click();
    const form = alice.locator('form').filter({ has: alice.getByPlaceholder('e.g. Weekly Sync') });
    await form.getByPlaceholder('e.g. Weekly Sync').fill(title);
    const d = new Date(Date.now() + 86400000);
    await form.locator('input[type="date"]').fill(d.toISOString().slice(0, 10));
    await form.locator('button[type="submit"]').click();
    await expect(bob.getByText(title)).toBeVisible();
  });

  test('/call starts a voice huddle', async () => {
    await composer(alice).click();
    await alice.keyboard.type('/call');
    await alice.keyboard.press('Escape');
    await alice.keyboard.press('Enter');
    const overlay = alice.getByTestId('huddle-overlay');
    await expect(overlay).toBeVisible();
    await overlay.getByTitle('Leave huddle').click();
    await expect(overlay).toBeHidden();
  });

  test('the AI button opens the Chttrix AI panel', async () => {
    await alice.locator('button[title="AI"]').click();
    await expect(alice.getByPlaceholder(/ask|message chttrix ai|type/i).last()).toBeVisible();
  });

  test('voice recorder can be cancelled', async () => {
    await alice.locator('button[title="Voice note"]').click();
    await alice.locator('button[title="Cancel"]').click();
    await expect(alice.locator('button[title="Start recording"]')).toHaveCount(0);
  });
});
