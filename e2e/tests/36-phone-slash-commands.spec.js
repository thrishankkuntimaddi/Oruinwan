'use strict';

// Slash commands in the phone app (its own interface, in a phone-sized browser): the same
// commands as the web. /task with a person and a date, /poll and /remind me.

const { test, expect, devices } = require('@playwright/test');
const { E2E, seedData } = require('./helpers');

const chatsTab = (page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Chats/ });

test('phone: slash commands create a task, a poll and a reminder', async ({ browser }) => {
  test.setTimeout(240_000);
  const t = Date.now();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await page.goto(E2E.phoneUrl);
  await page.getByTestId('get-started').click();
  await page.getByPlaceholder('name@example.com').fill(E2E.users.alice.email);
  await page.getByTestId('email-continue').click();
  await page.getByLabel('Password', { exact: true }).fill(E2E.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText(E2E.workspaceName).first().click();
  await expect(chatsTab(page)).toBeVisible({ timeout: 30_000 });

  await chatsTab(page).click();
  await page.getByRole('button', { name: 'New message' }).last().click();
  await page.getByPlaceholder('Search people').fill('sandeep');
  await page.getByRole('button', { name: E2E.users.sandeep.email }).click();
  const box = page.getByRole('textbox', { name: 'Message sandeep' });
  await expect(box).toBeVisible({ timeout: 30_000 });

  // Typing / lists the commands, with the same names as on the web.
  await box.fill('/');
  await expect(page.getByTestId('slash-item-task')).toBeVisible();
  await expect(page.getByTestId('slash-item-remind')).toBeVisible();
  await page.getByTestId('slash-item-task').click();
  await expect(box).toHaveValue('/task ');
  await expect(page.getByTestId('slash-hint')).toContainText('/task <title> [@person]');

  // /task: assigned to Sandeep, due tomorrow.
  const title = `Phone task ${t}`;
  const taskCall = page.waitForResponse((r) => r.url().includes('/api/v2/tasks') && r.request().method() === 'POST');
  await box.fill(`/task ${title} @sandeep tomorrow`);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const taskRes = await taskCall;
  expect(taskRes.status()).toBeLessThan(300);
  const data = await taskRes.json();
  const task = data.task || data.tasks?.[0];
  expect(task.title).toBe(title);
  expect((task.assignedTo || []).map((a) => String(a._id || a.id || a))).toContain(seedData().users.sandeep.id);
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return [d.getFullYear(), d.getMonth(), d.getDate()]; });
  const due = await page.evaluate((iso) => { const d = new Date(iso); return [d.getFullYear(), d.getMonth(), d.getDate()]; }, task.dueDate);
  expect(due).toEqual(tomorrow);
  expect(JSON.parse(taskRes.request().postData()).linkedMessage).toMatch(/^[a-f0-9]{24}$/);
  await expect(page.getByText(`Task created: ${title}`).first()).toBeVisible({ timeout: 30_000 });

  // /poll.
  await box.fill(`/poll "Phone lunch ${t}?" "Pizza" "Sushi"`);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(`Phone lunch ${t}?`).first()).toBeVisible({ timeout: 30_000 });

  // Wrong arguments: explained, nothing sent.
  await box.fill('/remind me sometime');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByTestId('slash-error')).toContainText('When?');
  await expect(box).toHaveValue('/remind me sometime');

  // /remind me.
  const remindCall = page.waitForResponse((r) => /\/api\/v2\/messages\/[a-f0-9]{24}\/reminder$/.test(r.url()) && r.request().method() === 'POST');
  await box.fill(`/remind me in 1 minute check ${t}`);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const remindRes = await remindCall;
  expect(remindRes.status()).toBe(201);
  expect(JSON.parse(remindRes.request().postData())).toMatchObject({ note: `check ${t}` });

  await ctx.close();
});
