'use strict';

/**
 * Linear with a personal API key (GraphQL, Authorization: <key>).
 *
 * Webhook: Linear shows a signing secret when you create the webhook; paste
 * it here. Deliveries carry Linear-Signature: <hex HMAC-SHA256(raw body)>
 * and webhookTimestamp (ms), which must be within 5 minutes.
 */

const { request, header, safeEqual, hmacHex, clip, httpError } = require('./http');
const { deny, ok } = require('./common');

const LABEL = 'Linear';
const API = () => process.env.LINEAR_API_URL || 'https://api.linear.app/graphql';
const MAX_SKEW_MS = 5 * 60 * 1000;

async function gql(ctx, query, variables = {}) {
  const data = await request({
    label: LABEL, code: 'LINEAR', method: 'post', url: API(), data: { query, variables },
    headers: { Authorization: ctx.secret('apiKey'), 'Content-Type': 'application/json' },
  });
  if (data?.errors?.length) {
    const msg = data.errors.map(e => e.message).join('; ');
    const auth = data.errors.some(e => /auth/i.test(e.extensions?.code || e.message || ''));
    throw httpError(auth ? 502 : 400, auth ? 'Linear rejected the API key. Paste a new one in Settings → Integrations.' : `Linear: ${msg}`, auth ? 'LINEAR_BAD_TOKEN' : 'LINEAR_INVALID');
  }
  return data?.data || {};
}

const STATE_STATUS = { triage: 'todo', backlog: 'backlog', unstarted: 'todo', started: 'in_progress', completed: 'done', canceled: null };

function parseWebhook({ payload }) {
  const out = [];
  if (payload.type !== 'Issue') return out;
  const i = payload.data || {};
  const team = i.team?.key || String(i.identifier || '').split('-')[0] || '';
  const url = i.url || payload.url || null;
  const stateName = i.state?.name || null;
  const stateType = i.state?.type || null;
  const link = { provider: 'linear', kind: 'issue', url, key: i.identifier, repo: team, title: clip(i.title, 300), state: stateName };
  const card = {
    provider: 'linear', kind: 'issue', action: payload.action, repo: team, key: i.identifier, url, title: clip(i.title, 300),
    state: stateType === 'completed' ? 'closed' : stateType === 'canceled' ? 'closed' : 'open',
    author: payload.actor?.name || i.creator?.name || null,
    extra: { status: stateName, statusType: stateType, assignee: i.assignee?.name || null, priority: i.priorityLabel || null },
  };
  if (payload.action === 'create') {
    out.push({ type: 'card', route: { match: team, event: 'issues' }, card, summary: `${i.identifier} created${card.author ? ` by ${card.author}` : ''}: ${i.title}` });
    out.push({ type: 'task.create', route: { match: team, event: 'issues' }, link, title: `[${i.identifier}] ${i.title}`, description: clip(i.description, 20_000), status: STATE_STATUS[stateType] || 'todo' });
  } else if (payload.action === 'update' && payload.updatedFrom && 'stateId' in payload.updatedFrom) {
    out.push({ type: 'card', route: { match: team, event: 'issues' }, card, summary: `${i.identifier} moved to ${stateName}: ${i.title}` });
    const status = STATE_STATUS[stateType];
    if (status !== undefined) out.push({ type: 'task.status', url, link, status, note: `Linear ${i.identifier} moved to ${stateName}` });
  } else if (payload.action === 'remove') {
    out.push({ type: 'card', route: { match: team, event: 'issues' }, card: { ...card, state: 'closed' }, summary: `${i.identifier} deleted: ${i.title}` });
  }
  return out;
}

module.exports = {
  type: 'linear',
  label: LABEL,
  category: 'developer',
  description: 'Linear issues in channels, task sync, and creating Linear issues from tasks.',
  setup: [
    'In Linear → Settings → Security & access → Personal API keys, create a key and paste it below. Oruinwan checks it right away.',
    'In Linear → Settings → API → Webhooks, add the webhook URL shown here with "Issues" ticked. Copy the signing secret Linear shows and paste it below.',
    'Map Linear team keys (e.g. ENG) to channels.',
  ],
  form: [
    { key: 'apiKey', label: 'Personal API key', kind: 'secret', required: true, placeholder: 'lin_api_…' },
    { key: 'webhookSecret', label: 'Webhook signing secret', kind: 'secret', placeholder: 'lin_wh_…', hint: 'Shown by Linear when you create the webhook.' },
  ],
  secrets: ['apiKey', 'webhookSecret'],
  generated: [],
  fields: {},
  defaults: () => ({ routes: [], linkTasks: true, createTasks: false, statusSync: true }),
  toggles: [
    { key: 'statusSync', label: 'Move linked tasks', description: 'When a Linear issue changes state, linked tasks move too.' },
    { key: 'createTasks', label: 'Create a task for each new issue', description: 'New Linear issues become tasks in the mapped channel.' },
  ],
  routes: { label: 'Team key', placeholder: 'ENG or *', hint: 'Use * for every team.', events: [{ id: 'issues', label: 'Issues' }] },
  required: ['apiKey'],
  webhook: { how: 'Header Linear-Signature: <hex HMAC of the body with the signing secret>' },

  async test(ctx) {
    const d = await gql(ctx, 'query { viewer { id name email } organization { name urlKey } }');
    return { account: { name: d.viewer?.name || null, email: d.viewer?.email || null, organization: d.organization?.name || null } };
  },

  verifyWebhook(req, ctx) {
    const secret = ctx.secret('webhookSecret');
    if (!secret) return deny('Paste the Linear webhook signing secret in Settings → Integrations first');
    const sig = header(req, 'linear-signature');
    if (!sig) return deny('Missing Linear-Signature');
    if (!req.rawBody) return deny('Cannot verify signature (raw body unavailable)');
    if (!safeEqual(sig, hmacHex(secret, req.rawBody))) return deny('Invalid signature');
    const ts = Number(req.body?.webhookTimestamp);
    if (ts && Math.abs(Date.now() - ts) > MAX_SKEW_MS) return deny('Stale delivery');
    return ok;
  },

  parseWebhook,

  actions: {
    teams: {
      method: 'GET',
      async run(ctx) {
        const d = await gql(ctx, 'query { teams(first: 50) { nodes { id key name } } }');
        return { teams: (d.teams?.nodes || []).map(t => ({ id: t.id, key: t.key, name: t.name })) };
      },
    },
    issues: {
      method: 'GET',
      async run(ctx, { team, q }) {
        const filter = {};
        if (team) filter.team = { key: { eq: String(team).toUpperCase() } };
        if (q) filter.title = { containsIgnoreCase: clip(q, 100) };
        const d = await gql(ctx, 'query($filter: IssueFilter) { issues(first: 30, filter: $filter, orderBy: updatedAt) { nodes { id identifier title url state { name type } assignee { name } } } }', { filter });
        return { issues: (d.issues?.nodes || []).map(i => ({ id: i.id, key: i.identifier, title: i.title, url: i.url, state: i.state?.name || null, assignee: i.assignee?.name || null })) };
      },
    },
    issue: {
      method: 'POST',
      linksTask: true,
      async run(ctx, { teamId, team, title, description }, env) {
        const t = clip(title, 255);
        if (!t) throw httpError(400, 'title is required');
        let id = teamId;
        if (!id && team) {
          const d = await gql(ctx, 'query($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id } } }', { key: String(team).toUpperCase() });
          id = d.teams?.nodes?.[0]?.id;
        }
        if (!id) throw httpError(400, 'teamId (or a team key) is required');
        const footer = env.user?.name ? `\n\n---\n_Created from Oruinwan by ${env.user.name}_` : '';
        const d = await gql(ctx, 'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url team { key } } } }', {
          input: { teamId: id, title: t, description: `${clip(description, 60_000)}${footer}` },
        });
        const i = d.issueCreate?.issue;
        if (!d.issueCreate?.success || !i) throw httpError(502, 'Linear did not create the issue', 'LINEAR_ERROR');
        return {
          issue: { id: i.id, key: i.identifier, url: i.url, title: i.title, team: i.team?.key || null },
          link: { provider: 'linear', kind: 'issue', url: i.url, key: i.identifier, repo: i.team?.key || null, title: i.title, state: 'Todo' },
          note: `Linear issue ${i.identifier} created`,
        };
      },
    },
  },
};
