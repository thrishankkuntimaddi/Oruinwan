'use strict';

/**
 * GitHub events → channel routing, card dedupe/update and task linking
 * (key extraction, externalLinks, workflow-checked status sync).
 */

process.env.SERVER_KEK = process.env.SERVER_KEK || 'ab'.repeat(32);

jest.mock('../../../modules/conversations/cryptoUtils', () => ({
  ...jest.requireActual('../../../modules/conversations/cryptoUtils'),
  encryptForConversation: jest.fn(async (_id, _type, text) => ({ ciphertext: `enc(${text})`, messageIv: 'iv' })),
}));
jest.mock('../../../modules/messages/messages.service', () => ({
  createMessage: jest.fn(async (doc) => ({ _id: 'new-card', ...doc })),
}));
jest.mock('../../tasks/tasks.shared', () => ({
  ...jest.requireActual('../../tasks/tasks.shared'),
  emitToTaskAudience: jest.fn(async () => {}),
  loadTaskForClient: jest.fn(async (id) => ({ _id: id })),
}));

const Message = require('../../../modules/messages/message.model.js');
const Channel = require('../../channels/channel.model.js');
const User = require('../../../../models/User');
const Task = require('../../../../models/Task');
const TaskActivity = require('../../../../models/TaskActivity');
const messagesService = require('../../../modules/messages/messages.service');
const tasksShared = require('../../tasks/tasks.shared');
const bot = require('../integration.bot');
const links = require('../integration.tasks');
const { processGithubEvent, pickRoute } = require('../github/github.events');
const tasksService = require('../../tasks/tasks.service');

const WS = '64b000000000000000000001';
const CH_WEB = '64b0000000000000000000c1';
const CH_ALL = '64b0000000000000000000c2';
const BOT_ID = '64b0000000000000000000f1';
const TASK_ID = '64b0000000000000000000e1';

const repo = { full_name: 'acme/web', html_url: 'https://github.com/acme/web' };
const basePr = {
  number: 12, title: 'ABC-7: login form', body: 'Also touches abc-9', state: 'open', draft: false, merged: false,
  user: { login: 'octocat' }, head: { ref: 'feature/abc-8-login', sha: 's1' }, base: { ref: 'main' },
  html_url: 'https://github.com/acme/web/pull/12', additions: 10, deletions: 2, changed_files: 3, commits: 1,
};
const integration = (config = {}) => ({
  workspaceId: WS, type: 'github', status: 'connected',
  config: { routes: [{ repo: '*', channelId: CH_ALL, events: ['pull_request', 'pull_request_review', 'push', 'check_suite'] }, { repo: 'acme/web', channelId: CH_WEB, events: ['pull_request', 'pull_request_review', 'check_suite'] }], linkTasks: true, statusSync: true, ...config },
});

let io;
let cards; // channel+url -> fake message document
beforeEach(() => {
  cards = new Map();
  io = { emitted: [], to(room) { return { emit: (event, data) => io.emitted.push({ room, event, data }) }; } };
  jest.spyOn(User, 'findOneAndUpdate').mockImplementation(() => ({ lean: () => Promise.resolve({ _id: BOT_ID, username: 'GitHub' }) }));
  jest.spyOn(Channel, 'findOne').mockImplementation((q) => ({
    select: () => ({ lean: async () => (String(q.workspace) === WS && [CH_WEB, CH_ALL].includes(String(q._id)) ? { _id: q._id, workspace: WS, company: null } : null) }),
  }));
  jest.spyOn(Message, 'findOne').mockImplementation(async (q) => cards.get(`${q.channel}|${q['integration.url']}`) || null);
  messagesService.createMessage.mockImplementation(async (doc) => {
    const msg = fakeMessage({ _id: `card-${cards.size + 1}`, ...doc });
    cards.set(`${doc.channel}|${doc.integration.url}`, msg);
    return msg;
  });
  jest.spyOn(Message, 'create').mockImplementation(async (doc) => ({ _id: 'reply', ...doc, populate: async () => {}, toObject() { return { ...doc }; } }));
  jest.spyOn(Message, 'findByIdAndUpdate').mockImplementation(() => ({ populate: () => ({ lean: async () => ({ _id: 'card', replyCount: 1 }) }) }));
  jest.spyOn(Message, 'find').mockImplementation(() => ({ select: () => ({ lean: async () => [...cards.values()].map(c => ({ _id: c._id, channel: c.channel, integration: c.integration })) }) }));
  jest.spyOn(Task, 'find').mockImplementation((q) => ({
    select: () => ({
      lean: async () => {
        if (q.issueKey) return q.issueKey.$in.includes('ABC-7') ? [{ _id: TASK_ID, issueKey: 'ABC-7', title: 'Login', status: 'todo' }] : [];
        return [];
      },
    }),
  }));
});

afterEach(() => jest.restoreAllMocks());

function fakeMessage(doc) {
  const msg = {
    ...doc,
    version: 1,
    markModified: jest.fn(),
    save: jest.fn(async () => msg),
    populate: jest.fn(async () => msg),
    toObject() { return { _id: msg._id, integration: msg.integration, payload: msg.payload }; },
  };
  return msg;
}

describe('routing', () => {
  it('prefers the exact repo route over *', () => {
    expect(pickRoute(integration().config, 'Acme/Web', 'pull_request').channelId).toBe(CH_WEB);
    expect(pickRoute(integration().config, 'acme/api', 'pull_request').channelId).toBe(CH_ALL);
  });

  it('respects the events a route subscribes to', () => {
    // acme/web does not subscribe to push, so the * route takes it.
    expect(pickRoute(integration().config, 'acme/web', 'push').channelId).toBe(CH_ALL);
    expect(pickRoute({ routes: [{ repo: 'acme/web', channelId: CH_WEB, events: ['push'] }] }, 'acme/web', 'issues')).toBeNull();
  });

  it('posts a card to the routed channel as the GitHub bot', async () => {
    jest.spyOn(tasksService, 'applyExternalUpdate').mockResolvedValue({ statusChanged: false, to: 'todo' });
    const res = await processGithubEvent({ integration: integration(), event: 'pull_request', payload: { action: 'opened', pull_request: basePr, repository: repo, sender: { login: 'octocat' } }, io });
    expect(res.routed).toBe(CH_WEB);
    expect(messagesService.createMessage).toHaveBeenCalledTimes(1);
    const doc = messagesService.createMessage.mock.calls[0][0];
    expect(doc).toMatchObject({ type: 'integration', channel: CH_WEB, sender: BOT_ID, ciphertext: 'enc(PR #12 opened by octocat in acme/web: ABC-7: login form)' });
    expect(doc.integration).toMatchObject({ provider: 'github', kind: 'pull_request', repo: 'acme/web', number: 12, state: 'open', branch: 'feature/abc-8-login', base: 'main', additions: 10, changedFiles: 3, taskKeys: ['ABC-7'] });
  });

  it('does not post when no route matches', async () => {
    const res = await processGithubEvent({ integration: integration({ routes: [{ repo: 'acme/api', channelId: CH_WEB }] }), event: 'pull_request', payload: { action: 'opened', pull_request: basePr, repository: repo, sender: {} }, io });
    expect(res.routed).toBeNull();
    expect(messagesService.createMessage).not.toHaveBeenCalled();
  });

  it('never posts into a channel of another workspace', async () => {
    const res = await bot.upsertCard({ workspaceId: '64b000000000000000000002', channelId: CH_WEB, provider: 'github', card: { url: 'u', kind: 'push' }, summary: 's', io });
    expect(res).toBeNull();
    expect(messagesService.createMessage).not.toHaveBeenCalled();
  });
});

describe('card dedupe', () => {
  beforeEach(() => { jest.spyOn(tasksService, 'applyExternalUpdate').mockResolvedValue({ statusChanged: false, to: 'todo' }); });

  it('updates the same card for later events and emits message:edited', async () => {
    const payload = (action, pr = basePr) => ({ action, pull_request: pr, repository: repo, sender: { login: 'octocat' } });
    const first = await processGithubEvent({ integration: integration(), event: 'pull_request', payload: payload('opened'), io });
    const second = await processGithubEvent({ integration: integration(), event: 'pull_request', payload: payload('synchronize', { ...basePr, additions: 30 }), io });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.card).toBe(first.card);
    expect(messagesService.createMessage).toHaveBeenCalledTimes(1);
    const card = cards.get(`${CH_WEB}|${basePr.html_url}`);
    expect(card.save).toHaveBeenCalled();
    expect(card.integration.additions).toBe(30);
    expect(card.payload.ciphertext).toBe('enc(PR #12 updated by octocat in acme/web: ABC-7: login form)');
    expect(io.emitted.find(e => e.event === 'message:edited' && e.room === `channel:${CH_WEB}`)).toBeTruthy();
    // synchronize is not a meaningful event: no thread reply.
    expect(Message.create).not.toHaveBeenCalled();
  });

  it('adds thread replies for review, failed checks and merge only', async () => {
    await processGithubEvent({ integration: integration(), event: 'pull_request', payload: { action: 'opened', pull_request: basePr, repository: repo, sender: { login: 'octocat' } }, io });
    await processGithubEvent({ integration: integration(), event: 'pull_request_review', payload: { action: 'submitted', review: { state: 'APPROVED', user: { login: 'hubot' } }, pull_request: basePr, repository: repo }, io });
    const failing = { action: 'completed', check_suite: { conclusion: 'failure', head_sha: 's1', pull_requests: [{ number: 12 }], app: { name: 'CI' } }, repository: repo };
    await processGithubEvent({ integration: integration(), event: 'check_suite', payload: failing, io });
    await processGithubEvent({ integration: integration(), event: 'pull_request', payload: { action: 'closed', pull_request: { ...basePr, state: 'closed', merged: true, merged_by: { login: 'octocat' } }, repository: repo, sender: { login: 'octocat' } }, io });

    expect(messagesService.createMessage).toHaveBeenCalledTimes(1);
    const card = cards.get(`${CH_WEB}|${basePr.html_url}`);
    expect(card.integration).toMatchObject({ state: 'merged', reviewState: 'approved', checks: { status: 'completed', conclusion: 'failure' } });
    const replies = Message.create.mock.calls.map(c => c[0]);
    expect(replies).toHaveLength(3);
    replies.forEach(r => expect(String(r.parentId)).toBe(card._id));
    expect(replies.map(r => r.payload.ciphertext)).toEqual([
      expect.stringContaining('hubot** approved'),
      expect.stringContaining('Checks failed (CI)'),
      expect.stringContaining('Merged by octocat'),
    ]);
  });

  it('push events create one compact card each', async () => {
    const push = { ref: 'refs/heads/main', commits: [{ id: 'a', message: 'one' }, { id: 'b', message: 'two' }], head_commit: { id: 'b', message: 'two\nbody' }, compare: 'https://github.com/acme/web/compare/x...y', pusher: { name: 'octocat' }, repository: repo };
    await processGithubEvent({ integration: integration(), event: 'push', payload: push, io });
    await processGithubEvent({ integration: integration(), event: 'push', payload: { ...push, compare: 'https://github.com/acme/web/compare/y...z' }, io });
    expect(messagesService.createMessage).toHaveBeenCalledTimes(2);
    const doc = messagesService.createMessage.mock.calls[0][0];
    expect(doc.channel).toBe(CH_ALL);
    expect(doc.integration).toMatchObject({ kind: 'push', branch: 'main', commits: 2, title: 'two' });
    expect(doc.ciphertext).toBe('enc(octocat pushed 2 commits to main in acme/web)');
    expect(Message.create).not.toHaveBeenCalled();
  });
});

describe('task linking', () => {
  it('extracts task keys from title, branch and body', () => {
    expect(links.extractTaskKeys('ABC-7: login', 'feature/abc-8-login', 'fixes Abc-9 and XY-10.')).toEqual(['ABC-7', 'ABC-8', 'ABC-9', 'XY-10']);
    expect(links.extractTaskKeys('no keys here', 'main', '')).toEqual([]);
  });

  it('links only keys that are real tasks in the workspace and syncs status', async () => {
    const spy = jest.spyOn(tasksService, 'applyExternalUpdate').mockResolvedValue({ statusChanged: true, to: 'review' });
    const res = await processGithubEvent({ integration: integration(), event: 'pull_request', payload: { action: 'opened', pull_request: basePr, repository: repo, sender: { login: 'octocat' } }, io });
    expect(Task.find).toHaveBeenCalledWith(expect.objectContaining({ workspace: WS, issueKey: { $in: ['ABC-7', 'ABC-8', 'ABC-9'] } }));
    expect(spy).toHaveBeenCalledTimes(1);
    const [taskId, opts] = spy.mock.calls[0];
    expect(taskId).toBe(TASK_ID);
    expect(opts).toMatchObject({
      actorId: BOT_ID,
      note: 'PR #12 opened by octocat',
      status: 'review',
      link: { provider: 'github', kind: 'pull_request', url: basePr.html_url, repo: 'acme/web', number: 12, state: 'open' },
    });
    expect(res.tasks[0]).toMatchObject({ issueKey: 'ABC-7', to: 'review' });
  });

  it('draft → in_progress only from backlog/todo; merged → done; closed → activity only', async () => {
    const spy = jest.spyOn(tasksService, 'applyExternalUpdate').mockResolvedValue({ statusChanged: false });
    const run = (action, pr) => processGithubEvent({ integration: integration(), event: 'pull_request', payload: { action, pull_request: pr, repository: repo, sender: { login: 'octocat' } }, io });
    await run('opened', { ...basePr, draft: true });
    await run('closed', { ...basePr, state: 'closed', merged: true, merged_by: { login: 'maint' } });
    await run('closed', { ...basePr, state: 'closed', merged: false });
    expect(spy.mock.calls[0][1]).toMatchObject({ status: 'in_progress', onlyFrom: ['backlog', 'todo'] });
    expect(spy.mock.calls[1][1]).toMatchObject({ status: 'done', note: 'PR #12 merged by maint' });
    expect(spy.mock.calls[2][1]).toMatchObject({ status: undefined, note: 'PR #12 closed without merging by octocat' });
  });

  it('statusSync off: link + activity, no status', async () => {
    const spy = jest.spyOn(tasksService, 'applyExternalUpdate').mockResolvedValue({ statusChanged: false });
    await processGithubEvent({ integration: integration({ statusSync: false }), event: 'pull_request', payload: { action: 'opened', pull_request: basePr, repository: repo, sender: { login: 'o' } }, io });
    expect(spy.mock.calls[0][1].status).toBeNull();
  });
});

describe('applyExternalUpdate (workflow rules)', () => {
  function fakeTask(status, externalLinks = []) {
    const t = { _id: TASK_ID, status, workspace: WS, visibility: 'workspace', createdBy: 'u1', assignedTo: [], externalLinks, markModified: jest.fn(), save: jest.fn(async () => t) };
    return t;
  }
  beforeEach(() => {
    jest.spyOn(TaskActivity, 'create').mockResolvedValue({});
  });

  it('moves todo → review, records activity, upserts the link by url and emits task-updated', async () => {
    const t = fakeTask('todo', [{ url: basePr.html_url, provider: 'github', kind: 'pull_request', state: 'draft' }]);
    jest.spyOn(Task, 'findOne').mockResolvedValue(t);
    const r = await tasksService.applyExternalUpdate(TASK_ID, { actorId: BOT_ID, status: 'review', note: 'PR #12 opened', link: { provider: 'github', kind: 'pull_request', url: basePr.html_url, state: 'open' } }, io);
    expect(r.statusChanged).toBe(true);
    expect(t.status).toBe('review');
    expect(t.previousStatus).toBe('todo');
    expect(t.externalLinks).toHaveLength(1);
    expect(t.externalLinks[0].state).toBe('open');
    expect(TaskActivity.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'integration_event', user: BOT_ID, metadata: expect.objectContaining({ text: 'PR #12 opened' }) }));
    expect(TaskActivity.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'status_changed', from: 'todo', to: 'review' }));
    expect(tasksShared.emitToTaskAudience).toHaveBeenCalledWith(io, t, 'task-updated', expect.anything());
  });

  it('merged → done sets completion', async () => {
    const t = fakeTask('review');
    jest.spyOn(Task, 'findOne').mockResolvedValue(t);
    await tasksService.applyExternalUpdate(TASK_ID, { actorId: BOT_ID, status: 'done' }, io);
    expect(t.status).toBe('done');
    expect(t.completedAt).toBeInstanceOf(Date);
    expect(String(t.completedBy)).toBe(BOT_ID);
  });

  it('does not move a task when the workflow forbids it or onlyFrom excludes it', async () => {
    const cancelled = fakeTask('cancelled');
    jest.spyOn(Task, 'findOne').mockResolvedValue(cancelled);
    const r1 = await tasksService.applyExternalUpdate(TASK_ID, { actorId: BOT_ID, status: 'done' }, io);
    expect(r1.statusChanged).toBe(false);
    expect(cancelled.status).toBe('cancelled');

    const done = fakeTask('done');
    jest.spyOn(Task, 'findOne').mockResolvedValue(done);
    const r2 = await tasksService.applyExternalUpdate(TASK_ID, { actorId: BOT_ID, status: 'review', onlyFrom: ['backlog', 'todo', 'in_progress'] }, io);
    expect(r2.statusChanged).toBe(false);
    expect(done.status).toBe('done');
    expect(done.save).not.toHaveBeenCalled();
  });
});
