'use strict';

/**
 * Linking external work (GitHub PRs / issues, Jira issues) to Oruinwan tasks.
 *
 * Task keys (e.g. "ABC-12") are looked for in a PR's title, branch and body,
 * then validated against the workspace's real tasks. Linked tasks get an
 * `externalLinks` entry (upserted by url), an activity line and, when
 * statusSync is on, a workflow-checked status move via the tasks service.
 */

const Task = require('../../../models/Task');
const logger = require('../../../utils/logger');

// Oruinwan keys are PREFIX-N (prefix: letters). Matched case-insensitively so
// branch names like "feature/abc-12-login" work; validated against real tasks.
const KEY_RE = /(?:^|[^A-Za-z0-9])([A-Za-z][A-Za-z0-9]{0,9})-(\d{1,7})(?![0-9])/g;
const MAX_KEYS = 20;

function extractTaskKeys(...texts) {
  const keys = new Set();
  for (const text of texts) {
    if (!text) continue;
    const s = String(text).slice(0, 20_000);
    for (const m of s.matchAll(KEY_RE)) {
      keys.add(`${m[1].toUpperCase()}-${Number(m[2])}`);
      if (keys.size >= MAX_KEYS) return [...keys];
    }
  }
  return [...keys];
}

const TASK_FIELDS = '_id issueKey title status visibility channel workspace createdBy assignedTo watchers externalLinks';

async function findTasksByKeys(workspaceId, keys) {
  if (!keys.length) return [];
  return Task.find({ workspace: workspaceId, issueKey: { $in: keys }, deleted: { $ne: true } }).select(TASK_FIELDS).lean();
}

async function findTasksByLinkUrl(workspaceId, url) {
  if (!url) return [];
  return Task.find({ workspace: workspaceId, 'externalLinks.url': url, deleted: { $ne: true } }).select(TASK_FIELDS).lean();
}

/** Activity line + target status for a PR event. */
function prEffect(card, { event, action, actor, reviewState }) {
  const ref = `PR #${card.number}`;
  const by = actor ? ` by ${actor}` : '';
  if (event === 'pull_request_review') {
    if (action !== 'submitted' || !reviewState) return {};
    const label = { approved: 'approved', changes_requested: 'changes requested', commented: 'reviewed' }[reviewState] || reviewState;
    return { note: `${ref} ${label}${by}` };
  }
  if (event !== 'pull_request') return {};
  switch (action) {
    case 'opened':
      return card.state === 'draft'
        ? { note: `${ref} opened as draft${by}`, status: 'in_progress', onlyFrom: ['backlog', 'todo'] }
        : { note: `${ref} opened${by}`, status: 'review', onlyFrom: ['backlog', 'todo', 'in_progress'] };
    case 'reopened':
      return { note: `${ref} reopened${by}`, status: card.state === 'draft' ? null : 'review', onlyFrom: ['backlog', 'todo', 'in_progress'] };
    case 'ready_for_review':
      return { note: `${ref} is ready for review`, status: 'review', onlyFrom: ['backlog', 'todo', 'in_progress'] };
    case 'converted_to_draft':
      return { note: `${ref} converted to draft` };
    case 'closed':
      return card.state === 'merged'
        ? { note: `${ref} merged${by}`, status: 'done' }
        : { note: `${ref} closed without merging${by}` };
    case 'edited':
    case 'synchronize':
      return {};
    default:
      return {};
  }
}

/**
 * Link the tasks to a PR card and apply the event's effects.
 * @returns {Promise<Array<{ id, issueKey, statusChanged, to }>>}
 */
async function applyToTasks(tasks, { link, note, status, onlyFrom, statusSync, actorId, action = 'integration_event', io }) {
  const tasksService = require('../tasks/tasks.service');
  const results = [];
  for (const t of tasks) {
    try {
      const r = await tasksService.applyExternalUpdate(String(t._id), {
        actorId,
        link,
        note,
        action,
        status: statusSync ? status : null,
        onlyFrom,
      }, io);
      results.push({ id: String(t._id), issueKey: t.issueKey, statusChanged: r.statusChanged, to: r.to });
    } catch (err) {
      logger.warn({ taskId: String(t._id), err: err.message }, '[integrations] task update failed');
    }
  }
  return results;
}

module.exports = { extractTaskKeys, findTasksByKeys, findTasksByLinkUrl, prEffect, applyToTasks };
