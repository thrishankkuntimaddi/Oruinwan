'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, waitForComposerReady, withDb } = require('./helpers');

/** Open (or create) the DM with `otherUsername` through the "New Message" dialog. */
async function openDm(page, otherUsername) {
  await page.locator('[title="Add Direct Messages"]').first().click();
  const search = page.getByPlaceholder('Search by name or email…');
  await search.fill(otherUsername);
  await page.getByText(otherUsername, { exact: true }).last().click();
  await page.waitForURL(/\/dm\/[a-f0-9]{24}/, { timeout: 30_000 });
}

test.describe('messaging', () => {
  test('encrypted DM and thread reply between two users', async ({ browser }) => {
    const stamp = Date.now();
    const dmText = `Hello Bob, e2e ${stamp}`;
    const replyText = `Thread reply from Bob ${stamp}`;

    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();
    const alice = await aliceCtx.newPage();
    const bob = await bobCtx.newPage();

    // Both sign in first so both have identity keys before the DM key is shared.
    await login(bob, 'bob');
    await openWorkspace(bob);
    await login(alice, 'alice');
    await openWorkspace(alice);

    // Alice sends a DM.
    await openDm(alice, 'bob');
    await waitForComposerReady(alice);
    // The DM list in the sidebar shows Bob's profile photo, not just his initial.
    await expect(alice.locator('[data-testid="user-avatar"][alt="bob"]').first())
      .toHaveAttribute('src', E2E.users.bob.profilePicture);
    const aliceComposer = alice.locator('[contenteditable="true"]').last();
    await aliceComposer.click();
    await alice.keyboard.type(dmText);
    await alice.keyboard.press('Enter');
    await expect(alice.locator('[id^="msg-"]').filter({ hasText: dmText })).toBeVisible();

    // Bob opens the same conversation and can read (decrypt) it.
    await openDm(bob, 'alice');
    // Alice is signed in, so the DM header shows her as active (it used to say "Offline").
    await expect(bob.getByText('Active now').first()).toBeVisible();
    const bobMessage = bob.locator('[id^="msg-"]').filter({ hasText: dmText });
    await expect(bobMessage).toBeVisible({ timeout: 30_000 });
    // The DM list previews the decrypted last message (it used to say "No messages yet").
    await expect(bob.getByTestId('dm-row').filter({ hasText: 'alice' })).toContainText(dmText);

    // Bob replies in a thread.
    await bobMessage.hover();
    await bobMessage.locator('button[title="Reply in thread"]').click();
    const bobThread = bob.locator('[data-testid="thread-panel"]');
    await expect(bobThread).toBeVisible();
    await waitForComposerReady(bobThread);
    await bobThread.locator('[contenteditable="true"]').click();
    await bob.keyboard.type(replyText);
    await bob.keyboard.press('Enter');
    await expect(bobThread.getByText(replyText)).toBeVisible();

    // Alice sees the reply in the thread.
    const aliceMessage = alice.locator('[id^="msg-"]').filter({ hasText: dmText });
    await aliceMessage.hover();
    await aliceMessage.locator('button[title="Reply in thread"]').click();
    const aliceThread = alice.locator('[data-testid="thread-panel"]');
    await expect(aliceThread.getByText(replyText)).toBeVisible({ timeout: 30_000 });

    // Same person, same picture: every avatar of Bob on Alice's screen (sidebar,
    // chat header, thread reply) uses his one stored photo.
    const bobAvatarSrcs = await alice.locator('img[alt="bob"]').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')));
    expect(bobAvatarSrcs.length).toBeGreaterThanOrEqual(3);
    expect(new Set(bobAvatarSrcs)).toEqual(new Set([E2E.users.bob.profilePicture]));

    // The server only ever stored ciphertext: neither text appears in any message document.
    const plaintextHits = await withDb(async (db) => {
      const docs = await db.collection('messages').find({}).toArray();
      expect(docs.length).toBeGreaterThanOrEqual(2);
      const raw = JSON.stringify(docs);
      return [dmText, replyText].filter((t) => raw.includes(t));
    });
    expect(plaintextHits).toEqual([]);

    await aliceCtx.close();
    await bobCtx.close();
  });
});
