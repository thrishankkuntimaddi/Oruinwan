'use strict';

/**
 * Incoming Jira webhook events → channel cards and task sync.
 *
 * Jira issues map to Oruinwan tasks through an externalLinks entry
 * (provider 'jira', url <baseUrl>/browse/KEY). With linkTasks on and a route
 * for the project, `jira:issue_created` creates a channel task in the routed
 * channel. With statusSync on, a Jira status-category change moves linked
 * tasks (To Do → todo, In Progress → in_progress, Done → done) when the
 * workflow allows it.
 */

const Task = require('../../../../models/Task');
const Workspace = require('../../../../models/Workspace');
const logger = require('../../../../utils/logger');
const bot = require('../integration.bot');
const links = require('../integration.tasks');
const { fromAdf } = require('./jira.client');

const CATEGORY_STATUS = { new: 'todo', indeterminate: 'in_progress', done: 'done' };

function pickRoute(config, projectKey) {
  const routes = Array.isArray(config?.routes) ? config.routes : [];
  const key = String(projectKey || '').toUpperCase();
  return routes.find(r => r.project === key) || routes.find(r => r.project === '*') || null;
}

function issueUrl(config, issue) {
  const base = String(config?.baseUrl || '').replace(/\/+$/, '');
  if (base) return `${base}/browse/${issue.key}`;
  try { return `${new URL(issue.self).origin}/browse/${issue.key}`; } catch { return null; }
}

async function createTaskFromIssue({ integration, channelId, issue, url, card }) {
  if (!integration.connectedBy) return null;
  const { nextIssueKey, emitToTaskAudience, loadTaskForClient } = require('../../tasks/tasks.shared');
  const ws = await Workspace.findById(integration.workspaceId).select('name company').lean();
  if (!ws) return null;
  const fields = issue.fields || {};
  const status = CATEGORY_STATUS[fields.status?.statusCategory?.key] || 'todo';
  const task = await Task.create({
    company: ws.company || null,
    workspace: integration.workspaceId,
    issueKey: await nextIssueKey(integration.workspaceId, ws.name),
    taskType: 'channel',
    visibility: 'channel',
    channel: channelId,
    title: `[${issue.key}] ${fields.summary || 'Jira issue'}`.slice(0, 300),
    description: fromAdf(fields.description).slice(0, 20_000),
    createdBy: integration.connectedBy,
    status,
    ...(status === 'done' && { completedAt: new Date() }),
    externalLinks: [{ provider: 'jira', kind: 'jira_issue', url, key: issue.key, repo: card.repo, title: fields.summary || '', state: card.state, updatedAt: new Date() }],
  });
  try {
    const io = require('../../../socket/getIO').getIO();
    await emitToTaskAudience(io, task, 'task-created', await loadTaskForClient(task._id));
  } catch (err) {
    logger.warn({ err: err.message }, '[jira] task-created emit failed');
  }
  return task;
}

async function processJiraEvent({ integration, payload, io }) {
  const event = String(payload?.webhookEvent || '');
  const issue = payload?.issue;
  if (!issue?.key || !/^jira:issue_(created|updated|deleted)$/.test(event)) return { ok: true, ignored: event || 'unknown' };

  const config = integration.config || {};
  const workspaceId = integration.workspaceId;
  const fields = issue.fields || {};
  const projectKey = fields.project?.key || issue.key.split('-')[0];
  const action = event.replace('jira:issue_', '');
  const url = issueUrl(config, issue);
  if (!url) return { ok: true, ignored: 'no issue url' };
  const actor = payload.user?.displayName || null;
  const statusChange = (payload.changelog?.items || []).find(i => i.field === 'status');

  const card = {
    provider: 'jira',
    kind: 'jira_issue',
    action,
    repo: projectKey,
    key: issue.key,
    url,
    title: fields.summary || issue.key,
    state: action === 'deleted' ? 'deleted' : (fields.status?.name || null),
    author: actor,
    authorAvatar: payload.user?.avatarUrls?.['48x48'] || null,
    extra: {
      issueType: fields.issuetype?.name || null,
      priority: fields.priority?.name || null,
      assignee: fields.assignee?.displayName || null,
      statusCategory: fields.status?.statusCategory?.key || null,
    },
  };

  const route = pickRoute(config, projectKey);
  const tasks = config.linkTasks !== false ? await links.findTasksByLinkUrl(workspaceId, url) : [];
  let createdTask = null;
  if (action === 'created' && config.linkTasks !== false && route && !tasks.length) {
    createdTask = await createTaskFromIssue({ integration, channelId: route.channelId, issue, url, card }).catch((err) => {
      logger.warn({ err: err.message, key: issue.key }, '[jira] task creation failed');
      return null;
    });
  }
  const linkedTasks = createdTask ? [createdTask] : tasks;
  card.taskIds = linkedTasks.map(t => t._id);
  card.taskKeys = linkedTasks.map(t => t.issueKey).filter(Boolean);

  let posted = null;
  if (route) {
    const verb = { created: 'created', updated: statusChange ? `moved to ${statusChange.toString}` : 'updated', deleted: 'deleted' }[action];
    posted = await bot.upsertCard({
      workspaceId, channelId: route.channelId, provider: 'jira', card,
      summary: `${issue.key} ${verb}${actor ? ` by ${actor}` : ''}: ${card.title}`.slice(0, 500), io,
    });
    if (posted && !posted.created && statusChange) {
      const jb = await bot.getBotUser('jira');
      await bot.postThreadReply({ parent: posted.message, senderId: jb._id, text: `🔀 Status: **${statusChange.fromString}** → **${statusChange.toString}**${actor ? ` by ${actor}` : ''}`, io });
    }
  }

  let taskResults = [];
  if (tasks.length && action !== 'created') {
    const jb = await bot.getBotUser('jira');
    const target = statusChange ? CATEGORY_STATUS[fields.status?.statusCategory?.key] : null;
    const note = action === 'deleted'
      ? `Jira ${issue.key} was deleted${actor ? ` by ${actor}` : ''}`
      : statusChange ? `Jira ${issue.key} moved to ${statusChange.toString}${actor ? ` by ${actor}` : ''}` : null;
    taskResults = await links.applyToTasks(tasks, {
      link: { provider: 'jira', kind: 'jira_issue', url, key: issue.key, repo: projectKey, title: card.title, state: card.state },
      note,
      status: target,
      statusSync: config.statusSync !== false,
      actorId: jb._id,
      io,
    });
  } else if (createdTask) {
    const jb = await bot.getBotUser('jira');
    taskResults = await links.applyToTasks([createdTask], {
      note: `Created from Jira ${issue.key}${actor ? ` (reported by ${actor})` : ''}`,
      statusSync: false,
      actorId: jb._id,
      io,
    });
  }

  return {
    ok: true,
    event,
    routed: route ? route.channelId : null,
    card: posted ? String(posted.message._id) : null,
    createdTask: createdTask ? { id: String(createdTask._id), issueKey: createdTask.issueKey } : null,
    tasks: taskResults,
  };
}

module.exports = { processJiraEvent, pickRoute, CATEGORY_STATUS };
