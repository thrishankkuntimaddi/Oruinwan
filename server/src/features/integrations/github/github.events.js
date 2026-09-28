'use strict';

/**
 * Incoming GitHub webhook events → channel cards, thread replies and task updates.
 *
 * Routing: the first route whose repo equals the event's repo (then the first
 * '*' route) and whose `events` include the event decides the channel; no
 * match means nothing is posted (linked tasks are still updated).
 *
 * Cards: one per PR / issue per channel. Later events (synchronize, review,
 * checks, merged, closed) update the card in place (`message:edited`), and
 * only meaningful events add a short thread reply: review submitted, merged,
 * checks failed. Pushes get one compact card each and no thread.
 */

const Message = require('../../../modules/messages/message.model.js');
const logger = require('../../../../utils/logger');
const bot = require('../integration.bot');
const links = require('../integration.tasks');

const PR_ACTIONS = new Set(['opened', 'reopened', 'closed', 'ready_for_review', 'converted_to_draft', 'synchronize', 'edited']);
const ISSUE_ACTIONS = new Set(['opened', 'reopened', 'closed', 'edited']);
const FAILED = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);

/** First matching route: exact repo, then '*'. */
function pickRoute(config, repo, event) {
  const routes = Array.isArray(config?.routes) ? config.routes : [];
  const wants = (r) => !Array.isArray(r.events) || r.events.includes(event);
  const name = String(repo || '').toLowerCase();
  return routes.find(r => r.repo === name && wants(r)) || routes.find(r => r.repo === '*' && wants(r)) || null;
}

function prState(pr) {
  if (pr.merged || pr.merged_at) return 'merged';
  if (pr.state === 'closed') return 'closed';
  if (pr.draft) return 'draft';
  return 'open';
}

function prCard(pr, repo, action) {
  return {
    provider: 'github',
    kind: 'pull_request',
    action,
    repo,
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    state: prState(pr),
    author: pr.user?.login || null,
    authorAvatar: pr.user?.avatar_url || null,
    branch: pr.head?.ref || null,
    base: pr.base?.ref || null,
    additions: pr.additions ?? undefined,
    deletions: pr.deletions ?? undefined,
    changedFiles: pr.changed_files ?? undefined,
    commits: pr.commits ?? undefined,
  };
}

const STATE_VERB = { open: 'opened', draft: 'opened as draft', merged: 'merged', closed: 'closed' };

function prSummary(card, actor) {
  const verb = card.action === 'synchronize' ? 'updated' : card.action === 'ready_for_review' ? 'ready for review' : (STATE_VERB[card.state] || card.action);
  const by = actor ? ` by ${actor}` : '';
  return `PR #${card.number} ${verb}${by} in ${card.repo}: ${card.title}`.slice(0, 500);
}

/** Cards of this object already posted in the workspace (any channel). */
async function findCards(workspaceId, url) {
  return Message.find({ workspace: workspaceId, type: 'integration', 'integration.url': url, isDeleted: { $ne: true }, parentId: null })
    .select('_id channel workspace company integration').lean();
}

async function linkTasksFor(workspaceId, card, texts) {
  const keys = links.extractTaskKeys(...texts);
  const [byKey, byLink] = await Promise.all([
    links.findTasksByKeys(workspaceId, keys),
    links.findTasksByLinkUrl(workspaceId, card.url),
  ]);
  const map = new Map();
  [...byKey, ...byLink].forEach(t => map.set(String(t._id), t));
  return [...map.values()];
}

async function handlePullRequest({ integration, payload, route, io }) {
  const { action } = payload;
  const pr = payload.pull_request;
  if (!pr || !PR_ACTIONS.has(action)) return { ignored: `pull_request.${action}` };
  const workspaceId = integration.workspaceId;
  const config = integration.config || {};
  const repo = payload.repository?.full_name;
  const card = prCard(pr, repo, action);
  const actor = action === 'closed' && card.state === 'merged' ? (pr.merged_by?.login || payload.sender?.login) : payload.sender?.login;

  let tasks = [];
  if (config.linkTasks !== false) {
    tasks = await linkTasksFor(workspaceId, card, [pr.title, pr.head?.ref, pr.body]);
    card.taskIds = tasks.map(t => t._id);
    card.taskKeys = tasks.map(t => t.issueKey).filter(Boolean);
  }

  let posted = null;
  if (route) {
    posted = await bot.upsertCard({ workspaceId, channelId: route.channelId, provider: 'github', card, summary: prSummary(card, actor), io });
    if (posted && !posted.created && action === 'closed' && card.state === 'merged') {
      const gh = await bot.getBotUser('github');
      await bot.postThreadReply({ parent: posted.message, senderId: gh._id, text: `🟣 Merged${actor ? ` by ${actor}` : ''} into \`${card.base}\``, io });
    }
  }

  let taskResults = [];
  if (tasks.length) {
    const effect = links.prEffect(card, { event: 'pull_request', action, actor });
    const gh = await bot.getBotUser('github');
    taskResults = await links.applyToTasks(tasks, {
      link: { provider: 'github', kind: 'pull_request', url: card.url, repo, number: card.number, title: card.title, state: card.state },
      note: effect.note,
      status: effect.status,
      onlyFrom: effect.onlyFrom,
      statusSync: config.statusSync !== false,
      actorId: gh._id,
      io,
    });
  }

  if (config.autoReview && ['opened', 'ready_for_review', 'reopened'].includes(action) && card.state === 'open') {
    setImmediate(() => {
      require('./github.review').runReview({
        integration, workspaceId: String(workspaceId), repo, number: card.number,
        messageId: posted?.message?._id ? String(posted.message._id) : null, userId: null, io, auto: true,
      }).catch(err => logger.warn({ err: err.message, repo, number: card.number }, '[github] auto review failed'));
    });
  }

  return { card: posted ? String(posted.message._id) : null, created: !!posted?.created, tasks: taskResults };
}

async function handleReview({ integration, payload, route, io }) {
  if (payload.action !== 'submitted' || !payload.review || !payload.pull_request) return { ignored: `pull_request_review.${payload.action}` };
  const workspaceId = integration.workspaceId;
  const config = integration.config || {};
  const repo = payload.repository?.full_name;
  const pr = payload.pull_request;
  const reviewState = String(payload.review.state || '').toLowerCase();
  const reviewer = payload.review.user?.login || payload.sender?.login;
  const card = { ...prCard(pr, repo, 'review_submitted'), reviewState };
  // The review payload's PR lacks line counts; keep what the card already has.
  ['additions', 'deletions', 'changedFiles', 'commits'].forEach(k => { if (card[k] === undefined) delete card[k]; });

  const tasks = config.linkTasks !== false ? await linkTasksFor(workspaceId, card, [pr.title, pr.head?.ref, pr.body]) : [];
  if (tasks.length) {
    card.taskIds = tasks.map(t => t._id);
    card.taskKeys = tasks.map(t => t.issueKey).filter(Boolean);
  }

  let posted = null;
  if (route) {
    const label = { approved: 'approved', changes_requested: 'changes requested', commented: 'reviewed' }[reviewState] || reviewState;
    posted = await bot.upsertCard({ workspaceId, channelId: route.channelId, provider: 'github', card, summary: `PR #${card.number} ${label} by ${reviewer} in ${repo}: ${card.title}`.slice(0, 500), io });
    const body = String(payload.review.body || '').trim();
    const meaningful = reviewState !== 'commented' || body;
    if (posted && meaningful) {
      const icon = { approved: '✅', changes_requested: '❌', commented: '💬' }[reviewState] || '📝';
      const verb = { approved: 'approved these changes', changes_requested: 'requested changes', commented: 'commented' }[reviewState] || reviewState;
      const snippet = body ? `\n> ${body.slice(0, 400).replace(/\n+/g, '\n> ')}` : '';
      const gh = await bot.getBotUser('github');
      await bot.postThreadReply({ parent: posted.message, senderId: gh._id, text: `${icon} **${reviewer}** ${verb}${snippet}`, io });
    }
  }

  let taskResults = [];
  if (tasks.length) {
    const effect = links.prEffect(card, { event: 'pull_request_review', action: 'submitted', actor: reviewer, reviewState });
    const gh = await bot.getBotUser('github');
    taskResults = await links.applyToTasks(tasks, {
      link: { provider: 'github', kind: 'pull_request', url: card.url, repo, number: card.number, title: card.title, state: card.state },
      note: effect.note,
      statusSync: false,
      actorId: gh._id,
      io,
    });
  }
  return { card: posted ? String(posted.message._id) : null, tasks: taskResults };
}

/** check_suite / workflow_run completed → update the PR cards' checks; thread reply on failure. */
async function handleChecks({ integration, event, payload, route, io }) {
  const run = event === 'check_suite' ? payload.check_suite : payload.workflow_run;
  if (!run || payload.action !== 'completed') return { ignored: `${event}.${payload.action}` };
  if (!route) return { ignored: `${event} (no route subscribes to it)` };
  const workspaceId = integration.workspaceId;
  const repo = payload.repository?.full_name;
  const conclusion = run.conclusion || null;
  const headSha = run.head_sha || null;
  const checks = { status: 'completed', conclusion, headSha, name: run.name || run.app?.name || null, url: run.html_url || null };
  const failed = FAILED.has(conclusion);
  const repoUrl = payload.repository?.html_url || `https://github.com/${repo}`;
  const prs = (run.pull_requests || []).filter(p => p?.number);
  const gh = await bot.getBotUser('github');
  const updated = [];

  for (const p of prs) {
    const url = `${repoUrl}/pull/${p.number}`;
    const cards = await findCards(workspaceId, url);
    for (const c of cards) {
      const prev = c.integration?.checks || {};
      const alreadyReported = prev.headSha === headSha && FAILED.has(prev.conclusion);
      const res = await bot.upsertCard({
        workspaceId, channelId: c.channel, provider: 'github',
        card: { url, checks, action: `${event}_completed` },
        summary: `PR #${p.number} checks ${failed ? 'failed' : conclusion || 'completed'} in ${repo}: ${c.integration?.title || ''}`.slice(0, 500),
        io,
      });
      if (res) updated.push(String(res.message._id));
      if (res && failed && !alreadyReported) {
        await bot.postThreadReply({ parent: res.message, senderId: gh._id, text: `🔴 Checks failed${checks.name ? ` (${checks.name})` : ''}${checks.url ? `: ${checks.url}` : ''}`, io });
      }
    }
  }

  // A failing run with no PR (e.g. on main): one compact card per commit.
  if (!prs.length && failed && route) {
    const url = `${repoUrl}/commit/${headSha}/checks`;
    const branch = run.head_branch || null;
    const res = await bot.upsertCard({
      workspaceId, channelId: route.channelId, provider: 'github',
      card: { provider: 'github', kind: 'checks', action: `${event}_completed`, repo, url, title: checks.name || 'Checks', state: 'closed', branch, checks, author: payload.sender?.login || null },
      summary: `Checks failed on ${branch || headSha?.slice(0, 7)} in ${repo}${checks.name ? ` (${checks.name})` : ''}`.slice(0, 500),
      io,
    });
    if (res) updated.push(String(res.message._id));
  }
  return { cards: updated };
}

async function handleIssue({ integration, payload, route, io }) {
  const { action, issue } = payload;
  if (!issue || issue.pull_request || !ISSUE_ACTIONS.has(action)) return { ignored: `issues.${action}` };
  const workspaceId = integration.workspaceId;
  const config = integration.config || {};
  const repo = payload.repository?.full_name;
  const card = {
    provider: 'github', kind: 'issue', action, repo, number: issue.number, url: issue.html_url, title: issue.title,
    state: issue.state === 'closed' ? 'closed' : 'open', author: issue.user?.login || null, authorAvatar: issue.user?.avatar_url || null,
  };
  const actor = payload.sender?.login;
  const tasks = config.linkTasks !== false ? await linkTasksFor(workspaceId, card, [issue.title, issue.body]) : [];
  if (tasks.length) {
    card.taskIds = tasks.map(t => t._id);
    card.taskKeys = tasks.map(t => t.issueKey).filter(Boolean);
  }
  let posted = null;
  if (route && (action !== 'edited' || (await findCards(workspaceId, card.url)).length)) {
    const verb = { opened: 'opened', reopened: 'reopened', closed: 'closed', edited: 'edited' }[action];
    posted = await bot.upsertCard({ workspaceId, channelId: route.channelId, provider: 'github', card, summary: `Issue #${card.number} ${verb}${actor ? ` by ${actor}` : ''} in ${repo}: ${card.title}`.slice(0, 500), io });
  }
  if (tasks.length && action !== 'edited') {
    const gh = await bot.getBotUser('github');
    await links.applyToTasks(tasks, {
      link: { provider: 'github', kind: 'issue', url: card.url, repo, number: card.number, title: card.title, state: card.state },
      note: `Issue #${card.number} ${action}${actor ? ` by ${actor}` : ''}`,
      statusSync: false,
      actorId: gh._id,
      io,
    });
  }
  return { card: posted ? String(posted.message._id) : null };
}

async function handlePush({ integration, payload, route, io }) {
  if (!route || payload.deleted) return { ignored: 'push' };
  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  if (!commits.length) return { ignored: 'push without commits' };
  const repo = payload.repository?.full_name;
  const branch = String(payload.ref || '').replace(/^refs\/(heads|tags)\//, '');
  const pusher = payload.pusher?.name || payload.sender?.login || null;
  const head = payload.head_commit || commits[commits.length - 1];
  const count = payload.size || commits.length;
  const card = {
    provider: 'github', kind: 'push', action: payload.forced ? 'force_push' : 'push', repo, url: payload.compare || head?.url || null,
    title: String(head?.message || '').split('\n')[0].slice(0, 200), branch, author: pusher,
    authorAvatar: payload.sender?.avatar_url || null, commits: count,
    extra: { commitCount: count, compareUrl: payload.compare || null, headCommit: head ? { id: head.id, message: String(head.message || '').split('\n')[0].slice(0, 200), url: head.url } : null, forced: !!payload.forced },
  };
  const posted = await bot.upsertCard({
    workspaceId: integration.workspaceId, channelId: route.channelId, provider: 'github', card, dedupe: false,
    summary: `${pusher || 'Someone'} pushed ${count} commit${count === 1 ? '' : 's'} to ${branch} in ${repo}`, io,
  });
  return { card: posted ? String(posted.message._id) : null };
}

/**
 * @param {{ integration: object, event: string, payload: object, io?: object }} input
 */
async function processGithubEvent({ integration, event, payload, io }) {
  if (event === 'ping') return { ok: true, pong: true };
  const repo = payload?.repository?.full_name;
  if (!repo) return { ok: true, ignored: 'no repository' };
  const route = pickRoute(integration.config, repo, event);
  const ctx = { integration, event, payload, route, io };
  let result;
  switch (event) {
    case 'pull_request': result = await handlePullRequest(ctx); break;
    case 'pull_request_review': result = await handleReview(ctx); break;
    case 'check_suite':
    case 'workflow_run': result = await handleChecks(ctx); break;
    case 'issues': result = await handleIssue(ctx); break;
    case 'push': result = await handlePush(ctx); break;
    default: result = { ignored: event };
  }
  return { ok: true, event, routed: route ? route.channelId : null, ...result };
}

module.exports = { processGithubEvent, pickRoute, prCard, prState, prSummary };
