'use strict';

/**
 * Token-based connectors with a mocked HTTP layer: credential checks call the
 * real provider endpoints with the right auth, webhook signatures are
 * verified, and payloads are parsed into the effects that get applied.
 */

process.env.SERVER_KEK = process.env.SERVER_KEK || 'ab'.repeat(32);

jest.mock('axios');

const crypto = require('crypto');
const axios = require('axios');
const { sealSecret } = require('../../../modules/conversations/cryptoUtils');
const { readSecret } = require('../integration.config');
const { CONNECTORS, describe: describeConnector } = require('../connectors/registry');
const { mapError } = require('../connectors/http');
const { buildStatus } = require('../connectors/common');
const google = require('../connectors/google');

const ctx = (config) => ({ integration: null, config, secret: (f) => readSecret(config, f) });
const sealed = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, sealSecret(v)]));
const reqOf = ({ raw = '{}', headers = {}, query = {} } = {}) => ({
  rawBody: Buffer.from(raw), body: JSON.parse(raw), query,
  headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  get(name) { return this.headers[name.toLowerCase()]; },
});
const hmac = (secret, body, enc = 'hex') => crypto.createHmac('sha256', secret).update(body).digest(enc);
const lastCall = () => axios.mock.calls[axios.mock.calls.length - 1][0];

beforeEach(() => { axios.mockReset(); axios.post.mockReset(); google.clearCache(); });

describe('registry', () => {
  it('describes every connector for the settings UI without secrets or functions', () => {
    for (const c of Object.values(CONNECTORS)) {
      const d = describeConnector(c);
      expect(d.type).toBe(c.type);
      expect(Array.isArray(d.setup) && d.setup.length).toBeTruthy();
      expect(JSON.stringify(d)).not.toMatch(/function/);
    }
    expect(Object.keys(CONNECTORS).sort()).toEqual(['bitbucket', 'cicd', 'confluence', 'dropbox', 'gitlab', 'google_drive', 'google_meet', 'linear', 'make', 'n8n', 'notion', 'onedrive', 'slack', 'teams', 'zapier']);
  });

  it('maps provider errors to safe messages', () => {
    expect(mapError({ response: { status: 401 } }, 'X', 'X').code).toBe('X_BAD_TOKEN');
    expect(mapError({ response: { status: 404 } }, 'X', 'X').statusCode).toBe(404);
    expect(mapError({ response: { status: 422, data: { message: 'bad title' } } }, 'X', 'X').message).toMatch(/bad title/);
    expect(mapError({ message: 'ECONNRESET' }, 'X', 'X').statusCode).toBe(502);
  });

  it('normalises build statuses', () => {
    expect(buildStatus('SUCCESS')).toBe('success');
    expect(buildStatus('failed')).toBe('failure');
    expect(buildStatus('in_progress')).toBe('running');
    expect(buildStatus('aborted')).toBe('cancelled');
  });
});

describe('GitLab', () => {
  const gl = CONNECTORS.gitlab;
  const config = { baseUrl: 'https://git.example.com', ...sealed({ token: 'glpat-1', webhookSecret: 'whs' }), routes: [{ match: 'acme/web', channelId: 'c1' }] };

  it('tests the token against /api/v4/user with PRIVATE-TOKEN', async () => {
    axios.mockResolvedValue({ data: { username: 'ann', name: 'Ann' } });
    const r = await gl.test(ctx(config));
    expect(r.account.login).toBe('ann');
    expect(lastCall()).toMatchObject({ method: 'get', url: 'https://git.example.com/api/v4/user', headers: { 'PRIVATE-TOKEN': 'glpat-1' } });
  });

  it('lists projects and creates an issue', async () => {
    axios.mockResolvedValueOnce({ data: [{ id: 1, path_with_namespace: 'acme/web', name: 'web', web_url: 'https://git.example.com/acme/web' }] });
    expect((await gl.actions.projects.run(ctx(config), { q: 'we' })).projects[0].path).toBe('acme/web');
    expect(lastCall().params.search).toBe('we');
    axios.mockResolvedValueOnce({ data: { id: 9, iid: 4, web_url: 'https://git.example.com/acme/web/-/issues/4', title: 'Bug', references: { full: 'acme/web#4' } } });
    const r = await gl.actions.issue.run(ctx(config), { project: 'acme/web', title: 'Bug', description: 'x' }, { user: { name: 'Ann' } });
    expect(lastCall()).toMatchObject({ method: 'post', url: 'https://git.example.com/api/v4/projects/acme%2Fweb/issues' });
    expect(lastCall().data.description).toMatch(/Created from Oruinwan by Ann/);
    expect(r.link).toMatchObject({ provider: 'gitlab', kind: 'issue', number: 4, repo: 'acme/web' });
  });

  it('verifies X-Gitlab-Token', () => {
    expect(gl.verifyWebhook(reqOf({ headers: { 'x-gitlab-token': 'whs' } }), ctx(config)).ok).toBe(true);
    expect(gl.verifyWebhook(reqOf({ headers: { 'x-gitlab-token': 'nope' } }), ctx(config)).ok).toBe(false);
    expect(gl.verifyWebhook(reqOf(), ctx(config)).ok).toBe(false);
  });

  it('parses merge requests into a card and task links, issues into tasks and status moves', () => {
    const mr = gl.parseWebhook({
      headers: { 'x-gitlab-event': 'Merge Request Hook' },
      payload: { project: { path_with_namespace: 'acme/web' }, user: { username: 'ann' }, object_attributes: { iid: 7, action: 'merge', state: 'merged', url: 'u7', title: 'ABC-12 login', source_branch: 'feat/abc-12', target_branch: 'main' } },
    });
    expect(mr.find(e => e.type === 'card').card).toMatchObject({ kind: 'pull_request', state: 'merged', number: 7 });
    expect(mr.find(e => e.type === 'task.link')).toMatchObject({ status: 'done', texts: ['ABC-12 login', 'feat/abc-12', undefined] });
    const open = gl.parseWebhook({ headers: { 'x-gitlab-event': 'Issue Hook' }, payload: { project: { path_with_namespace: 'acme/web' }, object_attributes: { iid: 3, action: 'open', url: 'u3', title: 'Crash' } } });
    expect(open.map(e => e.type)).toEqual(['card', 'task.create']);
    const close = gl.parseWebhook({ headers: { 'x-gitlab-event': 'Issue Hook' }, payload: { project: { path_with_namespace: 'acme/web' }, object_attributes: { iid: 3, action: 'close', state: 'closed', url: 'u3', title: 'Crash' } } });
    expect(close.find(e => e.type === 'task.status')).toMatchObject({ url: 'u3', status: 'done' });
    const pipe = gl.parseWebhook({ headers: { 'x-gitlab-event': 'Pipeline Hook' }, payload: { project: { path_with_namespace: 'acme/web', web_url: 'https://g/acme/web' }, object_attributes: { id: 5, status: 'failed', ref: 'main' } } });
    expect(pipe[0].card.checks).toMatchObject({ conclusion: 'failure', url: 'https://g/acme/web/-/pipelines/5' });
  });
});

describe('Bitbucket', () => {
  const bb = CONNECTORS.bitbucket;
  const config = { username: 'ann', ...sealed({ apiToken: 'app-pw', webhookSecret: 'bbs' }) };

  it('uses Basic auth with a username and Bearer without one', async () => {
    axios.mockResolvedValue({ data: { username: 'ann', display_name: 'Ann' } });
    await bb.test(ctx(config));
    expect(lastCall()).toMatchObject({ url: 'https://api.bitbucket.org/2.0/user', auth: { username: 'ann', password: 'app-pw' } });
    axios.mockResolvedValue({ data: { size: 3, values: [] } });
    await bb.test(ctx({ ...config, username: '' }));
    expect(lastCall().headers.Authorization).toBe('Bearer app-pw');
  });

  it('creates an issue in a repository', async () => {
    axios.mockResolvedValue({ data: { id: 12, title: 'T', links: { html: { href: 'https://bitbucket.org/acme/web/issues/12' } } } });
    const r = await bb.actions.issue.run(ctx(config), { repo: 'acme/web', title: 'T' }, {});
    expect(lastCall()).toMatchObject({ method: 'post', url: 'https://api.bitbucket.org/2.0/repositories/acme/web/issues' });
    expect(r.link.url).toBe('https://bitbucket.org/acme/web/issues/12');
    await expect(bb.actions.issue.run(ctx(config), { repo: 'not a repo', title: 'T' }, {})).rejects.toThrow(/workspace\/repository/);
  });

  it('verifies the sha256 signature', () => {
    const raw = '{"a":1}';
    expect(bb.verifyWebhook(reqOf({ raw, headers: { 'x-hub-signature': `sha256=${hmac('bbs', raw)}` } }), ctx(config)).ok).toBe(true);
    expect(bb.verifyWebhook(reqOf({ raw, headers: { 'x-hub-signature': `sha256=${hmac('x', raw)}` } }), ctx(config)).ok).toBe(false);
  });

  it('parses pull requests, pushes and build statuses', () => {
    const pr = bb.parseWebhook({ headers: { 'x-event-key': 'pullrequest:fulfilled' }, payload: { repository: { full_name: 'acme/web' }, pullrequest: { id: 3, state: 'MERGED', title: 'ABC-1', links: { html: { href: 'p3' } }, source: { branch: { name: 'b' } } } } });
    expect(pr[0].card.state).toBe('merged');
    expect(pr[1]).toMatchObject({ type: 'task.link', status: 'done' });
    const push = bb.parseWebhook({ headers: { 'x-event-key': 'repo:push' }, payload: { repository: { full_name: 'acme/web' }, push: { changes: [{ new: { type: 'branch', name: 'main' }, commits: [{ hash: 'h', message: 'fix' }] }] } } });
    expect(push[0].card).toMatchObject({ kind: 'push', branch: 'main' });
    const build = bb.parseWebhook({ headers: { 'x-event-key': 'repo:commit_status_updated' }, payload: { repository: { full_name: 'acme/web' }, commit_status: { state: 'FAILED', name: 'CI', url: 'https://ci' } } });
    expect(build[0].card.checks.conclusion).toBe('failure');
  });
});

describe('Linear', () => {
  const ln = CONNECTORS.linear;
  const config = sealed({ apiKey: 'lin_api_1', webhookSecret: 'lws' });

  it('tests with GraphQL and the raw API key', async () => {
    axios.mockResolvedValue({ data: { data: { viewer: { name: 'Ann', email: 'a@x' }, organization: { name: 'Acme' } } } });
    const r = await ln.test(ctx(config));
    expect(r.account).toMatchObject({ name: 'Ann', organization: 'Acme' });
    expect(lastCall()).toMatchObject({ url: 'https://api.linear.app/graphql', headers: { Authorization: 'lin_api_1' } });
  });

  it('reports GraphQL auth errors as a bad token', async () => {
    axios.mockResolvedValue({ data: { errors: [{ message: 'Authentication required', extensions: { code: 'AUTHENTICATION_ERROR' } }] } });
    await expect(ln.test(ctx(config))).rejects.toMatchObject({ code: 'LINEAR_BAD_TOKEN' });
  });

  it('creates an issue, resolving a team key', async () => {
    axios
      .mockResolvedValueOnce({ data: { data: { teams: { nodes: [{ id: 'team-1' }] } } } })
      .mockResolvedValueOnce({ data: { data: { issueCreate: { success: true, issue: { id: 'i', identifier: 'ENG-5', title: 'T', url: 'https://linear.app/x/ENG-5', team: { key: 'ENG' } } } } } });
    const r = await ln.actions.issue.run(ctx(config), { team: 'eng', title: 'T' }, {});
    expect(lastCall().data.variables.input.teamId).toBe('team-1');
    expect(r.link).toMatchObject({ provider: 'linear', key: 'ENG-5' });
  });

  it('verifies Linear-Signature and the timestamp', () => {
    const raw = JSON.stringify({ type: 'Issue', webhookTimestamp: Date.now() });
    expect(ln.verifyWebhook(reqOf({ raw, headers: { 'linear-signature': hmac('lws', raw) } }), ctx(config)).ok).toBe(true);
    expect(ln.verifyWebhook(reqOf({ raw, headers: { 'linear-signature': hmac('x', raw) } }), ctx(config)).ok).toBe(false);
    const stale = JSON.stringify({ type: 'Issue', webhookTimestamp: Date.now() - 3600_000 });
    expect(ln.verifyWebhook(reqOf({ raw: stale, headers: { 'linear-signature': hmac('lws', stale) } }), ctx(config)).ok).toBe(false);
  });

  it('turns issue events into cards, tasks and status moves', () => {
    const created = ln.parseWebhook({ payload: { type: 'Issue', action: 'create', data: { identifier: 'ENG-1', title: 'T', url: 'u', team: { key: 'ENG' }, state: { name: 'Todo', type: 'unstarted' } } } });
    expect(created.map(e => e.type)).toEqual(['card', 'task.create']);
    const moved = ln.parseWebhook({ payload: { type: 'Issue', action: 'update', updatedFrom: { stateId: 's' }, data: { identifier: 'ENG-1', title: 'T', url: 'u', team: { key: 'ENG' }, state: { name: 'Done', type: 'completed' } } } });
    expect(moved.find(e => e.type === 'task.status')).toMatchObject({ status: 'done' });
    expect(ln.parseWebhook({ payload: { type: 'Comment' } })).toEqual([]);
  });
});

describe('CI/CD', () => {
  const ci = CONNECTORS.cicd;
  const config = { notifyOn: 'finished', ...sealed({ webhookToken: 'citok' }) };

  it('normalises GitHub Actions, GitLab CI, Jenkins, CircleCI and generic payloads', () => {
    expect(ci.normalize({ action: 'completed', workflow_run: { name: 'CI', status: 'completed', conclusion: 'failure', html_url: 'h', head_branch: 'main', run_number: 4 }, repository: { full_name: 'acme/web' } }))
      .toMatchObject({ system: 'GitHub Actions', status: 'failure', repo: 'acme/web', number: 4 });
    expect(ci.normalize({ object_kind: 'pipeline', object_attributes: { id: 2, status: 'success', ref: 'main' }, project: { path_with_namespace: 'g/p', web_url: 'https://g/p' } }))
      .toMatchObject({ system: 'GitLab CI', status: 'success', url: 'https://g/p/-/pipelines/2' });
    expect(ci.normalize({ name: 'deploy', build: { full_url: 'https://j/1', number: 1, phase: 'FINALIZED', status: 'SUCCESS', scm: { branch: 'main' } } }))
      .toMatchObject({ system: 'Jenkins', status: 'success' });
    expect(ci.normalize({ type: 'workflow-completed', workflow: { name: 'build', status: 'failed', url: 'https://c' }, pipeline: { number: 9, vcs: { branch: 'dev' } }, project: { slug: 'gh/acme/web' } }))
      .toMatchObject({ system: 'CircleCI', status: 'failure', repo: 'acme/web' });
    expect(ci.normalize({ name: 'x', status: 'passed', url: 'https://x' })).toMatchObject({ system: 'CI', status: 'success' });
    expect(ci.normalize({ hello: 1 })).toBeNull();
  });

  it('posts finished builds and always hands the build to automations', () => {
    const running = ci.parseWebhook({ payload: { name: 'x', status: 'running' }, headers: {}, ctx: ctx(config) });
    expect(running.map(e => e.type)).toEqual(['automation']);
    const done = ci.parseWebhook({ payload: { name: 'x', status: 'failed', repo: 'acme/web' }, headers: {}, ctx: ctx(config) });
    expect(done.map(e => e.type)).toEqual(['automation', 'card']);
    expect(done[1].route).toEqual({ match: 'acme/web', event: 'failure' });
    expect(done[0].data).toMatchObject({ webhookType: 'cicd', status: 'failure' });
    const failuresOnly = ci.parseWebhook({ payload: { name: 'x', status: 'success' }, headers: {}, ctx: ctx({ ...config, notifyOn: 'failures' }) });
    expect(failuresOnly.map(e => e.type)).toEqual(['automation']);
  });

  it('accepts the token, a GitHub signature, a GitLab token or a CircleCI signature', () => {
    const raw = '{"status":"ok"}';
    expect(ci.verifyWebhook(reqOf({ raw, query: { token: 'citok' } }), ctx(config)).ok).toBe(true);
    expect(ci.verifyWebhook(reqOf({ raw, headers: { 'x-oruinwan-token': 'citok' } }), ctx(config)).ok).toBe(true);
    expect(ci.verifyWebhook(reqOf({ raw, headers: { 'x-hub-signature-256': `sha256=${hmac('citok', raw)}` } }), ctx(config)).ok).toBe(true);
    expect(ci.verifyWebhook(reqOf({ raw, headers: { 'x-gitlab-token': 'citok' } }), ctx(config)).ok).toBe(true);
    expect(ci.verifyWebhook(reqOf({ raw, headers: { 'circleci-signature': `v1=${hmac('citok', raw)}` } }), ctx(config)).ok).toBe(true);
    expect(ci.verifyWebhook(reqOf({ raw, query: { token: 'bad' } }), ctx(config)).ok).toBe(false);
    expect(ci.verifyWebhook(reqOf({ raw }), ctx(config)).ok).toBe(false);
  });
});

describe('Slack', () => {
  const sl = CONNECTORS.slack;
  const config = { ...sealed({ botToken: 'xoxb-1', signingSecret: 'ssec' }), bridges: [{ remote: 'C111', channelId: 'ch1', direction: 'both', outEnabledAt: new Date() }, { remote: 'C222', channelId: 'ch2', direction: 'out', outEnabledAt: new Date() }] };

  it('tests the bot token with auth.test and reports Slack errors', async () => {
    axios.mockResolvedValueOnce({ data: { ok: true, user: 'oruinwan', team: 'Acme' } });
    expect((await sl.test(ctx(config))).account).toMatchObject({ team: 'Acme' });
    expect(lastCall()).toMatchObject({ url: 'https://slack.com/api/auth.test', headers: { Authorization: 'Bearer xoxb-1' } });
    axios.mockResolvedValueOnce({ data: { ok: false, error: 'invalid_auth' } });
    await expect(sl.test(ctx(config))).rejects.toMatchObject({ code: 'SLACK_BAD_TOKEN' });
  });

  it('checks a webhook URL without posting (400 no_text means valid)', async () => {
    axios.post.mockResolvedValueOnce({ status: 400, data: 'no_text' });
    const c = sealed({ webhookUrl: 'https://hooks.slack.com/services/T/B/x' });
    expect((await sl.test(ctx(c))).account.name).toBe('Incoming webhook');
    expect(axios.post.mock.calls[0][1]).toEqual({});
    axios.post.mockResolvedValueOnce({ status: 404, data: 'no_service' });
    await expect(sl.test(ctx(c))).rejects.toThrow(/rejected/);
  });

  it('verifies the v0 signature and timestamp', () => {
    const raw = '{"type":"event_callback"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `v0=${hmac('ssec', `v0:${ts}:${raw}`)}`;
    expect(sl.verifyWebhook(reqOf({ raw, headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': sig } }), ctx(config)).ok).toBe(true);
    expect(sl.verifyWebhook(reqOf({ raw, headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': 'v0=00' } }), ctx(config)).ok).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(sl.verifyWebhook(reqOf({ raw, headers: { 'x-slack-request-timestamp': old, 'x-slack-signature': `v0=${hmac('ssec', `v0:${old}:${raw}`)}` } }), ctx(config)).ok).toBe(false);
  });

  it('bridges messages from an "in" Slack channel only, skipping bots and retries', async () => {
    axios.mockResolvedValue({ data: { ok: true, user: { profile: { display_name: 'Bea' } } } });
    const base = { type: 'event_callback', team_id: 'T1', event: { type: 'message', channel: 'C111', user: 'U1', ts: '1.2', text: 'hi <@U2> see <https://x.io|docs>' } };
    const [e] = await sl.parseWebhook({ payload: base, headers: {}, ctx: ctx(config) });
    expect(e).toMatchObject({ type: 'card', channelId: 'ch1', card: { provider: 'slack', kind: 'message', author: 'Bea', extra: { notE2EE: true } } });
    expect(e.summary).toBe('hi @Bea see docs (https://x.io)');
    expect(await sl.parseWebhook({ payload: { ...base, event: { ...base.event, channel: 'C222' } }, headers: {}, ctx: ctx(config) })).toEqual([]);
    expect(await sl.parseWebhook({ payload: { ...base, event: { ...base.event, bot_id: 'B' } }, headers: {}, ctx: ctx(config) })).toEqual([]);
    expect(await sl.parseWebhook({ payload: base, headers: { 'x-slack-retry-num': '1' }, ctx: ctx(config) })).toEqual([]);
  });

  it('relays via chat.postMessage, or the webhook URL', async () => {
    axios.mockResolvedValue({ data: { ok: true } });
    await sl.relay(ctx(config), config.bridges[1], { text: 'hello', senderName: 'Ann', channelName: 'dev' });
    expect(lastCall()).toMatchObject({ url: 'https://slack.com/api/chat.postMessage', data: { channel: 'C222', text: 'hello', username: 'Ann (Oruinwan)' } });
    const hook = sealed({ webhookUrl: 'https://hooks.slack.com/services/T/B/x' });
    await sl.relay(ctx(hook), { remote: '*' }, { text: 'hello', senderName: 'Ann', channelName: 'dev' });
    expect(lastCall()).toMatchObject({ url: 'https://hooks.slack.com/services/T/B/x', data: { text: '*Ann* in #dev: hello' } });
  });

  it('rejects a non-Slack webhook URL', () => {
    expect(() => sl.secretChecks.webhookUrl('https://evil.example.com/hook')).toThrow(/hooks.slack.com/);
  });
});

describe('Microsoft Teams', () => {
  const tm = CONNECTORS.teams;
  const token = Buffer.from('a-very-secret-teams-token-1234567').toString('base64');
  const config = { ...sealed({ webhookUrl: 'https://acme.webhook.office.com/webhookb2/x', outgoingSecret: token }), bridges: [{ remote: '*', channelId: 'ch1', direction: 'in' }] };

  it('verifies the outgoing-webhook HMAC', () => {
    const raw = '{"type":"message","text":"<at>Oruinwan</at> hi"}';
    const sig = crypto.createHmac('sha256', Buffer.from(token, 'base64')).update(raw).digest('base64');
    expect(tm.verifyWebhook(reqOf({ raw, headers: { authorization: `HMAC ${sig}` } }), ctx(config)).ok).toBe(true);
    expect(tm.verifyWebhook(reqOf({ raw, headers: { authorization: 'HMAC abc' } }), ctx(config)).ok).toBe(false);
  });

  it('posts the message (without the @mention) and answers Teams', () => {
    const effects = tm.parseWebhook({ payload: { type: 'message', id: 'm1', text: '<at>Oruinwan</at> deploy <b>done</b>', from: { name: 'Cy' } }, ctx: ctx(config) });
    expect(effects[0]).toMatchObject({ type: 'card', channelId: 'ch1', summary: 'deploy done', card: { provider: 'teams', author: 'Cy' } });
    expect(effects[1].body).toMatchObject({ type: 'message' });
  });

  it('relays to the Teams webhook URL and validates its host', async () => {
    axios.mockResolvedValue({ data: '1' });
    await tm.relay(ctx(config), {}, { text: 'hello', senderName: 'Ann', channelName: 'dev' });
    expect(lastCall()).toMatchObject({ method: 'post', url: 'https://acme.webhook.office.com/webhookb2/x', data: { type: 'message' } });
    expect(() => tm.secretChecks.webhookUrl('https://example.com/x')).toThrow();
  });
});

describe('files: Google Drive, OneDrive, Dropbox', () => {
  it('Google Drive rejects API keys and searches with an access token', async () => {
    expect(() => CONNECTORS.google_drive.secretChecks.accessToken('AIzaSyA1234567890abcdefghijklmnopqrst')).toThrow(/API key/);
    axios.mockResolvedValue({ data: { files: [{ id: 'f1', name: 'Plan', mimeType: 'application/pdf', webViewLink: 'https://drive/f1' }] } });
    const r = await CONNECTORS.google_drive.actions.search.run(ctx(sealed({ accessToken: 'ya29.x' })), { q: "Bob's plan" });
    expect(r.items[0]).toMatchObject({ id: 'f1', title: 'Plan', url: 'https://drive/f1', kind: 'file' });
    expect(lastCall().params.q).toBe("trashed = false and name contains 'Bob\\'s plan'");
    expect(lastCall().headers.Authorization).toBe('Bearer ya29.x');
  });

  it('Google Drive exchanges a service-account key for a token', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
    const key = JSON.stringify({ type: 'service_account', client_email: 'sa@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    axios.post.mockResolvedValue({ data: { access_token: 'sa-token', expires_in: 3600 } });
    axios.mockResolvedValue({ data: { user: { displayName: 'SA' } } });
    await CONNECTORS.google_drive.test(ctx(sealed({ serviceAccount: key })));
    expect(axios.post.mock.calls[0][1]).toMatch(/grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=/);
    expect(lastCall().headers.Authorization).toBe('Bearer sa-token');
    expect(() => CONNECTORS.google_drive.secretChecks.serviceAccount('{"type":"user"}')).toThrow(/service account/);
  });

  it('OneDrive searches with a Graph token', async () => {
    axios.mockResolvedValue({ data: { value: [{ id: 'o1', name: 'Doc.docx', webUrl: 'https://1drv/o1', file: { mimeType: 'x' } }] } });
    const r = await CONNECTORS.onedrive.actions.search.run(ctx(sealed({ accessToken: 'eyJ' })), { q: 'Doc' });
    expect(r.items[0]).toMatchObject({ id: 'o1', url: 'https://1drv/o1' });
    expect(lastCall().url).toBe("https://graph.microsoft.com/v1.0/me/drive/root/search(q='Doc')");
  });

  it('Dropbox tests, searches and makes a shared link for an item', async () => {
    const c = ctx(sealed({ accessToken: 'sl.x' }));
    axios.mockResolvedValueOnce({ data: { name: { display_name: 'Ann' }, email: 'a@x' } });
    expect((await CONNECTORS.dropbox.test(c)).account.name).toBe('Ann');
    expect(lastCall()).toMatchObject({ method: 'post', url: 'https://api.dropboxapi.com/2/users/get_current_account', data: 'null' });
    axios.mockResolvedValueOnce({ data: { id: 'id:abc', name: 'a.pdf', path_display: '/a.pdf', path_lower: '/a.pdf', '.tag': 'file' } })
      .mockRejectedValueOnce({ response: { status: 409, data: { error_summary: 'shared_link_already_exists' } } })
      .mockResolvedValueOnce({ data: { links: [{ url: 'https://www.dropbox.com/s/abc/a.pdf' }] } });
    const { item } = await CONNECTORS.dropbox.actions.item.run(c, { id: 'id:abc' });
    expect(item.url).toBe('https://www.dropbox.com/s/abc/a.pdf');
  });
});

describe('pages: Notion and Confluence', () => {
  it('Notion search and import to Markdown', async () => {
    const c = ctx(sealed({ token: 'ntn_1' }));
    axios.mockResolvedValueOnce({ data: { results: [{ object: 'page', id: 'p1', url: 'https://notion.so/p1', properties: { Name: { type: 'title', title: [{ plain_text: 'Roadmap' }] } } }] } });
    expect((await CONNECTORS.notion.actions.search.run(c, { q: 'road' })).items[0]).toMatchObject({ title: 'Roadmap', kind: 'page' });
    expect(lastCall().headers['Notion-Version']).toBe('2022-06-28');
    const id = '0123456789abcdef0123456789abcdef';
    axios.mockResolvedValueOnce({ data: { object: 'page', id, url: 'https://notion.so/x', icon: { emoji: '🚀' }, properties: { title: { type: 'title', title: [{ plain_text: 'Plan' }] } } } })
      .mockResolvedValueOnce({ data: { has_more: false, results: [
        { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Goals' }] } },
        { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Ship', annotations: { bold: true } }] } },
        { type: 'to_do', to_do: { checked: true, rich_text: [{ plain_text: 'Done' }] } },
        { type: 'code', code: { language: 'js', rich_text: [{ plain_text: 'x()' }] } },
      ] } });
    const r = await CONNECTORS.notion.actions.import.run(c, { id: `https://www.notion.so/Plan-${id}` });
    expect(r.title).toBe('Plan');
    expect(r.content).toBe('# Goals\n- **Ship**\n- [x] Done\n```js\nx()\n```');
    expect(() => CONNECTORS.notion.actions.item.run(c, { id: 'nope' })).rejects.toThrow(/Invalid Notion/);
  });

  it('Confluence tests with Basic auth and imports storage format', async () => {
    const c = ctx({ baseUrl: 'https://acme.atlassian.net', email: 'a@x', ...sealed({ apiToken: 'atl' }) });
    axios.mockResolvedValueOnce({ data: { displayName: 'Ann' } });
    await CONNECTORS.confluence.test(c);
    expect(lastCall()).toMatchObject({ url: 'https://acme.atlassian.net/wiki/rest/api/user/current', auth: { username: 'a@x', password: 'atl' } });
    axios.mockResolvedValueOnce({ data: { id: '42', title: 'Runbook', _links: { webui: '/spaces/X/pages/42' }, body: { storage: { value: '<h2>Steps</h2><ul><li>One</li><li><strong>Two</strong></li></ul><p>See <a href="https://x">docs</a></p>' } } } });
    const r = await CONNECTORS.confluence.actions.import.run(c, { id: '42' });
    expect(r.item.url).toBe('https://acme.atlassian.net/wiki/spaces/X/pages/42');
    expect(r.content).toBe('## Steps\n\n- One\n- **Two**\n\nSee [docs](https://x)');
    expect(CONNECTORS.confluence.fields.baseUrl('https://acme.atlassian.net/wiki/')).toBe('https://acme.atlassian.net');
  });
});

describe('Google Meet', () => {
  it('creates a real Meet link through Calendar and never invents one', async () => {
    const c = ctx(sealed({ accessToken: 'ya29.cal' }));
    axios.mockResolvedValueOnce({ data: { id: 'ev1', summary: 'Sync', hangoutLink: 'https://meet.google.com/abc-defg-hij', start: { dateTime: '2026-10-21T10:00:00Z' } } });
    const r = await CONNECTORS.google_meet.actions.meeting.run(c, { title: 'Sync', durationMinutes: 45 });
    expect(r.meeting.joinUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(lastCall()).toMatchObject({ method: 'post', url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events', params: { conferenceDataVersion: 1 } });
    expect(lastCall().data.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
    axios.mockResolvedValueOnce({ data: { id: 'ev2' } });
    await expect(CONNECTORS.google_meet.actions.meeting.run(c, {})).rejects.toMatchObject({ code: 'GMEET_NO_LINK' });
  });

  it('validates pasted Meet links', async () => {
    await expect(CONNECTORS.google_meet.actions['check-link'].run(null, { url: 'https://meet.google.com/abc-defg-hij' })).resolves.toBeTruthy();
    await expect(CONNECTORS.google_meet.actions['check-link'].run(null, { url: 'https://evil.com/abc-defg-hij' })).rejects.toThrow();
  });
});

describe('Zapier / Make / n8n', () => {
  const config = { ...sealed({ webhookToken: 'ztok' }), routes: [{ match: 'deploys', channelId: 'chD' }], defaultChannelId: 'chDefault' };

  it('posts text to a named route or the default channel, creates tasks, and feeds automations', () => {
    const z = CONNECTORS.zapier;
    expect(z.verifyWebhook(reqOf({ query: { token: 'ztok' } }), ctx(config)).ok).toBe(true);
    expect(z.verifyWebhook(reqOf({ query: { token: 'x' } }), ctx(config)).ok).toBe(false);
    const a = z.parseWebhook({ payload: { text: 'Shipped', channel: '#Deploys' }, ctx: ctx(config) });
    expect(a.map(e => e.type)).toEqual(['automation', 'card']);
    expect(a[1]).toMatchObject({ channelId: 'chD', summary: 'Shipped', card: { provider: 'zapier', kind: 'message' } });
    const b = CONNECTORS.n8n.parseWebhook({ payload: { text: 'Hi', task: { title: 'Call Bob', dueDate: '2026-11-01' } }, ctx: ctx(config) });
    expect(b[1].channelId).toBe('chDefault');
    expect(b[2]).toMatchObject({ type: 'task.create', explicit: true, channelId: 'chDefault', title: 'Call Bob' });
    expect(b[0].data).toMatchObject({ webhookType: 'n8n', text: 'Hi' });
    expect(() => CONNECTORS.make.parseWebhook({ payload: { task: { title: 'x' } }, ctx: ctx({ routes: [] }) })).toThrow(/default channel/);
  });
});
