'use strict';

/**
 * Smoke crawl: every page a signed-in person can reach, at desktop, tablet and phone widths.
 * A page fails when it throws, shows the error screen, logs console errors, gets a 5xx from
 * the API, or keeps spinning. All problems are collected and listed together at the end.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, openWorkspace } = require('./helpers');

// Console noise that is not a bug (browser and dev-server chatter).
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon/i,
  /ResizeObserver loop/i,
  /Failed to load resource: the server responded with a status of 4\d\d/i, // 4xx are expected answers (no access, not found)
  /net::ERR_ABORTED/i,
  /WebSocket connection to .* failed/i, // closed when a test page navigates away mid-handshake
  /Google|gsi|accounts\.google\.com/i, // the e2e Google client id is fake
  /Could not resolve DM/, // an unknown DM id is handled (sends you home); it is only logged as an error
];

const token = (page) => page.evaluate(() => localStorage.getItem('accessToken'));

/** Collects problems on one page while it is open. */
function watch(page, problems, label) {
  const state = { where: '' };
  const add = (kind, detail) => problems.push({ who: label, where: state.where, kind, detail: String(detail).slice(0, 300) });
  page.on('pageerror', (err) => add('page error', `${err.message}\n${(err.stack || '').split('\n').slice(1, 3).join(' ')}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    add('console error', text);
  });
  page.on('response', (res) => {
    if (res.status() >= 500 && res.url().startsWith(E2E.apiUrl)) add(`HTTP ${res.status()}`, `${res.request().method()} ${res.url().replace(E2E.apiUrl, '')}`);
  });
  return state;
}

/** Reloads into a path; unlocks encryption with the password if the app asks. */
async function goto(page, path) {
  await page.goto(path);
  const dialog = page.locator('[aria-labelledby="unlock-modal-title"]');
  if (await dialog.waitFor({ state: 'visible', timeout: 2_500 }).then(() => true).catch(() => false)) {
    await dialog.getByPlaceholder('Enter your password').fill(E2E.password);
    await dialog.getByRole('button', { name: 'Unlock Encryption' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 20_000 });
  }
}

/** After a page opens: no error screen, and no spinner still turning after 10 s. */
async function checkPage(page, state, problems, label) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1_200);
  const boundary = page.locator('.cd-state[data-tone="danger"][role="alert"]');
  if (await boundary.count()) {
    const text = (await boundary.first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    problems.push({ who: label, where: state.where, kind: 'error screen', detail: text.slice(0, 300) });
  }
  const spinner = page.locator('.animate-spin:visible, [aria-busy="true"]:visible, [role="status"][aria-label*="Loading" i]:visible');
  const settled = await expect.poll(() => spinner.count(), { timeout: 10_000 }).toBe(0).then(() => true).catch(() => false);
  if (!settled) problems.push({ who: label, where: state.where, kind: 'stuck loading', detail: `${await spinner.count()} spinner(s) after 10 s` });
  // A page wider than the window means a broken layout (sideways scroll).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 4) problems.push({ who: label, where: state.where, kind: 'sideways scroll', detail: `${overflow}px wider than the window` });
}

function report(problems) {
  if (!problems.length) return;
  const lines = problems.map((p) => `- [${p.who}] ${p.where} · ${p.kind}: ${p.detail.replace(/\n/g, ' ')}`);
  throw new Error(`Smoke crawl found ${problems.length} problem(s):\n${lines.join('\n')}`);
}

test.describe('smoke crawl', () => {
  test.describe.configure({ timeout: 900_000 });
  let ids;

  test.beforeAll(async ({ browser }, testInfo) => {
    // The first page load compiles the whole app in the dev server, which can take minutes.
    testInfo.setTimeout(600_000);
    const saved = path.join(__dirname, '..', '.auth', 'crawl-ids.json');
    if (fs.existsSync(saved)) {
      const cached = JSON.parse(fs.readFileSync(saved, 'utf8'));
      if (cached.workspaceId === seedData().workspaceId) { ids = cached; return; }
    }
    // Bob signs in once so his identity key exists before Alice shares a channel with him.
    const bobCtx = await browser.newContext();
    const bobPage = await bobCtx.newPage();
    await login(bobPage, 'bob');
    await bobCtx.close();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, 'alice');
    const { workspaceId, users } = seedData();
    const headers = { Authorization: `Bearer ${await token(page)}` };
    const post = async (path, data, opts = {}) => {
      const res = await page.request.post(`${E2E.apiUrl}${path}`, { headers, ...(opts.multipart ? { multipart: data } : { data }) });
      expect(res.status(), `${path}: ${await res.text()}`).toBeLessThan(300);
      return res.json();
    };
    const idOf = (body, ...keys) => {
      for (const k of keys) { const v = k.split('.').reduce((o, p) => (o ? o[p] : undefined), body); if (v) return String(v._id || v.id || v); }
      return null;
    };
    const channel = await post('/api/channels', { name: `crawl-${Date.now() % 100000}`, workspaceId, memberIds: [users.bob.id] });
    const task = await post('/api/v2/tasks', { title: 'Crawl task', workspaceId, assignmentType: 'self', priority: 'medium' });
    const note = await post('/api/v2/notes', { title: 'Crawl note', workspaceId, content: 'Hello' });
    const page_ = await post('/api/v2/knowledge/pages', { title: 'Crawl page', workspaceId, content: 'Knowledge body' });
    await post('/api/v2/roadmap', { title: 'Crawl roadmap item', workspaceId });
    const file = await post('/api/v2/files', {
      workspaceId,
      file: { name: 'crawl.txt', mimeType: 'text/plain', buffer: Buffer.from('crawl file') },
    }, { multipart: true });
    const start = new Date(Date.now() + 3600_000).toISOString();
    const meeting = await post('/api/scheduled-meetings', { workspaceId, title: 'Crawl meeting', startTime: start, duration: 30, participants: [users.bob.id] });
    ids = {
      workspaceId,
      channelId: idOf(channel, 'channel', '_id', 'id'),
      taskId: idOf(task, 'task', 'data', '_id', 'id'),
      noteId: idOf(note, 'note', 'data', '_id', 'id'),
      pageId: idOf(page_, 'page', 'data', '_id', 'id'),
      fileId: idOf(file, 'file', 'data', '_id', 'id'),
      meetingId: idOf(meeting, 'meeting', 'data', '_id', 'id'),
    };
    fs.writeFileSync(saved, JSON.stringify(ids));
    await ctx.close();
  });

  const workspacePages = (w, ids) => [
    `/workspace/${w}/home`,
    `/workspace/${w}/channels`,
    `/workspace/${w}/channel/${ids.channelId}`,
    `/workspace/${w}/home/channel/${ids.channelId}`,
    `/workspace/${w}/messages`,
    `/workspace/${w}/tasks`,
    ...['board', 'sprint', 'timeline', 'workload', 'milestones', 'time'].map((v) => `/workspace/${w}/tasks?view=${v}`),
    ...['shared-tasks', 'assigned-tasks', 'all-tasks', 'completed-tasks', 'deleted-tasks'].map((t) => `/workspace/${w}/tasks?tab=${t}`),
    `/workspace/${w}/tasks/${ids.taskId}`,
    `/workspace/${w}/roadmap`,
    `/workspace/${w}/reviews`,
    `/workspace/${w}/notes`,
    `/workspace/${w}/notes/${ids.noteId}`,
    `/workspace/${w}/knowledge`,
    `/workspace/${w}/knowledge/${ids.pageId}`,
    `/workspace/${w}/knowledge/graph`,
    `/workspace/${w}/files`,
    `/workspace/${w}/files/${ids.fileId}`,
    `/workspace/${w}/search?q=crawl`,
    `/workspace/${w}/agents`,
    `/workspace/${w}/agents?tab=directory`,
    `/workspace/${w}/automations`,
    `/workspace/${w}/automations/new`,
    `/workspace/${w}/apps`,
    `/workspace/${w}/templates`,
    ...['api-keys', 'webhooks', 'bots', 'apps', 'my-apps', 'docs'].map((t) => `/workspace/${w}/developer?tab=${t}`),
    `/workspace/${w}/admin`,
    `/workspace/${w}/notifications`,
    `/workspace/${w}/huddles`,
    ...(ids.meetingId ? [`/workspace/${w}/meetings/${ids.meetingId}`] : []),
    `/workspace/${w}/ai-insights`,
    `/workspace/${w}/updates`,
    // Bad ids must show a "not found" state, not crash or 500.
    `/workspace/${w}/channel/000000000000000000000000`,
    `/workspace/${w}/tasks/000000000000000000000000`,
    `/workspace/${w}/notes/000000000000000000000000`,
    `/workspace/${w}/knowledge/000000000000000000000000`,
    `/workspace/${w}/files/000000000000000000000000`,
    `/workspace/${w}/meetings/000000000000000000000000`,
    `/workspace/${w}/dm/000000000000000000000000`,
  ];
  const settingsPages = ['profile', 'security', 'sessions', 'plan', 'notifications', 'appearance', 'region', 'privacy', 'ai', 'integrations', 'data', 'backup', 'updates']
    .map((t) => `/settings?tab=${t}`);
  const publicPages = ['/', '/features', '/pricing', '/security', '/about', '/blog', '/careers', '/contact', '/privacy', '/terms', '/cookies', '/status', '/help', '/docs', '/community', '/partners', '/brand'];

  async function crawl(page, label, paths, problems) {
    const state = watch(page, problems, label);
    page.setDefaultNavigationTimeout(30_000);
    page.setDefaultTimeout(20_000);
    for (const path of paths) {
      state.where = path;
      const started = Date.now();
      try {
        await goto(page, path);
        await checkPage(page, state, problems, label);
      } catch (err) {
        problems.push({ who: label, where: path, kind: 'did not load', detail: err.message.split('\n')[0] });
      }
      const ms = Date.now() - started;
      if (process.env.CRAWL_VERBOSE) console.log(`[crawl] ${label} ${path} ${ms}ms`);
      if (ms > 25_000) problems.push({ who: label, where: path, kind: 'slow page', detail: `${Math.round(ms / 1000)} s to open and settle` });
    }
  }

  test('owner: every workspace page, settings and public page', async ({ browser }) => {
    const problems = [];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, 'alice');
    await crawl(page, 'owner', ['/workspaces', ...workspacePages(ids.workspaceId, ids), ...settingsPages, ...publicPages], problems);
    await ctx.close();
    report(problems);
  });

  test('member: the same pages as a member', async ({ browser }) => {
    const problems = [];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, 'bob');
    await crawl(page, 'member', ['/workspaces', ...workspacePages(ids.workspaceId, ids), ...settingsPages], problems);
    await ctx.close();
    report(problems);
  });

  for (const [name, viewport] of [['tablet', { width: 820, height: 1180 }], ['phone', { width: 390, height: 844 }]]) {
    test(`${name} width: key pages`, async ({ browser }) => {
      const problems = [];
      const ctx = await browser.newContext({ viewport, isMobile: name === 'phone', hasTouch: true });
      const page = await ctx.newPage();
      await login(page, 'alice');
      const w = ids.workspaceId;
      await crawl(page, name, [
        `/workspace/${w}/home`, `/workspace/${w}/channel/${ids.channelId}`, `/workspace/${w}/messages`,
        `/workspace/${w}/tasks`, `/workspace/${w}/tasks?view=board`, `/workspace/${w}/tasks/${ids.taskId}`,
        `/workspace/${w}/notes`, `/workspace/${w}/notes/${ids.noteId}`, `/workspace/${w}/files`, `/workspace/${w}/knowledge`,
        `/workspace/${w}/huddles`, `/workspace/${w}/agents`, `/workspace/${w}/admin`, `/workspace/${w}/search?q=crawl`,
        '/settings?tab=profile', '/settings?tab=notifications', '/', '/pricing',
      ], problems);
      await ctx.close();
      report(problems);
    });
  }

  test('owner: main dialogs and menus open and close', async ({ browser }) => {
    const problems = [];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const state = watch(page, problems, 'dialogs');
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    await login(page, 'alice');
    await openWorkspace(page);
    const w = ids.workspaceId;
    const step = async (where, fn) => {
      state.where = where;
      try { await fn(); } catch (err) { problems.push({ who: 'dialogs', where, kind: 'could not open', detail: err.message.split('\n')[0] }); }
      try { await checkPage(page, state, problems, 'dialogs'); } catch (err) { problems.push({ who: 'dialogs', where, kind: 'did not settle', detail: err.message.split('\n')[0] }); }
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    };

    await step('create channel', async () => {
      await goto(page, `/workspace/${w}/channels`);
      await page.getByRole('button', { name: /create channel/i }).first().click();
      await expect(page.getByPlaceholder('project-name')).toBeVisible();
    });
    await step('new task', async () => {
      await goto(page, `/workspace/${w}/tasks`);
      await page.getByRole('button', { name: /new task/i }).first().click();
      await expect(page.getByPlaceholder(/task title/i).first()).toBeVisible();
    });
    await step('invite people', async () => {
      await goto(page, `/workspace/${w}/home`);
      await page.getByRole('button', { name: /invite people/i }).first().click();
      await expect(page.getByRole('dialog').first()).toBeVisible();
    });
    await step('schedule meeting', async () => {
      await goto(page, `/workspace/${w}/huddles`);
      await page.getByRole('button', { name: /^schedule$/i }).first().click();
      await expect(page.getByPlaceholder('e.g. Weekly Sync')).toBeVisible();
    });
    await step('new note', async () => {
      await goto(page, `/workspace/${w}/notes`);
      await page.getByRole('button', { name: /new note/i }).first().click();
    });
    await step('workspace menu', async () => {
      await goto(page, `/workspace/${w}/home`);
      await page.getByText('E2E Workspace').first().click();
      await expect(page.getByText('Switch workspace').first()).toBeVisible();
    });
    await step('profile menu', async () => {
      await goto(page, `/workspace/${w}/home`);
      await page.locator('[data-testid="profile-menu-button"], button[aria-label*="profile" i], button[title*="profile" i]').first().click();
    });
    await step('workspace admin tabs', async () => {
      await goto(page, `/workspace/${w}/admin`);
      for (const tab of ['General', 'Permissions', 'Members', 'Invitations', 'Agents & apps', 'Features', 'Analytics', 'Data', 'Advanced', 'Overview']) {
        state.where = `workspace admin · ${tab}`;
        await page.getByRole('button', { name: tab, exact: true }).first().click();
        await checkPage(page, state, problems, 'dialogs');
      }
    });
    await step('channel tabs', async () => {
      await goto(page, `/workspace/${w}/channel/${ids.channelId}`);
      for (const tab of ['Threads', 'Tasks', 'Canvas', 'Chat']) {
        state.where = `channel tab · ${tab}`;
        // The channel's tabs come after the left rail (which also has a "Tasks" button).
        await page.getByRole('button', { name: tab, exact: true }).last().click();
        await checkPage(page, state, problems, 'dialogs');
      }
    });
    await step('search palette', async () => {
      await goto(page, `/workspace/${w}/home`);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
      await page.keyboard.type('crawl');
    });
    await ctx.close();
    report(problems);
  });
});
