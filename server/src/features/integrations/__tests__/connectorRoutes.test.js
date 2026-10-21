'use strict';

/**
 * Connector routes and services end to end with Mongo, PostgreSQL identity
 * and HTTP mocked: config save verifies credentials and seals secrets,
 * bridges need the E2EE acknowledgement, webhook results are applied (cards,
 * tasks), the outgoing bridge relays only the sender's own recent message,
 * generic incoming webhooks post bot messages, and actions / attach / import.
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
jest.mock('../../automations/automation.service', () => ({ processEvent: jest.fn() }));
jest.mock('../integration.bot', () => ({
  upsertCard: jest.fn(async () => ({ message: { _id: 'msg-1' }, created: true })),
  getBotUser: jest.fn(async (p) => ({ _id: `bot-${p}` })),
  loadPostableChannel: jest.fn(async (ws, id) => (String(id) === '64b0000000000000000000d1' ? { _id: id, workspace: ws, name: 'dev' } : null)),
}));
jest.mock('../integration.tasks', () => ({
  ...jest.requireActual('../integration.tasks'),
  findTasksByKeys: jest.fn(async () => []),
  findTasksByLinkUrl: jest.fn(async () => []),
  applyToTasks: jest.fn(async (tasks) => tasks.map(t => ({ id: String(t._id), issueKey: t.issueKey }))),
}));
jest.mock('../../tasks/tasks.query', () => ({ create: jest.fn(async (d) => ({ _id: '64b0000000000000000000e9', issueKey: 'ABC-9', ...d })) }));
jest.mock('../../tasks/tasks.shared', () => ({ emitToTaskAudience: jest.fn(), loadTaskForClient: jest.fn(), canViewTask: () => true }));
jest.mock('../../tasks/tasks.service', () => ({ applyExternalUpdate: jest.fn(async () => ({ statusChanged: false })) }));
jest.mock('../../knowledge/knowledge.service', () => ({ createPage: jest.fn(async (u, ws, d) => ({ page: { _id: 'page-1', ...d } })) }));
jest.mock('../github/github.service', () => ({
  ...jest.requireActual('../github/github.service'),
  loadVisibleTask: jest.fn(async (ws, id) => ({ _id: id, issueKey: 'ABC-7' })),
}));
jest.mock('../../../identity/workspaces.repo', () => ({
  ...jest.requireActual('../../../identity/workspaces.repo'),
  findById: jest.fn(async (id) => (String(id) === '64b000000000000000000001' ? {
    _id: '64b000000000000000000001', name: 'Acme', isActive: true, isArchived: false, company: null,
    members: [{ user: '64b0000000000000000000a1', role: 'owner', status: 'active' }, { user: '64b0000000000000000000b1', role: 'member', status: 'active' }],
  } : null)),
}));
jest.mock('../../../identity/users.repo', () => ({
  ...jest.requireActual('../../../identity/users.repo'),
  findById: jest.fn(async (id) => ({ _id: String(id), username: String(id).endsWith('a1') ? 'ann' : 'bob' })),
}));

const crypto = require('crypto');
const axios = require('axios');
const Integration = require('../integration.model');
const IncomingWebhook = require('../incomingWebhook.model');
const Channel = require('../../channels/channel.model.js');
const Message = require('../../../modules/messages/message.model.js');
const bot = require('../integration.bot');
const links = require('../integration.tasks');
const Tasks = require('../../tasks/tasks.query');
const tasksService = require('../../tasks/tasks.service');
const knowledge = require('../../knowledge/knowledge.service');
const automations = require('../../automations/automation.service');
const { sealSecret, openSecret } = require('../../../modules/conversations/cryptoUtils');
const { captureRawBody } = require('../webhook.verify');
const connectorService = require('../integration.connectors.service');
const router = require('../integrations.routes');

const WS = '64b000000000000000000001';
const OWNER = '64b0000000000000000000a1';
const MEMBER = '64b0000000000000000000b1';
const CHANNEL = '64b0000000000000000000d1';
const MSG = '64b0000000000000000000f1';
const TASK = '64b0000000000000000000e1';

let store;
let hooks;
beforeEach(() => {
  store = {};
  hooks = {};
  connectorService._relayed.clear();
  jest.spyOn(Integration, 'findOne').mockImplementation((q) => ({ lean: async () => (String(q.workspaceId) === WS ? store[q.type] || null : null) }));
  jest.spyOn(Integration, 'find').mockImplementation((q) => {
    const list = Object.values(store).filter(i => String(i.workspaceId) === String(q.workspaceId) && (!q.type?.$in || q.type.$in.includes(i.type)) && (!q.status || i.status === q.status));
    return { lean: async () => list, select: () => ({ lean: async () => list }) };
  });
  jest.spyOn(Integration, 'findOneAndUpdate').mockImplementation((q, update) => ({
    lean: async () => {
      store[q.type] = { _id: `int-${q.type}`, workspaceId: WS, type: q.type, ...(store[q.type] || {}), ...update };
      return store[q.type];
    },
  }));
  jest.spyOn(Integration, 'updateOne').mockImplementation(async () => ({}));
  jest.spyOn(Channel, 'find').mockImplementation((q) => ({ select: () => ({ lean: async () => [{ _id: CHANNEL }].filter(c => !q._id || q._id.$in.includes(String(c._id))) }) }));
  jest.spyOn(Channel, 'findOne').mockImplementation((q) => ({ select: () => ({ lean: async () => (String(q._id) === CHANNEL && q['members.user'] === OWNER ? { _id: CHANNEL, name: 'dev' } : null) }) }));
  jest.spyOn(Message, 'findOne').mockImplementation((q) => ({ select: () => ({ lean: async () => (String(q._id) === MSG && q.sender === OWNER ? { _id: MSG, createdAt: new Date() } : null) }) }));
  jest.spyOn(IncomingWebhook, 'create').mockImplementation(async (d) => { const h = { _id: '64b0000000000000000000c7', ...d }; hooks[h._id] = h; return { ...h, toObject: () => h }; });
  jest.spyOn(IncomingWebhook, 'countDocuments').mockImplementation(async () => Object.keys(hooks).length);
  jest.spyOn(IncomingWebhook, 'findById').mockImplementation((id) => ({ lean: async () => hooks[String(id)] || null }));
  jest.spyOn(IncomingWebhook, 'updateOne').mockImplementation(async () => ({}));
});
afterEach(() => jest.restoreAllMocks());

function call(method, path, { user, body, raw, headers = {} } = {}) {
  const app = express();
  app.use(express.json({ verify: captureRawBody }));
  app.use('/api/v2/integrations', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = raw ?? (body ? JSON.stringify(body) : null);
      const req = http.request({
        port: server.address().port, path, method,
        headers: { ...(user && { 'x-user': user }), 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}), ...headers },
      }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => {
          server.close();
          let parsed = text;
          try { parsed = JSON.parse(text); } catch { /* text */ }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (data) req.write(data);
      req.end();
    });
  });
}

describe('catalog and config', () => {
  it('lists connectors for members', async () => {
    const res = await call('GET', `/api/v2/integrations/catalog?workspaceId=${WS}`, { user: MEMBER });
    expect(res.status).toBe(200);
    expect(res.body.connectors.map(c => c.type)).toContain('slack');
    expect(res.body.connectors.find(c => c.type === 'gitlab').form[1]).toMatchObject({ key: 'token', secret: true });
  });

  it('does not save credentials the provider rejects', async () => {
    axios.mockRejectedValue({ response: { status: 401, data: { message: '401 Unauthorized' } } });
    const res = await call('PUT', '/api/v2/integrations/gitlab/config', { user: OWNER, body: { workspaceId: WS, token: 'bad' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/could not verify/);
    expect(Integration.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('verifies, seals the token, reveals the webhook secret once and redacts for members', async () => {
    axios.mockResolvedValue({ data: { username: 'ann', name: 'Ann' } });
    const res = await call('PUT', '/api/v2/integrations/gitlab/config', { user: OWNER, body: { workspaceId: WS, token: 'glpat-real', routes: [{ match: 'Acme/Web', channelId: CHANNEL }] } });
    expect(res.status).toBe(200);
    expect(res.body.config).toMatchObject({ token: '••••', hasToken: true, hasWebhookSecret: true, account: { login: 'ann' } });
    expect(res.body.config.routes[0]).toMatchObject({ match: 'acme/web', events: ['issues', 'merge_requests', 'push', 'pipeline'] });
    expect(res.body.webhookSecret).toMatch(/^[a-f0-9]{48}$/);
    expect(res.body.webhookUrl).toBe(`https://api.example.test/api/v2/integrations/webhook/gitlab?workspaceId=${WS}`);
    expect(openSecret(store.gitlab.config.token)).toBe('glpat-real');
    const again = await call('GET', `/api/v2/integrations/gitlab/config?workspaceId=${WS}`, { user: MEMBER });
    expect(again.body.webhookSecret).toBeUndefined();
    expect(again.body.webhookUrl).toBeNull();
    expect(again.body.config.routes).toBeUndefined();
  });

  it('members cannot change config', async () => {
    const res = await call('PUT', '/api/v2/integrations/gitlab/config', { user: MEMBER, body: { workspaceId: WS, token: 'x' } });
    expect(res.status).toBe(403);
  });

  it('test endpoint reports the provider answer without saving', async () => {
    axios.mockResolvedValue({ data: { ok: true, user: 'bot', team: 'Acme' } });
    const res = await call('POST', '/api/v2/integrations/slack/test', { user: OWNER, body: { workspaceId: WS, botToken: 'xoxb-1' } });
    expect(res.body).toMatchObject({ ok: true, account: { team: 'Acme' } });
    expect(Integration.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('outgoing bridges need the end-to-end-encryption acknowledgement', async () => {
    axios.mockResolvedValue({ data: { ok: true, user: 'bot' } });
    const no = await call('PUT', '/api/v2/integrations/slack/config', { user: OWNER, body: { workspaceId: WS, botToken: 'xoxb-1', bridges: [{ remote: 'C111', channelId: CHANNEL, direction: 'both' }] } });
    expect(no.status).toBe(400);
    expect(no.body.code).toBe('BRIDGE_ACK_REQUIRED');
    const yes = await call('PUT', '/api/v2/integrations/slack/config', { user: OWNER, body: { workspaceId: WS, botToken: 'xoxb-1', bridges: [{ remote: 'C111', channelId: CHANNEL, direction: 'both', acknowledgeOutgoing: true }] } });
    expect(yes.status).toBe(200);
    expect(store.slack.config.bridges[0]).toMatchObject({ remote: 'C111', direction: 'both', outEnabledBy: OWNER });
    // Unchanged on later saves without re-acknowledging.
    const later = await call('PUT', '/api/v2/integrations/slack/config', { user: OWNER, body: { workspaceId: WS, bridges: [{ remote: 'C111', channelId: CHANNEL, direction: 'both' }] } });
    expect(later.status).toBe(200);
    const bad = await call('PUT', '/api/v2/integrations/slack/config', { user: OWNER, body: { workspaceId: WS, bridges: [{ remote: 'C111', channelId: '64b0000000000000000000dd', direction: 'in' }] } });
    expect(bad.status).toBe(400);
  });
});

describe('incoming provider webhooks are applied', () => {
  function connectGitlab(extra = {}) {
    store.gitlab = { _id: 'int-gitlab', workspaceId: WS, type: 'gitlab', status: 'connected', connectedBy: OWNER, config: { token: sealSecret('t'), webhookSecret: sealSecret('whs'), routes: [{ match: 'acme/web', channelId: CHANNEL }], linkTasks: true, statusSync: true, ...extra } };
  }
  const issue = JSON.stringify({ project: { path_with_namespace: 'acme/web' }, object_attributes: { iid: 3, action: 'open', url: 'https://g/acme/web/-/issues/3', title: 'Crash' } });

  it('posts the card and creates a task when createTasks is on', async () => {
    connectGitlab({ createTasks: true });
    const res = await call('POST', `/api/v2/integrations/webhook/gitlab?workspaceId=${WS}`, { raw: issue, headers: { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'whs' } });
    expect(res.status).toBe(200);
    expect(Tasks.create).toHaveBeenCalledWith(expect.objectContaining({ title: '[acme/web#3] Crash', channel: CHANNEL, createdBy: OWNER, externalLinks: [expect.objectContaining({ provider: 'gitlab', url: 'https://g/acme/web/-/issues/3' })] }));
    expect(bot.upsertCard).toHaveBeenCalledWith(expect.objectContaining({ channelId: CHANNEL, provider: 'gitlab', card: expect.objectContaining({ kind: 'issue', taskKeys: ['ABC-9'] }) }));
    expect(res.body.createdTasks).toEqual([{ id: '64b0000000000000000000e9', issueKey: 'ABC-9' }]);
    expect(automations.processEvent).toHaveBeenCalledWith('webhook.received', expect.objectContaining({ webhookType: 'gitlab' }), undefined);
  });

  it('only posts the card when createTasks is off, and rejects a bad token', async () => {
    connectGitlab();
    await call('POST', `/api/v2/integrations/webhook/gitlab?workspaceId=${WS}`, { raw: issue, headers: { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'whs' } });
    expect(Tasks.create).not.toHaveBeenCalled();
    expect(bot.upsertCard).toHaveBeenCalledTimes(1);
    const bad = await call('POST', `/api/v2/integrations/webhook/gitlab?workspaceId=${WS}`, { raw: issue, headers: { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'nope' } });
    expect(bad.status).toBe(401);
  });

  it('links tasks named in a merged MR and moves them', async () => {
    connectGitlab();
    links.findTasksByKeys.mockResolvedValueOnce([{ _id: TASK, issueKey: 'ABC-7' }]);
    const mr = JSON.stringify({ project: { path_with_namespace: 'acme/web' }, object_attributes: { iid: 8, action: 'merge', state: 'merged', url: 'https://g/mr/8', title: 'ABC-7 fix', source_branch: 'abc-7' } });
    await call('POST', `/api/v2/integrations/webhook/gitlab?workspaceId=${WS}`, { raw: mr, headers: { 'x-gitlab-event': 'Merge Request Hook', 'x-gitlab-token': 'whs' } });
    expect(links.findTasksByKeys).toHaveBeenCalledWith(WS, ['ABC-7']);
    expect(links.applyToTasks).toHaveBeenCalledWith([{ _id: TASK, issueKey: 'ABC-7' }], expect.objectContaining({ status: 'done', statusSync: true, link: expect.objectContaining({ provider: 'gitlab', number: 8 }) }));
  });

  it('CI builds go to the default channel and to automations with the normalised build', async () => {
    store.cicd = { _id: 'int-cicd', workspaceId: WS, type: 'cicd', status: 'connected', config: { webhookToken: sealSecret('citok'), notifyOn: 'finished', routes: [], defaultChannelId: CHANNEL } };
    const res = await call('POST', `/api/v2/integrations/webhook/cicd?workspaceId=${WS}&token=citok`, { raw: JSON.stringify({ name: 'deploy', status: 'failed', branch: 'main' }) });
    expect(res.status).toBe(200);
    expect(bot.upsertCard).toHaveBeenCalledWith(expect.objectContaining({ channelId: CHANNEL, provider: 'cicd', card: expect.objectContaining({ kind: 'checks', state: 'failure' }) }));
    expect(automations.processEvent).toHaveBeenCalledWith('webhook.received', expect.objectContaining({ webhookType: 'cicd', event: expect.objectContaining({ status: 'failure', pipeline: 'deploy' }) }), undefined);
  });

  it('answers the Slack url_verification challenge only when signed', async () => {
    store.slack = { _id: 'int-slack', workspaceId: WS, type: 'slack', status: 'connected', config: { signingSecret: sealSecret('ssec'), bridges: [] } };
    const raw = JSON.stringify({ type: 'url_verification', challenge: 'xyz' });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `v0=${crypto.createHmac('sha256', 'ssec').update(`v0:${ts}:${raw}`).digest('hex')}`;
    const ok = await call('POST', `/api/v2/integrations/webhook/slack?workspaceId=${WS}`, { raw, headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': sig } });
    expect(ok.body).toEqual({ challenge: 'xyz' });
    const bad = await call('POST', `/api/v2/integrations/webhook/slack?workspaceId=${WS}`, { raw, headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': 'v0=00' } });
    expect(bad.status).toBe(401);
  });

  it('returns the Teams reply body', async () => {
    const token = Buffer.from('a-very-secret-teams-token-1234567').toString('base64');
    store.teams = { _id: 'int-teams', workspaceId: WS, type: 'teams', status: 'connected', config: { outgoingSecret: sealSecret(token), bridges: [{ remote: '*', channelId: CHANNEL, direction: 'in' }] } };
    const raw = JSON.stringify({ type: 'message', id: '1', text: '<at>Oruinwan</at> hello', from: { name: 'Cy' } });
    const sig = crypto.createHmac('sha256', Buffer.from(token, 'base64')).update(raw).digest('base64');
    const res = await call('POST', `/api/v2/integrations/webhook/teams?workspaceId=${WS}`, { raw, headers: { authorization: `HMAC ${sig}` } });
    expect(res.body).toEqual({ type: 'message', text: 'Posted to Oruinwan.' });
    expect(bot.upsertCard).toHaveBeenCalledWith(expect.objectContaining({ provider: 'teams', summary: 'hello' }));
  });

  it('unknown webhook types are 404', async () => {
    expect((await call('POST', `/api/v2/integrations/webhook/nope?workspaceId=${WS}`, { raw: '{}' })).status).toBe(404);
  });
});

describe('outgoing bridge relay', () => {
  beforeEach(() => {
    store.slack = { _id: 'int-slack', workspaceId: WS, type: 'slack', status: 'connected', config: { botToken: sealSecret('xoxb-1'), bridges: [{ remote: 'C111', channelId: CHANNEL, direction: 'out', outEnabledAt: new Date(), outEnabledBy: OWNER }] } };
  });

  it('lists bridged channels for members', async () => {
    const res = await call('GET', `/api/v2/integrations/bridge/channels?workspaceId=${WS}`, { user: MEMBER });
    expect(res.body.channels).toEqual([{ channelId: CHANNEL, outgoing: true, providers: [{ type: 'slack', label: 'Slack', direction: 'out' }] }]);
  });

  it('relays the sender\'s own recent message once', async () => {
    axios.mockResolvedValue({ data: { ok: true } });
    const res = await call('POST', '/api/v2/integrations/bridge/relay', { user: OWNER, body: { workspaceId: WS, channelId: CHANNEL, messageId: MSG, text: 'ship it' } });
    expect(res.body.relayed).toEqual([{ type: 'slack', via: 'bot' }]);
    expect(axios.mock.calls[0][0]).toMatchObject({ url: 'https://slack.com/api/chat.postMessage', data: { channel: 'C111', text: 'ship it', username: 'ann (Oruinwan)' } });
    const again = await call('POST', '/api/v2/integrations/bridge/relay', { user: OWNER, body: { workspaceId: WS, channelId: CHANNEL, messageId: MSG, text: 'ship it' } });
    expect(again.body.duplicate).toBe(true);
  });

  it('refuses someone else\'s message', async () => {
    const res = await call('POST', '/api/v2/integrations/bridge/relay', { user: MEMBER, body: { workspaceId: WS, channelId: CHANNEL, messageId: MSG, text: 'x' } });
    expect(res.status).toBe(404);
    expect(axios).not.toHaveBeenCalled();
  });

  it('does nothing for a channel without an acknowledged outgoing bridge', async () => {
    store.slack.config.bridges[0].outEnabledAt = null;
    const res = await call('POST', '/api/v2/integrations/bridge/relay', { user: OWNER, body: { workspaceId: WS, channelId: CHANNEL, messageId: MSG, text: 'x' } });
    expect(res.body).toEqual({ relayed: [], failed: [] });
  });
});

describe('generic incoming webhooks', () => {
  it('admins create a secret URL; posting {text} makes a bot message marked not E2EE', async () => {
    const created = await call('POST', '/api/v2/integrations/incoming-webhooks', { user: OWNER, body: { workspaceId: WS, channelId: CHANNEL, name: 'Deploys' } });
    expect(created.status).toBe(201);
    const url = created.body.webhook.url;
    expect(url).toMatch(/^https:\/\/api\.example\.test\/api\/v2\/integrations\/hooks\/64b0000000000000000000c7\/[a-f0-9]{48}$/);
    const path = new URL(url).pathname;
    const res = await call('POST', path, { raw: JSON.stringify({ text: 'v2.3 is <https://x.io|live>', username: 'CI' }) });
    expect(res.status).toBe(200);
    expect(res.body).toBe('ok');
    expect(bot.upsertCard).toHaveBeenCalledWith(expect.objectContaining({
      channelId: CHANNEL, provider: 'webhook', dedupe: false, summary: 'v2.3 is live (https://x.io)',
      card: expect.objectContaining({ kind: 'message', author: 'CI', extra: expect.objectContaining({ notE2EE: true }) }),
    }));
    const wrong = await call('POST', path.replace(/[a-f0-9]{48}$/, 'f'.repeat(48)), { raw: '{"text":"x"}' });
    expect(wrong.status).toBe(404);
    const empty = await call('POST', path, { raw: '{}' });
    expect(empty.body).toBe('no_text');
  });

  it('members cannot manage them; channels must be in the workspace', async () => {
    expect((await call('POST', '/api/v2/integrations/incoming-webhooks', { user: MEMBER, body: { workspaceId: WS, channelId: CHANNEL, name: 'x' } })).status).toBe(403);
    expect((await call('POST', '/api/v2/integrations/incoming-webhooks', { user: OWNER, body: { workspaceId: WS, channelId: '64b0000000000000000000dd', name: 'x' } })).status).toBe(400);
  });
});

describe('actions, attach and import', () => {
  it('runs a list action and creates an issue linked to a task', async () => {
    store.gitlab = { _id: 'int-gitlab', workspaceId: WS, type: 'gitlab', status: 'connected', config: { token: sealSecret('t'), baseUrl: 'https://gitlab.com' } };
    axios.mockResolvedValueOnce({ data: [{ id: 1, path_with_namespace: 'acme/web', name: 'web' }] });
    const list = await call('GET', `/api/v2/integrations/gitlab/actions/projects?workspaceId=${WS}&q=web`, { user: MEMBER });
    expect(list.body.projects[0].path).toBe('acme/web');
    axios.mockResolvedValueOnce({ data: { id: 5, iid: 2, web_url: 'https://gitlab.com/acme/web/-/issues/2', title: 'Bug', references: { full: 'acme/web#2' } } });
    const created = await call('POST', '/api/v2/integrations/gitlab/actions/issue', { user: MEMBER, body: { workspaceId: WS, project: 'acme/web', title: 'Bug', taskId: TASK } });
    expect(created.body.issue.number).toBe(2);
    expect(created.body.task).toEqual({ id: TASK, issueKey: 'ABC-7' });
    expect(tasksService.applyExternalUpdate).toHaveBeenCalledWith(TASK, expect.objectContaining({ link: expect.objectContaining({ provider: 'gitlab', kind: 'issue' }) }), undefined);
  });

  it('not-connected and unknown actions fail clearly', async () => {
    const res = await call('GET', `/api/v2/integrations/notion/actions/search?workspaceId=${WS}`, { user: MEMBER });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INTEGRATION_NOT_CONNECTED');
    store.notion = { workspaceId: WS, type: 'notion', status: 'connected', config: { token: sealSecret('n') } };
    expect((await call('GET', `/api/v2/integrations/notion/actions/nope?workspaceId=${WS}`, { user: MEMBER })).status).toBe(404);
  });

  it('admin-only actions are refused for members', async () => {
    store.teams = { workspaceId: WS, type: 'teams', status: 'connected', config: { webhookUrl: sealSecret('https://a.webhook.office.com/x') } };
    expect((await call('POST', '/api/v2/integrations/teams/actions/send-test', { user: MEMBER, body: { workspaceId: WS } })).status).toBe(403);
  });

  it('attaches a Drive file to a task with the link fetched by id', async () => {
    store.google_drive = { workspaceId: WS, type: 'google_drive', status: 'connected', config: { accessToken: sealSecret('ya29.x') } };
    axios.mockResolvedValueOnce({ data: { id: 'f1', name: 'Plan.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/f1/view' } });
    const res = await call('POST', '/api/v2/integrations/google_drive/attach', { user: MEMBER, body: { workspaceId: WS, itemId: 'f1', taskId: TASK } });
    expect(res.status).toBe(200);
    expect(tasksService.applyExternalUpdate).toHaveBeenCalledWith(TASK, expect.objectContaining({ link: expect.objectContaining({ provider: 'google_drive', kind: 'file', url: 'https://drive.google.com/file/d/f1/view', title: 'Plan.pdf' }) }), undefined);
  });

  it('imports a Notion page into Knowledge as the caller', async () => {
    store.notion = { workspaceId: WS, type: 'notion', status: 'connected', config: { token: sealSecret('n') } };
    const id = '0123456789abcdef0123456789abcdef';
    axios.mockResolvedValueOnce({ data: { object: 'page', id, url: 'https://notion.so/p', properties: { title: { type: 'title', title: [{ plain_text: 'Onboarding' }] } } } })
      .mockResolvedValueOnce({ data: { results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Welcome' }] } }] } });
    const res = await call('POST', '/api/v2/integrations/notion/import', { user: MEMBER, body: { workspaceId: WS, id } });
    expect(res.status).toBe(201);
    expect(knowledge.createPage).toHaveBeenCalledWith(MEMBER, WS, expect.objectContaining({ title: 'Onboarding', tags: ['notion'], content: expect.stringMatching(/^Welcome\n\n---\n_Imported from \[Notion\]\(https:\/\/notion.so\/p\)/) }));
  });
});
