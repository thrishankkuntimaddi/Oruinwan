'use strict';

/**
 * GitLab (gitlab.com or self-managed) with a personal / project access token.
 *
 * API: GET /api/v4/user (test), /projects, /projects/:id/issues, POST issues.
 * Webhook: X-Gitlab-Token must equal the secret Oruinwan generated.
 * Events: Issue Hook, Merge Request Hook, Push Hook, Pipeline Hook.
 */

const { request, normalizeHttpsUrl, header, safeEqual, clip, httpError } = require('./http');
const { deny, ok, buildStatus, checksOf } = require('./common');
const links = require('../integration.tasks');

const LABEL = 'GitLab';

const base = (config) => `${String(config.baseUrl || 'https://gitlab.com').replace(/\/+$/, '')}/api/v4`;

function api(ctx, method, path, { params, data } = {}) {
  return request({
    label: LABEL, code: 'GITLAB', method, url: `${base(ctx.config)}${path}`, params, data,
    headers: { 'PRIVATE-TOKEN': ctx.secret('token'), Accept: 'application/json' },
  });
}

const projectPath = (p) => `/projects/${encodeURIComponent(String(p))}`;

function mrState(mr) {
  if (mr.state === 'merged' || mr.action === 'merge') return 'merged';
  if (mr.state === 'closed') return 'closed';
  if (mr.work_in_progress || mr.draft) return 'draft';
  return 'open';
}

const MR_ACTION = { open: 'opened', reopen: 'reopened', close: 'closed', merge: 'closed', update: 'synchronize' };

function parseWebhook({ payload, headers }) {
  const event = headers['x-gitlab-event'] || '';
  const project = payload.project?.path_with_namespace || payload.project?.name || '';
  const out = [];

  if (event === 'Issue Hook' || event === 'Confidential Issue Hook') {
    const a = payload.object_attributes || {};
    if (!['open', 'reopen', 'close', 'update'].includes(a.action)) return out;
    const state = a.state === 'closed' ? 'closed' : 'open';
    const link = { provider: 'gitlab', kind: 'issue', url: a.url, repo: project, number: a.iid, title: clip(a.title, 300), state };
    const card = { provider: 'gitlab', kind: 'issue', action: a.action, repo: project, number: a.iid, url: a.url, title: clip(a.title, 300), state, author: payload.user?.username || null, authorAvatar: payload.user?.avatar_url || null };
    const verb = { open: 'opened', reopen: 'reopened', close: 'closed', update: 'updated' }[a.action];
    if (a.action !== 'update') out.push({ type: 'card', route: { match: project, event: 'issues' }, card, summary: `Issue #${a.iid} ${verb} in ${project}: ${a.title}` });
    if (a.action === 'open') out.push({ type: 'task.create', route: { match: project, event: 'issues' }, link, title: `[${project}#${a.iid}] ${a.title}`, description: clip(a.description, 20_000) });
    if (a.action === 'close') out.push({ type: 'task.status', url: a.url, link, status: 'done', note: `GitLab issue #${a.iid} closed` });
    if (a.action === 'reopen') out.push({ type: 'task.status', url: a.url, link, status: 'todo', note: `GitLab issue #${a.iid} reopened` });
    return out;
  }

  if (event === 'Merge Request Hook') {
    const mr = payload.object_attributes || {};
    const action = MR_ACTION[mr.action];
    if (!action) return out;
    const state = mrState(mr);
    const actor = payload.user?.username || null;
    const card = {
      provider: 'gitlab', kind: 'pull_request', action, repo: project, number: mr.iid, url: mr.url, title: clip(mr.title, 300), state,
      author: actor, authorAvatar: payload.user?.avatar_url || null, branch: mr.source_branch || null, base: mr.target_branch || null,
    };
    const verb = state === 'merged' ? 'merged' : action === 'synchronize' ? 'updated' : action;
    out.push({ type: 'card', route: { match: project, event: 'merge_requests' }, card, summary: `MR !${mr.iid} ${verb}${actor ? ` by ${actor}` : ''} in ${project}: ${mr.title}` });
    const effect = links.prEffect({ ...card, number: mr.iid }, { event: 'pull_request', action, actor });
    out.push({
      type: 'task.link',
      link: { provider: 'gitlab', kind: 'pull_request', url: mr.url, repo: project, number: mr.iid, title: clip(mr.title, 300), state },
      texts: [mr.title, mr.source_branch, mr.description],
      note: effect.note ? effect.note.replace(/^PR #/, 'MR !') : null, status: effect.status, onlyFrom: effect.onlyFrom,
    });
    return out;
  }

  if (event === 'Push Hook') {
    const branch = String(payload.ref || '').replace(/^refs\/heads\//, '');
    const n = payload.total_commits_count ?? (payload.commits || []).length;
    const head = (payload.commits || []).slice(-1)[0];
    const compareUrl = payload.project?.web_url && payload.before && payload.after ? `${payload.project.web_url}/-/compare/${payload.before}...${payload.after}` : null;
    out.push({
      type: 'card', route: { match: project, event: 'push' }, dedupe: false,
      card: { provider: 'gitlab', kind: 'push', repo: project, branch, url: compareUrl, author: payload.user_username || payload.user_name || null, extra: { commitCount: n, compareUrl, headCommit: head ? { id: head.id, message: clip(head.message, 300), url: head.url } : null } },
      summary: `${payload.user_name || 'Someone'} pushed ${n} commit${n === 1 ? '' : 's'} to ${branch} in ${project}`,
    });
    return out;
  }

  if (event === 'Pipeline Hook') {
    const p = payload.object_attributes || {};
    const status = buildStatus(p.status);
    if (status === 'running' && p.status !== 'running') return out; // created/pending: wait for a real state
    const url = payload.project?.web_url ? `${payload.project.web_url}/-/pipelines/${p.id}` : null;
    out.push({
      type: 'card', route: { match: project, event: 'pipeline' },
      card: { provider: 'gitlab', kind: 'checks', repo: project, branch: p.ref || null, url, title: `Pipeline #${p.id}`, state: status, checks: checksOf(status, { name: `Pipeline #${p.id}`, url }) },
      summary: `Pipeline #${p.id} ${status} on ${p.ref} in ${project}`,
    });
  }
  return out;
}

module.exports = {
  type: 'gitlab',
  label: LABEL,
  category: 'developer',
  description: 'Issues, merge requests, pushes and pipelines in channels; create GitLab issues from tasks.',
  setup: [
    'Create a personal (or project/group) access token with the api scope in GitLab → Preferences → Access tokens.',
    'Paste it below with your GitLab address (leave https://gitlab.com for GitLab.com) and save — Oruinwan checks it right away.',
    'In your GitLab project → Settings → Webhooks, add the webhook URL shown here and paste the secret token. Tick Issues, Merge requests, Push and Pipeline events.',
    'Map projects to channels so events are posted where your team works.',
  ],
  form: [
    { key: 'baseUrl', label: 'GitLab address', kind: 'url', placeholder: 'https://gitlab.com' },
    { key: 'token', label: 'Access token', kind: 'secret', required: true, placeholder: 'glpat-…' },
  ],
  secrets: ['token', 'webhookSecret'],
  generated: ['webhookSecret'],
  fields: { baseUrl: (v) => normalizeHttpsUrl(v, { name: 'GitLab address', example: 'https://gitlab.com' }) || 'https://gitlab.com' },
  defaults: () => ({ baseUrl: 'https://gitlab.com', routes: [], linkTasks: true, createTasks: false, statusSync: true }),
  toggles: [
    { key: 'linkTasks', label: 'Link merge requests to tasks', description: 'Task keys like ABC-12 in an MR title, branch or description link it to that task.' },
    { key: 'statusSync', label: 'Move linked tasks', description: 'Opening, merging or closing moves linked tasks (review, done).' },
    { key: 'createTasks', label: 'Create a task for each new issue', description: 'New GitLab issues become tasks in the mapped channel.' },
  ],
  routes: {
    label: 'Project', placeholder: 'group/project or *', hint: 'Use * for every project.',
    events: [{ id: 'issues', label: 'Issues' }, { id: 'merge_requests', label: 'Merge requests' }, { id: 'push', label: 'Pushes' }, { id: 'pipeline', label: 'Pipelines' }],
  },
  required: ['token'],
  webhook: { how: 'Header X-Gitlab-Token: <secret>' },

  async test(ctx) {
    const me = await api(ctx, 'get', '/user');
    return { account: { login: me.username, name: me.name || null, avatar: me.avatar_url || null } };
  },

  verifyWebhook(req, ctx) {
    const given = header(req, 'x-gitlab-token');
    if (!given) return deny('Missing X-Gitlab-Token');
    return safeEqual(given, ctx.secret('webhookSecret')) ? ok : deny('Invalid token');
  },

  parseWebhook,

  actions: {
    projects: {
      method: 'GET',
      async run(ctx, { q }) {
        const list = await api(ctx, 'get', '/projects', { params: { membership: true, simple: true, per_page: 50, order_by: 'last_activity_at', ...(q && { search: clip(q, 100) }) } });
        return { projects: (list || []).map(p => ({ id: p.id, path: p.path_with_namespace, name: p.name_with_namespace || p.name, url: p.web_url })) };
      },
    },
    issues: {
      method: 'GET',
      async run(ctx, { project, q }) {
        if (!project) throw httpError(400, 'project is required (id or group/name)');
        const list = await api(ctx, 'get', `${projectPath(project)}/issues`, { params: { state: 'opened', per_page: 30, ...(q && { search: clip(q, 100) }) } });
        return { issues: (list || []).map(i => ({ id: i.id, number: i.iid, title: i.title, url: i.web_url, state: i.state, author: i.author?.username || null })) };
      },
    },
    issue: {
      method: 'POST',
      linksTask: true,
      async run(ctx, { project, title, description }, env) {
        if (!project) throw httpError(400, 'project is required (id or group/name)');
        const t = clip(title, 255);
        if (!t) throw httpError(400, 'title is required');
        const footer = env.user?.name ? `\n\n---\n_Created from Oruinwan by ${env.user.name}_` : '';
        const i = await api(ctx, 'post', `${projectPath(project)}/issues`, { data: { title: t, description: `${clip(description, 60_000)}${footer}` } });
        const repo = i.references?.full?.split('#')[0] || String(project);
        return {
          issue: { id: i.id, number: i.iid, url: i.web_url, title: i.title, repo },
          link: { provider: 'gitlab', kind: 'issue', url: i.web_url, repo, number: i.iid, title: i.title, state: 'open' },
          note: `GitLab issue #${i.iid} created`,
        };
      },
    },
  },
};
