'use strict';

/**
 * Bitbucket Cloud with an API token / app password (Basic auth with the
 * account's username or e-mail) or a repository/workspace access token
 * (Bearer, when no username is given).
 *
 * Webhook: X-Hub-Signature: sha256=<HMAC-SHA256(raw body, secret)> — Bitbucket
 * signs deliveries when the webhook has a secret (paste the one Oruinwan
 * generated into the webhook's "Secret" field).
 */

const { request, header, clip, httpError } = require('./http');
const { verifyHubSignature, deny, buildStatus, checksOf } = require('./common');
const links = require('../integration.tasks');

const LABEL = 'Bitbucket';
const API = () => (process.env.BITBUCKET_API_URL || 'https://api.bitbucket.org/2.0').replace(/\/+$/, '');
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function api(ctx, method, path, { params, data } = {}) {
  const token = ctx.secret('apiToken');
  const user = ctx.config.username;
  return request({
    label: LABEL, code: 'BITBUCKET', method, url: `${API()}${path}`, params, data,
    headers: { Accept: 'application/json', ...(user ? {} : { Authorization: `Bearer ${token}` }) },
    ...(user && { auth: { username: user, password: token } }),
  });
}

const repoPath = (repo) => {
  if (!REPO_RE.test(String(repo || ''))) throw httpError(400, 'repo must be workspace/repository');
  return `/repositories/${repo.split('/').map(encodeURIComponent).join('/')}`;
};

function prState(pr) {
  if (pr.state === 'MERGED') return 'merged';
  if (pr.state === 'DECLINED' || pr.state === 'SUPERSEDED') return 'closed';
  if (pr.draft) return 'draft';
  return 'open';
}

const PR_ACTION = { 'pullrequest:created': 'opened', 'pullrequest:updated': 'synchronize', 'pullrequest:fulfilled': 'closed', 'pullrequest:rejected': 'closed' };

function parseWebhook({ payload, headers }) {
  const event = headers['x-event-key'] || '';
  const repo = payload.repository?.full_name || '';
  const actor = payload.actor?.display_name || payload.actor?.nickname || null;
  const out = [];

  if (event === 'issue:created' || event === 'issue:updated') {
    const i = payload.issue || {};
    const url = i.links?.html?.href || null;
    const closed = ['resolved', 'closed', 'invalid', 'duplicate', 'wontfix'].includes(String(i.state));
    const state = closed ? 'closed' : 'open';
    const link = { provider: 'bitbucket', kind: 'issue', url, repo, number: i.id, title: clip(i.title, 300), state };
    const card = { provider: 'bitbucket', kind: 'issue', action: event === 'issue:created' ? 'opened' : 'updated', repo, number: i.id, url, title: clip(i.title, 300), state, author: actor };
    if (event === 'issue:created') {
      out.push({ type: 'card', route: { match: repo, event: 'issues' }, card, summary: `Issue #${i.id} opened${actor ? ` by ${actor}` : ''} in ${repo}: ${i.title}` });
      out.push({ type: 'task.create', route: { match: repo, event: 'issues' }, link, title: `[${repo}#${i.id}] ${i.title}`, description: clip(i.content?.raw, 20_000) });
    } else if (payload.changes?.state) {
      out.push({ type: 'card', route: { match: repo, event: 'issues' }, card, summary: `Issue #${i.id} is ${i.state} in ${repo}: ${i.title}` });
      out.push({ type: 'task.status', url, link, status: closed ? 'done' : 'todo', note: `Bitbucket issue #${i.id} is ${i.state}` });
    }
    return out;
  }

  if (PR_ACTION[event]) {
    const pr = payload.pullrequest || {};
    const action = PR_ACTION[event];
    const state = prState(pr);
    const url = pr.links?.html?.href || null;
    const card = {
      provider: 'bitbucket', kind: 'pull_request', action, repo, number: pr.id, url, title: clip(pr.title, 300), state,
      author: pr.author?.display_name || actor, branch: pr.source?.branch?.name || null, base: pr.destination?.branch?.name || null,
    };
    const verb = state === 'merged' ? 'merged' : state === 'closed' ? 'declined' : action === 'opened' ? 'opened' : 'updated';
    out.push({ type: 'card', route: { match: repo, event: 'pull_requests' }, card, summary: `PR #${pr.id} ${verb}${actor ? ` by ${actor}` : ''} in ${repo}: ${pr.title}` });
    const effect = links.prEffect(card, { event: 'pull_request', action, actor });
    out.push({
      type: 'task.link',
      link: { provider: 'bitbucket', kind: 'pull_request', url, repo, number: pr.id, title: clip(pr.title, 300), state },
      texts: [pr.title, card.branch, pr.description], note: effect.note, status: effect.status, onlyFrom: effect.onlyFrom,
    });
    return out;
  }

  if (event === 'repo:push') {
    for (const ch of (payload.push?.changes || []).slice(0, 5)) {
      if (!ch.new || ch.new.type !== 'branch') continue;
      const commits = ch.commits || [];
      const head = commits[0];
      const compareUrl = ch.links?.html?.href || null;
      out.push({
        type: 'card', route: { match: repo, event: 'push' }, dedupe: false,
        card: { provider: 'bitbucket', kind: 'push', repo, branch: ch.new.name, url: compareUrl, author: actor, extra: { commitCount: commits.length, compareUrl, forced: !!ch.forced, headCommit: head ? { id: head.hash, message: clip(head.message, 300), url: head.links?.html?.href || null } : null } },
        summary: `${actor || 'Someone'} pushed ${commits.length} commit${commits.length === 1 ? '' : 's'} to ${ch.new.name} in ${repo}`,
      });
    }
    return out;
  }

  if (event === 'repo:commit_status_updated' || event === 'repo:commit_status_created') {
    const cs = payload.commit_status || {};
    const status = buildStatus(cs.state);
    out.push({
      type: 'card', route: { match: repo, event: 'builds' },
      card: { provider: 'bitbucket', kind: 'checks', repo, branch: cs.refname || null, url: cs.url || null, title: clip(cs.name, 200), state: status, checks: checksOf(status, { name: clip(cs.name, 200), url: cs.url || null }) },
      summary: `Build ${cs.name || ''} ${status} in ${repo}`.replace(/\s+/g, ' '),
    });
  }
  return out;
}

module.exports = {
  type: 'bitbucket',
  label: LABEL,
  category: 'developer',
  description: 'Pull requests, issues, pushes and build statuses in channels; create Bitbucket issues from tasks.',
  setup: [
    'Create an API token (Atlassian account → Security → API tokens, with Bitbucket scopes) or an app password with Repositories: read, Issues: read/write and Pull requests: read. A repository/workspace access token also works (leave the username empty).',
    'Paste the token with your Bitbucket username (or Atlassian e-mail for API tokens) and save — Oruinwan checks it right away.',
    'In the repository → Repository settings → Webhooks, add the webhook URL shown here, paste the secret into "Secret", and pick Push, Pull request, Issue and Build status events.',
    'Map repositories to channels.',
  ],
  form: [
    { key: 'username', label: 'Username or e-mail', kind: 'text', placeholder: 'leave empty for an access token', hint: 'Needed for app passwords and API tokens; leave empty for repository/workspace access tokens.' },
    { key: 'apiToken', label: 'API token, app password or access token', kind: 'secret', required: true },
  ],
  secrets: ['apiToken', 'webhookSecret'],
  generated: ['webhookSecret'],
  fields: { username: (v) => clip(v, 320) },
  defaults: () => ({ username: '', routes: [], linkTasks: true, createTasks: false, statusSync: true }),
  memberHidden: ['username'],
  toggles: [
    { key: 'linkTasks', label: 'Link pull requests to tasks', description: 'Task keys like ABC-12 in a PR title, branch or description link it to that task.' },
    { key: 'statusSync', label: 'Move linked tasks', description: 'Opening, merging or declining moves linked tasks.' },
    { key: 'createTasks', label: 'Create a task for each new issue', description: 'New Bitbucket issues become tasks in the mapped channel.' },
  ],
  routes: {
    label: 'Repository', placeholder: 'workspace/repo or *', hint: 'Use * for every repository.',
    events: [{ id: 'pull_requests', label: 'Pull requests' }, { id: 'issues', label: 'Issues' }, { id: 'push', label: 'Pushes' }, { id: 'builds', label: 'Builds' }],
  },
  required: ['apiToken'],
  webhook: { how: 'Header X-Hub-Signature: sha256=<HMAC of the body with the secret>' },

  async test(ctx) {
    if (ctx.config.username) {
      const me = await api(ctx, 'get', '/user');
      return { account: { login: me.username || me.nickname || null, name: me.display_name || null, avatar: me.links?.avatar?.href || null } };
    }
    // Access tokens are not tied to a user: list what they can see.
    const r = await api(ctx, 'get', '/repositories', { params: { role: 'member', pagelen: 1 } });
    return { account: { name: 'Access token', repositories: r?.size ?? null } };
  },

  verifyWebhook(req, ctx) {
    const secret = ctx.secret('webhookSecret');
    if (!secret) return deny('Webhook secret not configured');
    return verifyHubSignature(req, secret, header(req, 'x-hub-signature-256') ? 'x-hub-signature-256' : 'x-hub-signature');
  },

  parseWebhook,

  actions: {
    repos: {
      method: 'GET',
      async run(ctx, { q }) {
        const params = { role: 'member', pagelen: 50, sort: '-updated_on', ...(q && { q: `name ~ "${clip(q, 80).replace(/"/g, '')}"` }) };
        const r = await api(ctx, 'get', '/repositories', { params });
        return { repos: (r?.values || []).map(x => ({ id: x.uuid, path: x.full_name, name: x.name, url: x.links?.html?.href || null, hasIssues: !!x.has_issues })) };
      },
    },
    issues: {
      method: 'GET',
      async run(ctx, { repo }) {
        const r = await api(ctx, 'get', `${repoPath(repo)}/issues`, { params: { pagelen: 30, q: 'state="new" OR state="open"', sort: '-updated_on' } });
        return { issues: (r?.values || []).map(i => ({ id: i.id, number: i.id, title: i.title, url: i.links?.html?.href || null, state: i.state })) };
      },
    },
    pullrequests: {
      method: 'GET',
      async run(ctx, { repo }) {
        const r = await api(ctx, 'get', `${repoPath(repo)}/pullrequests`, { params: { pagelen: 30, state: 'OPEN' } });
        return { pullRequests: (r?.values || []).map(p => ({ number: p.id, title: p.title, url: p.links?.html?.href || null, author: p.author?.display_name || null, branch: p.source?.branch?.name || null })) };
      },
    },
    issue: {
      method: 'POST',
      linksTask: true,
      async run(ctx, { repo, title, description }, env) {
        const t = clip(title, 255);
        if (!t) throw httpError(400, 'title is required');
        const footer = env.user?.name ? `\n\n---\n_Created from Oruinwan by ${env.user.name}_` : '';
        const i = await api(ctx, 'post', `${repoPath(repo)}/issues`, { data: { title: t, content: { raw: `${clip(description, 60_000)}${footer}` } } });
        const url = i.links?.html?.href || null;
        return {
          issue: { id: i.id, number: i.id, url, title: i.title, repo },
          link: { provider: 'bitbucket', kind: 'issue', url, repo, number: i.id, title: i.title, state: 'open' },
          note: `Bitbucket issue #${i.id} created`,
        };
      },
    },
  },
};
