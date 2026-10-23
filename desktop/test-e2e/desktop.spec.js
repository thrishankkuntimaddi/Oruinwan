'use strict';

// The real desktop app (Electron main + preload + the bundled web app) against a local stack.
// Alice uses the desktop app; Bob is a normal browser.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { E2E } = require('../../e2e/scripts/config');

const DESKTOP_DIR = path.join(__dirname, '..');
const CRASH_TEXT = /Something went wrong|couldn’t load|couldn't load/;

let app;
let win;
let bobApp; // a second copy of the app with its own profile: the other person in calls
let workspacePath;
const errors = []; // uncaught page errors (crashes), with the route they happened on

async function login(page, userKey, base = '') {
  const user = E2E.users[userKey];
  await page.goto(`${base}/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(E2E.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/workspaces/, { timeout: 150_000 }); // slow when the machine is busy
  await page.getByText(E2E.workspaceName, { exact: false }).first().click();
  await page.waitForURL(/\/workspace\/[a-f0-9]{24}\//, { timeout: 60_000 });
}

/** In-app navigation, as the app's own links do it (a reload would lock the keys again). */
async function goInApp(page, p) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, p);
}

async function openDm(page, otherUsername) {
  await page.locator('[title="Add Direct Messages"]').first().click();
  await page.getByPlaceholder('Search by name or email…').fill(otherUsername);
  await page.getByRole('dialog', { name: 'New message' }).getByText(otherUsername, { exact: true }).last().click();
  await page.waitForURL(/\/dm\/[a-f0-9]{24}/, { timeout: 30_000 });
  await expect(page.getByText('Message...', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

const mainWindow = (fn) => app.evaluate(({ BrowserWindow }, body) => {
  const w = BrowserWindow.getAllWindows().find((x) => !x.getTitle().startsWith('Oruinwan call'));
  // eslint-disable-next-line no-new-func
  return new Function('w', body)(w);
}, fn);

test.describe.configure({ mode: 'serial' });

/** One copy of the desktop app with its own profile (a second copy is another person's computer). */
function launchApp() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'oruinwan-desktop-e2e-'));
  return electron.launch({
    // The desktop app's own Electron (desktop/node_modules), not one found from the repo root.
    executablePath: require(require.resolve('electron', { paths: [DESKTOP_DIR] })),
    args: [DESKTOP_DIR],
    cwd: DESKTOP_DIR,
    env: { ...process.env, ORUINWAN_TEST_MODE: '1', ORUINWAN_USER_DATA: userData, ELECTRON_IS_DEV: '' },
  });
}

test.beforeAll(async () => {
  app = await launchApp();
  win = await app.firstWindow();
  win.on('pageerror', (err) => errors.push({ route: win.url(), message: err.message, stack: (err.stack || '').split('\n').slice(0, 4).join(' | ') }));
  // Links to other sites must not open the real browser during the test.
  await app.evaluate(({ shell }) => {
    global.__opened = [];
    shell.openExternal = async (url) => { global.__opened.push(url); };
  });
});

test.afterAll(async () => {
  if (errors.length) console.log('[desktop e2e] page errors:\n' + errors.map((e) => `  ${e.route}: ${e.message} (${e.stack})`).join('\n'));
  await bobApp?.close();
  await app?.close();
});

test('starts on the sign-in page and signs in', async () => {
  await expect(win).toHaveURL(/^app:\/\/oruinwan\//);
  await login(win, 'alice', 'app://oruinwan');
  workspacePath = new URL(win.url()).pathname.match(/^\/workspace\/[a-f0-9]{24}/)[0];
  expect(await win.evaluate(() => Boolean(window.oruinwanDesktop && window.electronAPI))).toBe(true);
});

test('every main page opens without crashing', async () => {
  const pages = ['home', 'channels', 'messages', 'tasks', 'notes', 'huddles', 'agents', 'automations', 'apps',
    'templates', 'developer', 'files', 'knowledge', 'roadmap', 'reviews', 'search', 'notifications', 'admin'];
  const broken = [];
  for (const name of pages) {
    const before = errors.length;
    await goInApp(win, `${workspacePath}/${name}`);
    await win.waitForTimeout(1500);
    const crashed = await win.getByText(CRASH_TEXT).count();
    if (crashed || errors.length > before) broken.push(`${name}${crashed ? ' (error screen)' : ''}${errors.length > before ? ` (${errors.slice(before).map((e) => e.message).join('; ')})` : ''}`);
  }
  await goInApp(win, '/settings');
  await win.waitForTimeout(1500);
  if (await win.getByText(CRASH_TEXT).count()) broken.push('settings (error screen)');
  expect(broken, `pages that crashed: ${broken.join(', ')}`).toEqual([]);
  // The renderer is still alive.
  expect(await win.evaluate(() => document.readyState)).toBe('complete');
});

test('notifications and the microphone are allowed for the app itself', async () => {
  await goInApp(win, `${workspacePath}/home`);
  expect(await win.evaluate(() => Notification.permission)).toBe('granted');
  const ok = await win.evaluate(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const kinds = s.getTracks().map((t) => t.kind).sort();
    s.getTracks().forEach((t) => t.stop());
    return kinds;
  });
  expect(ok).toEqual(['audio', 'video']);
});

test('a call between two desktop apps: connect, floating window, screen share, leave', async () => {
  bobApp = await launchApp();
  const bob = await bobApp.firstWindow();
  if (process.env.DESKTOP_E2E_DEBUG) {
    bob.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[bob console]', m.type(), m.text().slice(0, 300)); });
    bob.on('requestfailed', (r) => console.log('[bob failed]', r.method(), r.url(), r.failure()?.errorText));
    bob.on('response', (r) => { if (r.url().includes('/api/auth') || r.status() >= 400) console.log('[bob resp]', r.status(), r.request().method(), r.url()); });
  }
  bob.on('pageerror', (err) => errors.push({ route: `bob ${bob.url()}`, message: err.message, stack: (err.stack || '').split('\n').slice(0, 4).join(' | ') }));
  await test.step('bob (second app) opens the DM', async () => {
    await login(bob, 'bob', 'app://oruinwan');
    await openDm(bob, 'alice');
  });
  await test.step('alice (desktop) opens the DM', async () => {
    await goInApp(win, `${workspacePath}/home`);
    await openDm(win, 'bob');
  });

  await win.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  const aliceCall = win.getByTestId('call-screen');
  await expect(aliceCall).toBeVisible();
  // A DM call rings Bob: he answers on the incoming-call screen.
  await expect(bob.getByTestId('incoming-call')).toBeVisible();
  await bob.getByTestId('incoming-call-accept').click();
  await expect(aliceCall).toContainText('2 participants');
  await expect(bob.getByTestId('call-screen')).toContainText('2 participants');
  // Audio really flows: the remote stream has a live audio track on both sides.
  const liveRemoteAudio = (page) => page.waitForFunction(() => [...document.querySelectorAll('audio, video')]
    .some((el) => el.srcObject && el.srcObject.getAudioTracks().some((t) => t.readyState === 'live')), null, { timeout: 60_000 });
  await Promise.all([liveRemoteAudio(win), liveRemoteAudio(bob)]);

  // Screen share goes through the app's handler (cancelled in test mode) and the call survives.
  await aliceCall.getByTestId('call-screen-share').click();
  await expect.poll(() => app.evaluate(() => global.__oruinwanScreenShareRequests || 0)).toBeGreaterThan(0);
  await expect(aliceCall).toContainText('2 participants');

  // Minimising the app pops the call into its small always-on-top window; restoring closes it.
  const popped = app.waitForEvent('window', { timeout: 20_000 });
  await mainWindow('w.minimize()');
  const callWin = await popped;
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .some((w) => w.isAlwaysOnTop() && w.isVisible()))).toBe(true);
  await mainWindow('w.restore(); w.focus()');
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), { timeout: 20_000 }).toBe(1);
  expect(callWin.isClosed()).toBe(true);

  await expect(win.getByTestId('call-screen').or(win.getByTestId('call-mini'))).toBeVisible();
  if (await win.getByTestId('call-mini').isVisible()) await win.getByTestId('mini-expand').click();
  await win.getByTestId('call-screen').getByTitle('Leave huddle').click();
  await expect(win.getByTestId('call-screen')).toBeHidden();
  // A 1:1 call ends for Bob too when Alice hangs up.
  await expect(bob.getByTestId('call-screen')).toBeHidden();
  await bobApp.close();
  bobApp = null;
});

test('app links stay in the app; other sites open in the browser', async () => {
  await goInApp(win, `${workspacePath}/home`);
  await win.evaluate((p) => window.open(`app://oruinwan${p}/tasks`, '_blank'), workspacePath);
  await expect(win).toHaveURL(new RegExp(`${workspacePath}/tasks$`));
  await win.evaluate(() => window.open('https://example.com/docs', '_blank'));
  await expect.poll(() => app.evaluate(() => global.__opened)).toContain('https://example.com/docs');
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
});

test('an incoming call brings the app back from the tray and passes Accept to the page', async () => {
  await goInApp(win, `${workspacePath}/home`);
  await mainWindow('w.hide()');
  await expect.poll(() => mainWindow('return w.isVisible()')).toBe(false);
  // What the incoming-call screen announces (see client/src/desktop/bridge.js).
  await win.evaluate(() => window.dispatchEvent(new CustomEvent('oruinwan:ring', { detail: { huddleId: 'dm-test-1', title: 'bob is calling', body: 'Voice call' } })));
  await expect.poll(() => mainWindow('return w.isVisible()')).toBe(true);

  const action = win.evaluate(() => new Promise((resolve) => {
    window.addEventListener('oruinwan:ring-action', (e) => resolve(e.detail), { once: true });
  }));
  await mainWindow("w.webContents.send('oruinwan:call-action', { huddleId: 'dm-test-1', action: 'accept' })");
  expect(await action).toEqual({ huddleId: 'dm-test-1', action: 'accept' });
  await win.evaluate(() => window.dispatchEvent(new CustomEvent('oruinwan:ring-end')));
});

test('no uncaught errors in the app during the run', async () => {
  expect(errors.map((e) => `${e.route}: ${e.message}`)).toEqual([]);
});
