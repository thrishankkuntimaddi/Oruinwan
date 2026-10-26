'use strict';

// The phone app (its own interface, mobile/) in a phone-sized browser against the same server:
// members message members across phone and web, with Google (no password) and password sign-ins,
// and a member whose very first sign-in is on the phone reads what was sent before it.

const { test, expect, devices } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm: openDmFromHome, sendText } = require('./helpers');

const fakeGoogle = (email) => `window.google = { accounts: {
  oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: ${JSON.stringify(`e2e-google:${email}`)} }), 0) }) },
  id: { initialize() {}, prompt() {} } } };`;

// The Chats tab ("Chats", or "Chats, 1 new" with unread messages).
const chatsTab = (page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Chats/ });

async function phoneSignIn(browser, key) {
  const user = E2E.users[key];
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  if (user.google) {
    await ctx.route(/accounts\.google\.com\/gsi\/client/, (route) => route.fulfill({ contentType: 'application/javascript', body: fakeGoogle(user.email) }));
  }
  const page = await ctx.newPage();
  await page.goto(E2E.phoneUrl);
  await page.getByTestId('get-started').click();
  await page.getByPlaceholder('name@example.com').fill(user.email);
  await page.getByTestId('email-continue').click();
  if (user.google) {
    await page.getByText('Continue with Google').first().click();
  } else {
    await page.getByLabel('Password', { exact: true }).fill(E2E.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  await page.getByText(E2E.workspaceName).first().click();
  await expect(chatsTab(page)).toBeVisible({ timeout: 30_000 });
  return { ctx, page };
}

async function phoneOpenDm(page, username) {
  // Inside a conversation the tab bar is hidden: go back to the list first.
  const chats = chatsTab(page);
  for (let i = 0; i < 3 && !(await chats.isVisible()); i += 1) {
    await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  }
  await chats.click();
  await page.getByRole('button', { name: 'New message' }).last().click();
  await page.getByPlaceholder('Search people').fill(username);
  await page.getByRole('button', { name: E2E.users[username].email }).click();
  // The To: bar: the person is a chip now; open our chat.
  await page.getByTestId('to-open').click();
  await expect(page.getByRole('textbox', { name: `Message ${username}` })).toBeVisible({ timeout: 30_000 });
}

async function phoneSend(page, username, text) {
  await page.getByRole('textbox', { name: `Message ${username}` }).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function phoneReads(page, username, text) {
  await phoneOpenDm(page, username);
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

async function webSignIn(browser, key) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  await login(page, key);
  await openWorkspace(page);
  return { ctx, page };
}

async function webOpenDm(page, username) {
  await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  await openDmFromHome(page, username);
}

test.describe('phone app: member to member messages', () => {
  test('phone and web members message each other', async ({ browser }) => {
    test.setTimeout(360_000);
    const t = Date.now();

    const shiva = await phoneSignIn(browser, 'shiva'); // Google on the phone
    const vishnu = await webSignIn(browser, 'vishnu');

    // Phone member → web member, and back.
    await phoneOpenDm(shiva.page, 'vishnu');
    await phoneSend(shiva.page, 'vishnu', `phone shiva to vishnu ${t}`);
    await webOpenDm(vishnu.page, 'shiva');
    await expect(vishnu.page.locator('[id^="msg-"]').filter({ hasText: `phone shiva to vishnu ${t}` })).toBeVisible({ timeout: 30_000 });
    await sendText(vishnu.page, `web vishnu to shiva ${t}`);
    await phoneReads(shiva.page, 'vishnu', `web vishnu to shiva ${t}`);

    // A member who has never signed in anywhere gets a message, then signs in on the phone.
    await webOpenDm(vishnu.page, 'manogna');
    await sendText(vishnu.page, `web vishnu to manogna ${t}`);
    const manogna = await phoneSignIn(browser, 'manogna');
    await phoneReads(manogna.page, 'vishnu', `web vishnu to manogna ${t}`);
    await phoneSend(manogna.page, 'vishnu', `phone manogna to vishnu ${t}`);

    // Phone member ↔ phone member.
    await phoneOpenDm(manogna.page, 'shiva');
    await phoneSend(manogna.page, 'shiva', `phone manogna to shiva ${t}`);
    await phoneReads(shiva.page, 'manogna', `phone manogna to shiva ${t}`);
    await phoneSend(shiva.page, 'manogna', `phone shiva to manogna ${t}`);
    await phoneReads(manogna.page, 'shiva', `phone shiva to manogna ${t}`);

    // The web member reads what the phone member sent.
    await webOpenDm(vishnu.page, 'manogna');
    await expect(vishnu.page.locator('[id^="msg-"]').filter({ hasText: `phone manogna to vishnu ${t}` })).toBeVisible({ timeout: 30_000 });

    for (const s of [shiva, vishnu, manogna]) await s.ctx.close();
  });
});
