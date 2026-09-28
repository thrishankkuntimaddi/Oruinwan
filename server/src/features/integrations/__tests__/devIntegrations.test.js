'use strict';

/**
 * Developer integration routes: config (redaction, secrets shown once,
 * rotation), credential test, PR viewer proxy (access control, shape, cache),
 * AI PR review (own engine, mocked), Jira issue creation, Zoom meetings and
 * Jira event → task sync.
 */

process.env.SERVER_KEK = process.env.SERVER_KEK || 'ab'.repeat(32);
process.env.BACKEND_URL = 'https://api.example.test';

const express = require('express');
const http = require('http');

jest.mock('axios');
jest.mock('../../../shared/middleware/auth', () => (req, res, next) => { req.user = { sub: req.headers['x-user'] }; next(); });
jest.mock('../../../shared/featureFlags', () => ({ requireFlag: () => (req, res, next) => next() }));
jest.mock('../../ai/ai.access', () => ({ requireAIAccess: () => (req, res, next) => next() }));
jest.mock('../webhook.trigger', () => ({ fire: jest.fn(), sendTest: jest.fn() }));
jest.mock('../../ai/ai.provider.resolver', () => ({ resolveForWorkspace: jest.fn(async () => ({ enabled: true, provider: null, providerName: 'mock', model: null })) }));
jest.mock('../../../../../ai/api/ai.gateway', () => ({ chat: jest.fn() }));
jest.mock('../../ai/ai.conversation.service', () => ({ getAssistantUser: jest.fn(async () => ({ _id: '64b0000000000000000000a9', username: 'Oruinwan AI' })) }));
jest.mock('../integration.bot', () => ({
  ...jest.requireActual('../integration.bot'),
  postThreadReply: jest.fn(async () => ({ _id: 'reply-1' })),
  upsertCard: jest.fn(async () => null),
  getBotUser: jest.fn(async (p) => ({ _id: `bot-${p}` })),
}));
jest.mock('../../tasks/tasks.service', () => ({ applyExternalUpdate: jest.fn(async () => ({ statusChanged: false })) }));

const axios = require('axios');
const gateway = require('../../../../../ai/api/ai.gateway');
const Integration = require('../integration.model');
const Workspace = require('../../../../models/Workspace');
const Channel = require('../../channels/channel.model.js');
const Task = require('../../../../models/Task');
const User = require('../../../../models/User');
const Message = require('../../../modules/messages/message.model.js');
const bot = require('../integration.bot');
const tasksService = require('../../tasks/tasks.service');
const { sealSecret, openSecret } = require('../../../modules/conversations/cryptoUtils');
const ghService = require('../github/github.service');
const review = require('../github/github.review');
const zoomClient = require('../zoom/zoom.client');
const { processJiraEvent } = require('../jira/jira.events');
const router = require('../integrations.routes');

const WS = '64b000000000000000000001';
const OWNER = '64b0000000000000000000a1';
const MEMBER = '64b0000000000000000000b1';
const OUTSIDER = '64b0000000000000000000c1';
const CHANNEL = '64b0000000000000000000d1';
const TASK_ID = '64b0000000000000000000e1';

const workspaceDoc = {
  _id: WS, name: 'Acme', isActive: true, isArchived: false,
  members: [{ user: OWNER, role: 'owner', status: 'active' }, { user: MEMBER, role: 'member', status: 'active' }],
};

let store; // type -> integration doc
beforeEach(() => {
  store = {};
  ghService.clearCache();
  review.resetLimits();
  zoomClient.clearTokens();
  const chain = (value) => ({ lean: async () => value, select: () => ({ lean: async () => value }) });
  jest.spyOn(Workspace, 'findOne').mockImplementation((q) => chain(String(q._id) === WS ? workspaceDoc : null));
  jest.spyOn(Workspace, 'findById').mockImplementation((id) => chain(String(id) === WS ? workspaceDoc : null));
  jest.spyOn(Integration, 'findOne').mockImplementation((q) => ({ lean: async () => (String(q.workspaceId) === WS ? store[q.type] || null : null) }));
  jest.spyOn(Integration, 'findOneAndUpdate').mockImplementation((q, update) => ({
    lean: async () => {
      store[q.type] = { _id: `int-${q.type}`, workspaceId: WS, type: q.type, ...(store[q.type] || {}), ...update };
      return store[q.type];
    },
  }));
  jest.spyOn(Channel, 'find').mockImplementation((q) => ({
    select: () => ({ lean: async () => (q._id ? [{ _id: CHANNEL }].filter(c => q._id.$in.includes(c._id)) : [{ _id: CHANNEL }]) }),
  }));
  jest.spyOn(Task, 'find').mockImplementation((q) => ({
    select: () => ({ lean: async () => (q.issueKey && q.issueKey.$in.includes('ABC-7') ? [{ _id: TASK_ID, issueKey: 'ABC-7', title: 'Login', status: 'review', visibility: 'workspace', createdBy: OWNER, assignedTo: [] }] : []) }),
  }));
  jest.spyOn(User, 'findById').mockImplementation(() => ({ select: () => ({ lean: async () => ({ username: 'bob' }) }) }));
  jest.spyOn(Message, 'findOne').mockImplementation(() => ({
    select: () => ({ lean: async () => ({ _id: '64b0000000000000000000f1', channel: CHANNEL, workspace: WS, type: 'integration', integration: { taskIds: [] } }) }),
    sort: () => ({ select: () => ({ lean: async () => ({ _id: '64b0000000000000000000f1', channel: CHANNEL, workspace: WS, type: 'integration', integration: { taskIds: [] } }) }) }),
  }));
});
afterEach(() => jest.restoreAllMocks());

function call(method, path, userId, body) {
  const app = express();
  app.use(express.json());
  app.use('/api/v2/integrations', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        port: server.address().port, path, method,
        headers: { 'x-user': userId, 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) },
      }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => {
          server.close();
          let parsed = text;
          try { parsed = JSON.parse(text); } catch { /* text body */ }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (data) req.write(data);
      req.end();
    });
  });
}

const PR = {
  number: 12, title: 'ABC-7 login', body: 'desc', state: 'open', draft: false, merged: false,
  user: { login: 'octocat', avatar_url: 'https://a/o.png' }, head: { ref: 'feature/login', sha: 'sha1' }, base: { ref: 'main' },
  html_url: 'https://github.com/acme/web/pull/12', additions: 12, deletions: 1, changed_files: 3, commits: 2,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z',
};
const FILES = [
  { filename: 'src/a.ts', status: 'modified', additions: 10, deletions: 1, changes: 11, patch: '@@ -1 +1 @@\n-const a = 1\n+const a = 2' },
  { filename: 'yarn.lock', status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1 @@\n+x' },
  { filename: 'logo.png', status: 'added', additions: 0, deletions: 0, changes: 0 },
];

function mockGithub() {
  axios.mockImplementation(async ({ url, headers }) => {
    if (headers.Authorization !== 'Bearer ghp_real') { const e = new Error('401'); e.response = { status: 401, data: { message: 'Bad credentials' } }; throw e; }
    const p = new URL(url).pathname;
    if (p === '/user') return { data: { login: 'acme-bot', name: 'Acme' } };
    if (p === '/rate_limit') return { data: { resources: { core: { remaining: 10 } } } };
    if (p === '/repos/acme/web/pulls/12') return { data: PR };
    if (p === '/repos/acme/web/pulls/12/files') return { data: FILES };
    if (p === '/repos/acme/web/commits/sha1/check-runs') return { data: { check_runs: [{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'failure' }] } };
    const e = new Error('404'); e.response = { status: 404, data: { message: 'Not Found' } }; throw e;
  });
}

function connectGithub(extra = {}) {
  store.github = { _id: 'int-github', workspaceId: WS, type: 'github', status: 'connected', config: { token: sealSecret('ghp_real'), webhookSecret: sealSecret('whsec'), routes: [], linkTasks: true, autoReview: false, statusSync: true, ...extra } };
}

describe('config', () => {
  it('admin PUT stores sealed secrets, returns the webhook secret once and a redacted config', async () => {
    const res = await call('PUT', '/api/v2/integrations/github/config', OWNER, { workspaceId: WS, token: 'ghp_real', routes: [{ repo: 'Acme/Web', channelId: CHANNEL }] });
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.config.token).toBe('••••');
    expect(res.body.config.hasToken).toBe(true);
    expect(res.body.config.hasWebhookSecret).toBe(true);
    expect(res.body.config.routes).toEqual([{ repo: 'acme/web', channelId: CHANNEL, events: ['pull_request', 'pull_request_review', 'issues', 'push', 'check_suite', 'workflow_run'] }]);
    expect(res.body.webhookSecret).toMatch(/^[a-f0-9]{48}$/);
    expect(res.body.webhookUrl).toBe(`https://api.example.test/api/v2/integrations/webhook/github?workspaceId=${WS}`);
    // Stored sealed, never plaintext.
    expect(store.github.config.token).toMatch(/^enc:v1:/);
    expect(openSecret(store.github.config.token)).toBe('ghp_real');
    expect(openSecret(store.github.config.webhookSecret)).toBe(res.body.webhookSecret);
    expect(JSON.stringify(res.body)).not.toContain('ghp_real');

    // A later PUT keeps the secret and does not reveal it again.
    const again = await call('PUT', '/api/v2/integrations/github/config', OWNER, { workspaceId: WS, autoReview: true, token: '••••' });
    expect(again.body.webhookSecret).toBeUndefined();
    expect(again.body.config.autoReview).toBe(true);
    expect(openSecret(store.github.config.token)).toBe('ghp_real');
  });

  it('members get a redacted view; non-members are refused; members cannot change config', async () => {
    connectGithub();
    const member = await call('GET', `/api/v2/integrations/github/config?workspaceId=${WS}`, MEMBER);
    expect(member.status).toBe(200);
    expect(member.body.config.token).toBe('••••');
    expect(member.body.webhookSecret).toBeUndefined();
    expect(JSON.stringify(member.body)).not.toMatch(/ghp_real|whsec|enc:v1/);
    expect((await call('GET', `/api/v2/integrations/github/config?workspaceId=${WS}`, OUTSIDER)).status).toBe(403);
    expect((await call('PUT', '/api/v2/integrations/github/config', MEMBER, { workspaceId: WS, token: 'x' })).status).toBe(403);
  });

  it('rejects routes to channels outside the workspace and bad repos', async () => {
    const res = await call('PUT', '/api/v2/integrations/github/config', OWNER, { workspaceId: WS, routes: [{ repo: 'acme/web', channelId: '64b0000000000000000000d9' }] });
    expect(res.status).toBe(400);
    const bad = await call('PUT', '/api/v2/integrations/github/config', OWNER, { workspaceId: WS, routes: [{ repo: 'not a repo', channelId: CHANNEL }] });
    expect(bad.status).toBe(400);
  });

  it('rotate-secret returns a fresh secret', async () => {
    connectGithub();
    const res = await call('POST', '/api/v2/integrations/github/rotate-secret', OWNER, { workspaceId: WS });
    expect(res.status).toBe(200);
    expect(res.body.webhookSecret).toMatch(/^[a-f0-9]{48}$/);
    expect(openSecret(store.github.config.webhookSecret)).toBe(res.body.webhookSecret);
  });

  it('jira: webhook URL carries the token only right after it is generated', async () => {
    const res = await call('PUT', '/api/v2/integrations/jira/config', OWNER, { workspaceId: WS, baseUrl: 'https://acme.atlassian.net/', email: 'a@acme.test', apiToken: 'jira-api' });
    expect(res.body.webhookUrl).toBe(`https://api.example.test/api/v2/integrations/webhook/jira?workspaceId=${WS}&token=${res.body.webhookSecret}`);
    expect(res.body.config.baseUrl).toBe('https://acme.atlassian.net');
    const get = await call('GET', `/api/v2/integrations/jira/config?workspaceId=${WS}`, OWNER);
    expect(get.body.webhookUrl).toMatch(/token=••••$/);
    const member = await call('GET', `/api/v2/integrations/jira/config?workspaceId=${WS}`, MEMBER);
    expect(member.body.webhookUrl).toBeNull();
    expect(member.body.config.email).toBe('••••');
  });

  it('test verifies the GitHub token', async () => {
    mockGithub();
    connectGithub();
    const ok = await call('POST', '/api/v2/integrations/github/test', OWNER, { workspaceId: WS });
    expect(ok.body).toMatchObject({ ok: true, account: { login: 'acme-bot' } });
    const bad = await call('POST', '/api/v2/integrations/github/test', OWNER, { workspaceId: WS, token: 'ghp_wrong' });
    expect(bad.body.ok).toBe(false);
  });

  it('legacy /connect delegates for github', async () => {
    const res = await call('POST', '/api/v2/integrations/connect', OWNER, { workspaceId: WS, type: 'github', config: { token: 'ghp_real' } });
    expect(res.status).toBe(201);
    expect(res.body.integration.config.hasToken).toBe(true);
  });
});

describe('PR viewer proxy', () => {
  beforeEach(() => { mockGithub(); connectGithub(); });

  it('returns PR, files with language and linked tasks to members', async () => {
    const res = await call('GET', `/api/v2/integrations/github/pr?workspaceId=${WS}&repo=acme/web&number=12`, MEMBER);
    expect(res.status).toBe(200);
    expect(res.body.pr).toMatchObject({ number: 12, state: 'open', author: 'octocat', branch: 'feature/login', base: 'main', additions: 12, changedFiles: 3, commits: 2, checks: { status: 'completed', conclusion: 'failure', total: 2, failed: 1 } });
    expect(res.body.files.map(f => f.language)).toEqual(['typescript', 'text', 'text']);
    expect(res.body.files[2].patch).toBeNull();
    expect(res.body.linkedTasks).toEqual([{ id: TASK_ID, issueKey: 'ABC-7', title: 'Login', status: 'review' }]);
  });

  it('refuses non-members (403) and validates input', async () => {
    expect((await call('GET', `/api/v2/integrations/github/pr?workspaceId=${WS}&repo=acme/web&number=12`, OUTSIDER)).status).toBe(403);
    expect((await call('GET', `/api/v2/integrations/github/pr?workspaceId=${WS}&repo=bad&number=12`, MEMBER)).status).toBe(400);
    expect(axios).not.toHaveBeenCalled();
  });

  it('caches a PR for a minute', async () => {
    await call('GET', `/api/v2/integrations/github/pr?workspaceId=${WS}&repo=acme/web&number=12`, MEMBER);
    const calls = axios.mock.calls.length;
    await call('GET', `/api/v2/integrations/github/pr?workspaceId=${WS}&repo=acme/web&number=12`, MEMBER);
    expect(axios.mock.calls.length).toBe(calls);
  });

  it('404 when GitHub is not connected', async () => {
    delete store.github;
    const res = await call('GET', `/api/v2/integrations/github/pr?workspaceId=${WS}&repo=acme/web&number=12`, MEMBER);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INTEGRATION_NOT_CONNECTED');
  });
});

describe('AI PR review', () => {
  beforeEach(() => { mockGithub(); connectGithub(); });

  it('reviews the diff with the own engine, posts a thread reply and notes linked tasks', async () => {
    gateway.chat.mockResolvedValue({ text: '**Summary**: Changes a constant.\n\n**Issues**:\n1. [Medium] `a` changed without tests.' });
    const res = await call('POST', '/api/v2/integrations/github/pr/review', MEMBER, { workspaceId: WS, repo: 'acme/web', number: 12, messageId: '64b0000000000000000000f1' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ risk: 'medium', summary: 'Changes a constant.', filesReviewed: 1, messageId: '64b0000000000000000000f1' });
    expect(res.body.review).toContain('[Medium]');

    const [payload, ctx] = gateway.chat.mock.calls[0];
    expect(payload.message).toContain('```diff');
    expect(payload.message).toContain('src/a.ts');
    expect(payload.message).not.toContain('+++ yarn.lock');
    expect(payload.message).toMatch(/review/i);
    expect(ctx).toMatchObject({ remember: false, tools: 'none', userId: MEMBER });

    expect(bot.postThreadReply).toHaveBeenCalledWith(expect.objectContaining({ senderId: '64b0000000000000000000a9', text: expect.stringContaining('AI review of PR #12') }));
    expect(tasksService.applyExternalUpdate).toHaveBeenCalledWith(TASK_ID, expect.objectContaining({ action: 'ai_note', note: expect.stringContaining('risk medium') }), null);
  });

  it('rate-limits concurrent reviews of the same PR', async () => {
    let release;
    gateway.chat.mockImplementation(() => new Promise((r) => { release = () => r({ text: '**Summary**: ok' }); }));
    const first = call('POST', '/api/v2/integrations/github/pr/review', MEMBER, { workspaceId: WS, repo: 'acme/web', number: 12 });
    await new Promise(r => setTimeout(r, 50));
    const second = await call('POST', '/api/v2/integrations/github/pr/review', MEMBER, { workspaceId: WS, repo: 'acme/web', number: 12 });
    expect(second.status).toBe(429);
    release();
    expect((await first).status).toBe(200);
  });

  it('refuses non-members', async () => {
    const res = await call('POST', '/api/v2/integrations/github/pr/review', OUTSIDER, { workspaceId: WS, repo: 'acme/web', number: 12 });
    expect(res.status).toBe(403);
    expect(gateway.chat).not.toHaveBeenCalled();
  });
});

describe('Jira', () => {
  beforeEach(() => {
    store.jira = { _id: 'int-jira', workspaceId: WS, type: 'jira', status: 'connected', connectedBy: OWNER, config: { baseUrl: 'https://acme.atlassian.net', email: 'a@acme.test', apiToken: sealSecret('jira-api'), webhookToken: sealSecret('tok'), routes: [{ project: '*', channelId: CHANNEL }], linkTasks: true, statusSync: true } };
  });

  it('creates an issue with basic auth and links the task', async () => {
    axios.mockResolvedValue({ data: { id: '10001', key: 'ABC-42' } });
    jest.spyOn(Task, 'findOne').mockImplementation(() => ({ select: () => ({ lean: async () => ({ _id: TASK_ID, issueKey: 'OR-3', visibility: 'workspace', createdBy: OWNER, assignedTo: [] }) }) }));
    const res = await call('POST', '/api/v2/integrations/jira/issue', MEMBER, { workspaceId: WS, projectKey: 'abc', summary: 'Broken login', description: 'Steps', taskId: TASK_ID });
    expect(res.status).toBe(201);
    expect(res.body.issue).toMatchObject({ key: 'ABC-42', url: 'https://acme.atlassian.net/browse/ABC-42' });
    const req = axios.mock.calls[0][0];
    expect(req).toMatchObject({ method: 'post', url: 'https://acme.atlassian.net/rest/api/3/issue', auth: { username: 'a@acme.test', password: 'jira-api' } });
    expect(req.data.fields.project.key).toBe('ABC');
    expect(tasksService.applyExternalUpdate).toHaveBeenCalledWith(TASK_ID, expect.objectContaining({ link: expect.objectContaining({ provider: 'jira', key: 'ABC-42' }) }), undefined);
  });

  it('issue status change syncs linked tasks via the workflow', async () => {
    jest.spyOn(Task, 'find').mockImplementation(() => ({ select: () => ({ lean: async () => [{ _id: TASK_ID, issueKey: 'OR-3' }] }) }));
    const res = await processJiraEvent({
      integration: store.jira,
      payload: {
        webhookEvent: 'jira:issue_updated', user: { displayName: 'Ann' },
        issue: { key: 'ABC-42', fields: { summary: 'Broken login', project: { key: 'ABC' }, status: { name: 'Done', statusCategory: { key: 'done' } } } },
        changelog: { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] },
      },
    });
    expect(res.ok).toBe(true);
    expect(bot.upsertCard).toHaveBeenCalledWith(expect.objectContaining({ provider: 'jira', channelId: CHANNEL, card: expect.objectContaining({ kind: 'jira_issue', key: 'ABC-42', url: 'https://acme.atlassian.net/browse/ABC-42', state: 'Done' }) }));
    expect(tasksService.applyExternalUpdate).toHaveBeenCalledWith(TASK_ID, expect.objectContaining({ status: 'done', note: 'Jira ABC-42 moved to Done by Ann' }), undefined);
  });
});

describe('Zoom', () => {
  it('creates a meeting with Server-to-Server OAuth', async () => {
    store.zoom = { _id: 'int-zoom', workspaceId: WS, type: 'zoom', status: 'connected', config: { accountId: 'acc', clientId: 'cid', clientSecret: sealSecret('csecret') } };
    axios.post = jest.fn(async (url) => {
      if (url.includes('/oauth/token')) return { data: { access_token: 'zoom-at', expires_in: 3600 } };
      return { data: { id: 987, join_url: 'https://zoom.us/j/987', start_url: 'https://zoom.us/s/987', password: 'pw', topic: 'Standup', duration: 15 } };
    });
    const res = await call('POST', '/api/v2/integrations/zoom/meeting', MEMBER, { workspaceId: WS, topic: 'Standup', durationMinutes: 15 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 987, joinUrl: 'https://zoom.us/j/987', startUrl: 'https://zoom.us/s/987', password: 'pw' });
    const [tokenUrl, , tokenOpts] = axios.post.mock.calls[0];
    expect(tokenUrl).toContain('/oauth/token');
    expect(tokenOpts).toMatchObject({ params: { grant_type: 'account_credentials', account_id: 'acc' }, auth: { username: 'cid', password: 'csecret' } });
    const [, body, opts] = axios.post.mock.calls[1];
    expect(body).toMatchObject({ topic: 'Standup', type: 1, duration: 15 });
    expect(opts.headers.Authorization).toBe('Bearer zoom-at');
  });

  it('404 when Zoom is not connected', async () => {
    const res = await call('POST', '/api/v2/integrations/zoom/meeting', MEMBER, { workspaceId: WS, topic: 'x' });
    expect(res.status).toBe(404);
  });
});
