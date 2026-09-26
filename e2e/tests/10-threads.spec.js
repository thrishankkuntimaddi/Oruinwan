'use strict';

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, openDm, sendText, waitForComposerReady } = require('./helpers');

async function openThread(page, text) {
  const msg = page.locator('[id^="msg-"]').filter({ hasText: text });
  await msg.hover();
  await msg.locator('button[title="Reply in thread"]').click();
  const panel = page.getByTestId('thread-panel');
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('threads', () => {
  let alice, bob, contexts;
  const root = `thread root ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);
    await openDm(alice, 'bob'); await openDm(bob, 'alice');
    await sendText(alice, root);
    await expect(bob.locator('[id^="msg-"]').filter({ hasText: root })).toBeVisible();
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  test('a reply auto-follows the author and lists participants', async () => {
    const bobThread = await openThread(bob, root);
    await waitForComposerReady(bobThread);
    await bobThread.locator('[contenteditable="true"]').click();
    await bob.keyboard.type('first reply');
    await bob.keyboard.press('Enter');
    await expect(bobThread.getByText('first reply')).toBeVisible();

    const aliceThread = await openThread(alice, root);
    await expect(aliceThread.getByText('first reply')).toBeVisible();
    // Alice wrote the message, so the first reply made her a follower (with Bob, the replier).
    await expect(aliceThread.locator('button', { hasText: 'Following (2)' })).toBeVisible();
    await expect(aliceThread.getByTestId('thread-participants')).toContainText('2 participants');
  });

  test('unfollow is saved', async () => {
    const aliceThread = alice.getByTestId('thread-panel');
    await aliceThread.locator('button', { hasText: 'Following' }).click();
    await expect(aliceThread.locator('button', { hasText: /^\s*Follow\s*$/ })).toBeVisible();
    await aliceThread.getByTitle('Close').click();
    const reopened = await openThread(alice, root);
    await expect(reopened.locator('button', { hasText: /^\s*Follow\s*$/ })).toBeVisible();
  });

  test('resolving shows for everyone, and can be reopened', async () => {
    const aliceThread = alice.getByTestId('thread-panel');
    await aliceThread.getByTitle('Mark thread resolved').click();
    await expect(aliceThread.getByTestId('thread-resolved')).toBeVisible();
    await expect(bob.getByTestId('thread-panel').getByTestId('thread-resolved')).toBeVisible();

    await aliceThread.getByTitle('Reopen thread').click();
    await expect(aliceThread.getByTestId('thread-resolved')).toHaveCount(0);
    await expect(bob.getByTestId('thread-panel').getByTestId('thread-resolved')).toHaveCount(0);
  });

  test('summarize opens the thread summary', async () => {
    await alice.getByTestId('thread-panel').getByTitle('Summarize thread').click();
    await expect(alice.getByText(/summary/i).first()).toBeVisible();
  });
});
