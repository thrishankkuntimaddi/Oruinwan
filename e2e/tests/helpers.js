'use strict';

const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { E2E } = require('../scripts/config');

/** Ids written by scripts/seed.js when the stack started. */
function seedData() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.auth', 'seed.json'), 'utf8'));
}

/**
 * Log in through the real form. The password generates/unlocks the user's
 * encryption keys during this login, so tests stay on in-app navigation
 * afterwards instead of page.goto (a reload would ask for the password again).
 */
async function login(page, userKey) {
  const user = E2E.users[userKey];
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(E2E.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/workspaces/);
}

/** From /workspaces, open the seeded workspace by clicking it. */
async function openWorkspace(page) {
  if (process.env.E2E_DEBUG) {
    page.on('response', (r) => { if (r.url().includes('/api/')) console.log('[resp]', r.status(), r.request().method(), r.url().replace(E2E.apiUrl, '')); });
    page.on('console', async (m) => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      const args = await Promise.all(m.args().slice(1, 4).map((x) => x.jsonValue().catch(() => '?')));
      console.log('[console]', m.type(), m.text().slice(0, 120), '| args:', JSON.stringify(args).slice(0, 600));
    });
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('[nav]', f.url()); });
  }
  await page.getByText(E2E.workspaceName, { exact: false }).first().click();
  await page.waitForURL(/\/workspace\/[a-f0-9]{24}\//);
}

/** The composer is a contenteditable; its "Message..." overlay appears once encryption is ready. */
async function waitForComposerReady(scope) {
  await expect(scope.getByText('Message...', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

/** Open (or create) the DM with `otherUsername` through the "New Message" dialog. */
async function openDm(page, otherUsername) {
  await page.locator('[title="Add Direct Messages"]').first().click();
  await page.getByPlaceholder('Search by name or email…').fill(otherUsername);
  await page.getByText(otherUsername, { exact: true }).last().click();
  await page.waitForURL(/\/dm\/[a-f0-9]{24}/, { timeout: 30_000 });
}

/** Type into the conversation composer and send; waits for the message to render. */
async function sendText(page, text) {
  await waitForComposerReady(page);
  await page.locator('[contenteditable="true"]').last().click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await expect(page.locator('[id^="msg-"]').filter({ hasText: text })).toBeVisible();
}

/** Open the conversation header's ⋮ menu and pick an item by its label. */
async function headerMenu(page, label) {
  await page.locator('button[title="Options"]').first().click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

module.exports = { E2E, seedData, login, openWorkspace, waitForComposerReady, openDm, sendText, headerMenu };

/** Run a read-only query against the E2E database (for assertions the UI cannot show). */
async function withDb(fn) {
  const serverDir = path.join(__dirname, '..', '..', 'server');
  const { MongoClient } = require(require.resolve('mongodb', { paths: [serverDir] }));
  const client = await MongoClient.connect(E2E.mongoUri);
  try {
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

module.exports.withDb = withDb;

/**
 * Run read-only SQL against the E2E PostgreSQL database. Identity (workspaces,
 * memberships, permissions, conversation keys) and tasks live there.
 */
async function withPg(fn) {
  const serverDir = path.join(__dirname, '..', '..', 'server');
  const { Client } = require(require.resolve('pg', { paths: [serverDir] }));
  const client = new Client({ connectionString: E2E.databaseUrl });
  await client.connect();
  try {
    return await fn((text, params = []) => client.query(text, params).then((r) => r.rows));
  } finally {
    await client.end();
  }
}

module.exports.withPg = withPg;
