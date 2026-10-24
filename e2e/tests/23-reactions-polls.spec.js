'use strict';

/**
 * Reactions say who reacted, and they and poll results reach everyone live:
 * - Bob reacts to Alice's message; Alice sees the chip appear without reloading, and hovering it
 *   says "bob reacted with 👍".
 * - Alice posts a poll; Bob sees the results before voting, and they move when Alice votes.
 */

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm, sendText, waitForComposerReady } = require('./helpers');

const api = (page) => ({
  async req(method, path, data) {
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    return page.request[method](`${E2E.apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` }, ...(data ? { data } : {}) });
  },
});

test('reactions name the people who reacted and arrive live; poll results are live for everyone', async ({ browser }) => {
  test.setTimeout(150_000);
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
  await login(alice, 'alice');
  await openWorkspace(alice);
  await login(bob, 'bob');
  await openWorkspace(bob);
  await openDm(alice, 'bob');
  await openDm(bob, 'alice');
  await Promise.all([waitForComposerReady(alice), waitForComposerReady(bob)]);
  const dmId = alice.url().split('/dm/')[1].split(/[/?#]/)[0];

  const text = `react to me ${Date.now()}`;
  await sendText(alice, text);
  const row = bob.locator('[id^="msg-"]').filter({ hasText: text });
  await expect(row).toBeVisible({ timeout: 20_000 });
  const messageId = (await row.first().getAttribute('id')).replace(/^msg-/, '');

  // Bob reacts; Alice's open chat shows it at once, and says it was bob.
  expect((await api(bob).req('post', `/api/v2/messages/${messageId}/react`, { emoji: '👍' })).ok()).toBeTruthy();
  const chip = alice.locator(`[id="msg-${messageId}"]`).getByTestId('reaction-chip');
  await expect(chip).toHaveText(/👍\s*1/, { timeout: 15_000 });
  await expect(chip).toHaveAttribute('aria-label', /bob reacted with 👍/);
  await chip.hover();
  await expect(alice.getByTestId('reaction-who')).toContainText('bob reacted with 👍');

  // Alice adds the same reaction: "bob and you".
  await chip.click();
  await expect(chip).toHaveText(/👍\s*2/, { timeout: 10_000 });
  await expect(chip).toHaveAttribute('aria-label', /bob and you reacted/);
  // Bob sees Alice's reaction too, by name.
  const bobChip = bob.locator(`[id="msg-${messageId}"]`).getByTestId('reaction-chip');
  await expect(bobChip).toHaveAttribute('aria-label', /alice and you reacted/, { timeout: 10_000 });

  // A poll: results show for Bob before he votes, and move when Alice votes.
  const created = await api(alice).req('post', '/api/v2/messages/poll', {
    dmId,
    poll: { question: 'Lunch?', options: ['Pizza', 'Salad'] },
  });
  expect(created.ok()).toBeTruthy();
  const pollId = String((await created.json()).message?._id);
  const bobPoll = bob.locator(`[id="msg-${pollId}"]`);
  await expect(bobPoll).toContainText('Lunch?', { timeout: 20_000 });
  await expect(bobPoll).toContainText('0%');
  expect((await api(alice).req('post', `/api/v2/messages/${pollId}/vote`, { optionIndices: [0] })).ok()).toBeTruthy();
  await expect(bobPoll).toContainText('100%', { timeout: 15_000 });

  await Promise.all(contexts.map((c) => c.close()));
});
