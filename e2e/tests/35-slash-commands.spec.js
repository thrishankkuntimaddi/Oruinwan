'use strict';

// Slash commands in the web composer: /task creates an assigned task due tomorrow, linked to its
// "Task created" line; /poll creates a poll; /remind me sets a reminder; unknown commands ask first.

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, openWorkspace, waitForComposerReady, withDb } = require('./helpers');

const token = (page) => page.evaluate(() => localStorage.getItem('accessToken'));
const spaNavigate = (page, p) => page.evaluate((to) => {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, p);

let made = null;
test.afterAll(async () => {
  if (!made) return;
  const { ObjectId } = require(require.resolve('mongodb', { paths: [require('path').join(__dirname, '..', '..', 'server')] }));
  await withDb((db) => db.collection('channels').deleteOne({ _id: new ObjectId(made) }));
});

async function typeCommand(page, text) {
  const composer = page.locator('[contenteditable="true"]').last();
  await composer.click();
  await page.keyboard.type(text);
  // An @mention's suggestions may still be open: close them, keep the text.
  await page.keyboard.press('Escape');
  await composer.click();
  await page.keyboard.press('End');
}

test('slash commands create a task, a poll and a reminder', async ({ browser }) => {
  test.setTimeout(240_000);
  const t = Date.now();
  const ws = seedData().workspaceId;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, 'alice');
  await openWorkspace(page);

  const created = await page.request.post(`${E2E.apiUrl}/api/channels`, {
    data: { name: `slash-${t}`, workspaceId: ws, memberIds: [seedData().users.sandeep.id] },
    headers: { Authorization: `Bearer ${await token(page)}` },
  });
  const body = await created.json();
  made = String(body.channel?._id || body.channel?.id || body._id || body.id);
  await page.reload();
  await spaNavigate(page, `/workspace/${ws}/channel/${made}`);
  await waitForComposerReady(page);

  // Typing / lists the commands.
  const composer = page.locator('[contenteditable="true"]').last();
  await composer.click();
  await page.keyboard.type('/');
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await expect(page.getByTestId('slash-item-task')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace');

  // /task with a person and a due date.
  const title = `Fix login ${t}`;
  const taskCall = page.waitForResponse((r) => r.url().includes('/api/v2/tasks') && r.request().method() === 'POST');
  await typeCommand(page, `/task ${title} @sandeep tomorrow`);
  await page.keyboard.press('Enter');
  const taskRes = await taskCall;
  expect(taskRes.status()).toBeLessThan(300);
  const sent = JSON.parse(taskRes.request().postData());
  const data = await taskRes.json();
  const task = data.task || data.tasks?.[0];
  expect(task.title).toBe(title);
  expect((task.assignedTo || []).map((a) => String(a._id || a.id || a))).toContain(seedData().users.sandeep.id);
  // Due tomorrow (the browser's local date), linked to the "Task created" line.
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return [d.getFullYear(), d.getMonth(), d.getDate()]; });
  const due = await page.evaluate((iso) => { const d = new Date(iso); return [d.getFullYear(), d.getMonth(), d.getDate()]; }, task.dueDate);
  expect(due).toEqual(tomorrow);
  expect(sent.linkedMessage).toMatch(/^[a-f0-9]{24}$/);
  await expect(page.locator('[id^="msg-"]').filter({ hasText: `Task created: ${title}` })).toBeVisible({ timeout: 30_000 });

  // /poll.
  await typeCommand(page, `/poll "Lunch ${t}?" "Pizza" "Sushi"`);
  await page.keyboard.press('Enter');
  await expect(page.getByText(`Lunch ${t}?`).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Sushi').first()).toBeVisible();

  // Bad arguments: help, and nothing is sent.
  await typeCommand(page, '/poll "Only one"');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('slash-error')).toContainText('Add at least two options');
  await expect(page.locator('[id^="msg-"]').filter({ hasText: '/poll "Only one"' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  // Unknown command: asked first.
  await typeCommand(page, `/xyz hello ${t}`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('slash-unknown')).toContainText("isn't a command");
  await page.getByTestId('slash-send-as-text').click();
  await expect(page.locator('[id^="msg-"]').filter({ hasText: `/xyz hello ${t}` })).toBeVisible({ timeout: 30_000 });

  // /remind me: on the newest message, nothing posted.
  const remindCall = page.waitForResponse((r) => /\/api\/v2\/messages\/[a-f0-9]{24}\/reminder$/.test(r.url()) && r.request().method() === 'POST');
  await typeCommand(page, `/remind me in 1 minute check ${t}`);
  await page.keyboard.press('Enter');
  expect((await remindCall).status()).toBe(201);
  const list = await page.request.get(`${E2E.apiUrl}/api/v2/messages/reminders`, { headers: { Authorization: `Bearer ${await token(page)}` } });
  const reminders = (await list.json()).reminders || [];
  const mine = reminders.find((r) => r.note === `check ${t}`);
  expect(mine).toBeTruthy();
  const inSeconds = (new Date(mine.remindAt).getTime() - Date.now()) / 1000;
  expect(inSeconds).toBeGreaterThan(0);
  expect(inSeconds).toBeLessThan(75);

  await ctx.close();
});
