'use strict';

/**
 * Generic CI/CD webhook: build results posted to a channel and handed to
 * automations (trigger "webhook.received", webhookType "cicd").
 *
 * Understands GitHub Actions (workflow_run), GitLab CI (pipeline hook),
 * Jenkins (Notification plugin), CircleCI (webhooks v2) and a generic shape
 * { name, status, url, branch, repo, commit }.
 *
 * Authentication (any one, all against the generated token):
 *   ?token=<token> or X-Oruinwan-Token          (Jenkins, generic)
 *   X-Hub-Signature-256: sha256=<HMAC>           (GitHub repository webhook)
 *   X-Gitlab-Token: <token>                      (GitLab)
 *   circleci-signature: v1=<HMAC hex>            (CircleCI)
 */

const { header, safeEqual, hmacHex, clip } = require('./http');
const { ok, deny, verifyToken, buildStatus, checksOf } = require('./common');

const LABEL = 'CI/CD';

/** @returns {null | { system, pipeline, repo, status, url, branch, commit, number, raw }} */
function normalize(payload, headers = {}) {
  if (!payload || typeof payload !== 'object') return null;

  // GitHub Actions: repository webhook with "Workflow runs".
  if (payload.workflow_run) {
    const r = payload.workflow_run;
    if (payload.action && !['completed', 'in_progress', 'requested'].includes(payload.action)) return null;
    return {
      system: 'GitHub Actions', pipeline: r.name || payload.workflow?.name || 'Workflow', repo: payload.repository?.full_name || null,
      status: buildStatus(r.status === 'completed' ? r.conclusion : r.status), url: r.html_url || null,
      branch: r.head_branch || null, commit: r.head_sha || null, number: r.run_number ?? null,
    };
  }
  // GitLab CI pipeline hook.
  if (payload.object_kind === 'pipeline') {
    const a = payload.object_attributes || {};
    const url = payload.project?.web_url ? `${payload.project.web_url}/-/pipelines/${a.id}` : null;
    return {
      system: 'GitLab CI', pipeline: a.name || `Pipeline #${a.id}`, repo: payload.project?.path_with_namespace || null,
      status: buildStatus(a.status), url, branch: a.ref || null, commit: a.sha || null, number: a.id ?? null,
    };
  }
  // CircleCI webhooks.
  if (payload.type === 'workflow-completed' || payload.type === 'job-completed') {
    const unit = payload.workflow || payload.job || {};
    const vcs = payload.pipeline?.vcs || {};
    return {
      system: 'CircleCI', pipeline: unit.name || 'Workflow', repo: payload.project?.slug?.split('/').slice(-2).join('/') || payload.project?.name || null,
      status: buildStatus(unit.status), url: unit.url || null, branch: vcs.branch || null, commit: vcs.revision || null, number: payload.pipeline?.number ?? null,
    };
  }
  // Jenkins Notification plugin.
  if (payload.build && (payload.build.phase || payload.build.full_url)) {
    const b = payload.build;
    const phase = String(b.phase || '').toUpperCase();
    const status = phase === 'STARTED' || phase === 'QUEUED' ? 'running' : buildStatus(b.status);
    return {
      system: 'Jenkins', pipeline: payload.name || payload.display_name || 'Job', repo: b.scm?.url ? b.scm.url.replace(/^.*[:/]([^/]+\/[^/]+?)(\.git)?$/, '$1') : null,
      status, url: b.full_url || null, branch: b.scm?.branch || null, commit: b.scm?.commit || null, number: b.number ?? null, phase,
    };
  }
  // Generic.
  const status = payload.status || payload.state || payload.conclusion || payload.result;
  if (!status) return null;
  return {
    system: clip(payload.system || headers['x-ci-system'] || 'CI', 60), pipeline: clip(payload.name || payload.pipeline || payload.workflow || payload.job || 'Pipeline', 200),
    repo: clip(payload.repo || payload.repository || '', 200) || null, status: buildStatus(status),
    url: typeof payload.url === 'string' && /^https?:\/\//.test(payload.url) ? payload.url : (typeof payload.build_url === 'string' ? payload.build_url : null),
    branch: clip(payload.branch || payload.ref || '', 200).replace(/^refs\/heads\//, '') || null, commit: clip(payload.commit || payload.sha || '', 64) || null,
    number: payload.number ?? payload.build_number ?? null,
  };
}

const ICON = { success: '✅', failure: '❌', cancelled: '⚪', running: '🔄', unknown: '❔' };

function wanted(notifyOn, n) {
  if (n.phase === 'COMPLETED' && n.status !== 'running') return false; // Jenkins sends COMPLETED then FINALIZED: post once.
  if (notifyOn === 'all') return true;
  if (notifyOn === 'failures') return n.status === 'failure';
  return n.status !== 'running';
}

function parseWebhook({ payload, headers, ctx }) {
  const n = normalize(payload, headers);
  if (!n) return [];
  const out = [{ type: 'automation', data: { webhookType: 'cicd', ...n } }];
  if (!wanted(ctx.config.notifyOn || 'finished', n)) return out;
  const title = `${n.pipeline}${n.number !== null && n.number !== undefined ? ` #${n.number}` : ''}`;
  out.push({
    type: 'card',
    route: { match: n.repo || n.pipeline, event: n.status === 'failure' ? 'failure' : 'build' },
    card: {
      provider: 'cicd', kind: 'checks', repo: n.repo, branch: n.branch, url: n.url, title, state: n.status,
      checks: checksOf(n.status, { name: title, url: n.url }), extra: { system: n.system, commit: n.commit },
    },
    summary: `${ICON[n.status] || ''} ${n.system}: ${title} ${n.status}${n.branch ? ` on ${n.branch}` : ''}${n.repo ? ` (${n.repo})` : ''}`.trim(),
  });
  return out;
}

module.exports = {
  type: 'cicd',
  label: LABEL,
  category: 'developer',
  description: 'Build and deploy results from GitHub Actions, GitLab CI, Jenkins or CircleCI posted to a channel, and an automation trigger.',
  setup: [
    'Save to get a webhook URL with its token, then pick a channel for build results.',
    'GitHub Actions: repository → Settings → Webhooks → add the URL, content type application/json, secret = the token, event "Workflow runs".',
    'GitLab CI: project → Settings → Webhooks → the URL, secret token = the token, "Pipeline events".',
    'Jenkins: Notification plugin → JSON over HTTP to the URL (token included).',
    'CircleCI: project settings → Webhooks → the URL, secret = the token, "Workflow completed".',
    'Anything else: POST JSON {"name","status","url","branch","repo"} to the URL.',
  ],
  form: [
    { key: 'notifyOn', label: 'Post', kind: 'select', options: [{ value: 'finished', label: 'Finished builds' }, { value: 'failures', label: 'Failures only' }, { value: 'all', label: 'Every update (started, finished)' }] },
  ],
  secrets: ['webhookToken'],
  generated: ['webhookToken'],
  fields: { notifyOn: (v) => (['all', 'finished', 'failures'].includes(v) ? v : 'finished') },
  defaults: () => ({ notifyOn: 'finished', routes: [], defaultChannelId: null }),
  toggles: [],
  routes: { label: 'Repository or pipeline', placeholder: 'owner/repo, pipeline name or *', hint: 'Unmatched builds go to the default channel.', events: [{ id: 'build', label: 'Successful / other' }, { id: 'failure', label: 'Failures' }] },
  defaultChannel: true,
  required: [],
  isConfigured: () => true,
  webhook: { tokenInUrl: true, how: 'Token in the URL, X-Oruinwan-Token, X-Gitlab-Token, a GitHub sha256 signature or a CircleCI v1 signature' },

  async test() {
    return { account: { name: 'Webhook ready' } };
  },

  verifyWebhook(req, ctx) {
    const token = ctx.secret('webhookToken');
    if (!token) return deny('Webhook token not configured');
    const hub = header(req, 'x-hub-signature-256');
    if (hub && req.rawBody) return safeEqual(hub, `sha256=${hmacHex(token, req.rawBody)}`) ? ok : deny('Invalid signature');
    const circle = header(req, 'circleci-signature');
    if (circle && req.rawBody) {
      const v1 = circle.split(',').map(s => s.trim()).find(s => s.startsWith('v1='));
      return v1 && safeEqual(v1.slice(3), hmacHex(token, req.rawBody)) ? ok : deny('Invalid signature');
    }
    const gl = header(req, 'x-gitlab-token');
    if (gl) return safeEqual(gl, token) ? ok : deny('Invalid token');
    return verifyToken(req, ctx, 'webhookToken');
  },

  parseWebhook,
  normalize,
  actions: {},
};
