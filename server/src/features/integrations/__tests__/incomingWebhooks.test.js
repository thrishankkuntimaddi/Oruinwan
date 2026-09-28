'use strict';

/**
 * POST /api/v2/integrations/webhook/:type authentication:
 * GitHub HMAC over the raw body, GitLab token header, Jira ?token=, and an
 * active integration for the workspace+type.
 */

process.env.SERVER_KEK = process.env.SERVER_KEK || 'ab'.repeat(32);

const express = require('express');
const http = require('http');
const crypto = require('crypto');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => { req.user = { sub: req.headers['x-user'] }; next(); });
jest.mock('../../../shared/featureFlags', () => ({ requireFlag: () => (req, res, next) => next() }));
jest.mock('../../ai/ai.access', () => ({ requireAIAccess: () => (req, res, next) => next() }));
jest.mock('../integration.service', () => ({ handleWebhook: jest.fn(async () => ({ handled: true })) }));
jest.mock('../ai-provider.service', () => ({}));
jest.mock('../webhook.trigger', () => ({ fire: jest.fn(), sendTest: jest.fn() }));
jest.mock('../../automations/automation.service', () => ({ processEvent: jest.fn() }));
jest.mock('../github/github.events', () => ({ processGithubEvent: jest.fn(async ({ event }) => ({ ok: true, event })) }));
jest.mock('../jira/jira.events', () => ({ processJiraEvent: jest.fn(async () => ({ ok: true, event: 'jira' })) }));

const { sealSecret } = require('../../../modules/conversations/cryptoUtils');
const Integration = require('../integration.model');
const { captureRawBody } = require('../webhook.verify');
const githubEvents = require('../github/github.events');
const jiraEvents = require('../jira/jira.events');
const integrationService = require('../integration.service');
const router = require('../integrations.routes');

const WS = '64b000000000000000000001';
const SECRET = 'gh-webhook-secret';
const JIRA_TOKEN = 'jira-webhook-token';

let integrations;
beforeEach(() => {
  integrations = {
    github: { _id: 'i1', workspaceId: WS, type: 'github', status: 'connected', config: { webhookSecret: sealSecret(SECRET), routes: [] } },
    jira: { _id: 'i2', workspaceId: WS, type: 'jira', status: 'connected', config: { webhookToken: sealSecret(JIRA_TOKEN) } },
    gitlab: { _id: 'i3', workspaceId: WS, type: 'gitlab', status: 'connected', config: { webhookSecret: 'gl-token' } },
  };
  jest.spyOn(Integration, 'findOne').mockImplementation((q) => ({
    lean: async () => (String(q.workspaceId) === WS ? integrations[q.type] || null : null),
  }));
  jest.spyOn(Integration, 'updateOne').mockImplementation(async () => ({}));
});

function post(path, raw, headers = {}) {
  const app = express();
  app.use(express.json({ verify: captureRawBody }));
  app.use('/api/v2/integrations', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({
        port: server.address().port, path, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw), ...headers },
      }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      req.write(raw);
      req.end();
    });
  });
}

const sign = (raw, secret = SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
// Deliberately unusual formatting: the HMAC must be computed over these exact bytes.
const RAW = '{ "action":"opened",  "repository": {"full_name":"acme/web"} }';

describe('GitHub signature', () => {
  it('accepts a valid X-Hub-Signature-256 over the raw body', async () => {
    const res = await post(`/api/v2/integrations/webhook/github?workspaceId=${WS}`, RAW, { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(RAW) });
    expect(res.status).toBe(200);
    expect(githubEvents.processGithubEvent).toHaveBeenCalledTimes(1);
    const arg = githubEvents.processGithubEvent.mock.calls[0][0];
    expect(arg.event).toBe('pull_request');
    expect(arg.payload.repository.full_name).toBe('acme/web');
    expect(String(arg.integration.workspaceId)).toBe(WS);
  });

  it('rejects an invalid signature', async () => {
    const res = await post(`/api/v2/integrations/webhook/github?workspaceId=${WS}`, RAW, { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(RAW, 'wrong') });
    expect(res.status).toBe(401);
    expect(githubEvents.processGithubEvent).not.toHaveBeenCalled();
  });

  it('rejects a signature computed over re-serialized JSON', async () => {
    const res = await post(`/api/v2/integrations/webhook/github?workspaceId=${WS}`, RAW, { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(JSON.stringify(JSON.parse(RAW))) });
    expect(res.status).toBe(401);
  });

  it('rejects a missing signature', async () => {
    const res = await post(`/api/v2/integrations/webhook/github?workspaceId=${WS}`, RAW, { 'x-github-event': 'pull_request' });
    expect(res.status).toBe(401);
    expect(githubEvents.processGithubEvent).not.toHaveBeenCalled();
  });

  it('rejects when the workspace has no connected integration', async () => {
    integrations.github.status = 'disconnected';
    const res = await post(`/api/v2/integrations/webhook/github?workspaceId=${WS}`, RAW, { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(RAW) });
    expect(res.status).toBe(401);
  });

  it('rejects another workspace id and a missing workspace id', async () => {
    const other = await post('/api/v2/integrations/webhook/github?workspaceId=64b000000000000000000009', RAW, { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(RAW) });
    expect(other.status).toBe(401);
    const none = await post('/api/v2/integrations/webhook/github', RAW, { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(RAW) });
    expect(none.status).toBe(401);
    expect(githubEvents.processGithubEvent).not.toHaveBeenCalled();
  });
});

describe('Jira token', () => {
  const body = JSON.stringify({ webhookEvent: 'jira:issue_created', issue: { key: 'ABC-1' } });

  it('accepts the right ?token=', async () => {
    const res = await post(`/api/v2/integrations/webhook/jira?workspaceId=${WS}&token=${JIRA_TOKEN}`, body);
    expect(res.status).toBe(200);
    expect(jiraEvents.processJiraEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong or missing token', async () => {
    expect((await post(`/api/v2/integrations/webhook/jira?workspaceId=${WS}&token=nope`, body)).status).toBe(401);
    expect((await post(`/api/v2/integrations/webhook/jira?workspaceId=${WS}`, body)).status).toBe(401);
    expect(jiraEvents.processJiraEvent).not.toHaveBeenCalled();
  });
});

describe('GitLab token and other providers', () => {
  it('checks X-Gitlab-Token', async () => {
    const body = '{"object_kind":"push"}';
    expect((await post(`/api/v2/integrations/webhook/gitlab?workspaceId=${WS}`, body, { 'x-gitlab-token': 'bad' })).status).toBe(401);
    expect((await post(`/api/v2/integrations/webhook/gitlab?workspaceId=${WS}`, body, { 'x-gitlab-token': 'gl-token' })).status).toBe(200);
    expect(integrationService.handleWebhook).toHaveBeenCalledTimes(1);
  });

  it('rejects providers without a configured token', async () => {
    const res = await post(`/api/v2/integrations/webhook/slack?workspaceId=${WS}`, '{"type":"url_verification","challenge":"c"}');
    expect(res.status).toBe(401);
  });
});
