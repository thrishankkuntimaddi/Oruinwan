'use strict';

/**
 * Apply the effects a connector parsed from an incoming webhook (see
 * connectors/common.js): create / link / move tasks, post bot cards in the
 * mapped channels, and collect the automation payload and any synchronous
 * response body.
 *
 * Channels: an effect names `channelId` directly (bridges, automation tools —
 * always a channel the admin configured) or a `route` matched against
 * config.routes, falling back to config.defaultChannelId for connectors that
 * have a default channel. Bot posts only ever go to channels of the
 * integration's own workspace (integration.bot checks).
 */

const Tasks = require('../tasks/tasks.query');
const { workspaces } = require('../../identity');
const logger = require('../../../utils/logger');
const bot = require('./integration.bot');
const links = require('./integration.tasks');
const { pickRoute } = require('./connectors/common');

function resolveChannel(config, connector, effect) {
  if (effect.channelId) return String(effect.channelId);
  const route = effect.route ? pickRoute(config, effect.route.match, effect.route.event) : null;
  if (route) return route.channelId;
  return connector?.defaultChannel && config.defaultChannelId ? String(config.defaultChannelId) : null;
}

/** A channel task created on behalf of the person who connected the integration. */
async function createTask({ integration, channelId, title, description, link, status = 'todo', dueDate = null }) {
  if (!integration.connectedBy) return null;
  const channel = await bot.loadPostableChannel(integration.workspaceId, channelId);
  if (!channel) return null;
  const ws = await workspaces.findById(integration.workspaceId);
  if (!ws) return null;
  const task = await Tasks.create({
    company: ws.company || null,
    workspace: integration.workspaceId,
    taskType: 'channel',
    visibility: 'channel',
    channel: channel._id,
    title: String(title || 'Untitled').slice(0, 300),
    description: String(description || '').slice(0, 20_000),
    createdBy: integration.connectedBy,
    status,
    ...(status === 'done' && { completedAt: new Date() }),
    ...(dueDate && { dueDate }),
    ...(link?.url && { externalLinks: [{ ...link, updatedAt: new Date() }] }),
  });
  try {
    const { emitToTaskAudience, loadTaskForClient } = require('../tasks/tasks.shared');
    const io = require('../../socket/getIO').getIO();
    await emitToTaskAudience(io, task, 'task-created', await loadTaskForClient(task._id));
  } catch (err) {
    logger.warn({ err: err.message }, '[integrations] task-created emit failed');
  }
  return task;
}

/**
 * @returns {Promise<{ posted: string[], tasks: object[], createdTasks: object[], automation: object|null, response: object|null }>}
 */
async function applyEffects({ integration, connector, effects, io }) {
  const config = integration.config || {};
  const workspaceId = integration.workspaceId;
  const out = { posted: [], tasks: [], createdTasks: [], automation: null, response: null };
  const linked = new Map(); // link url -> tasks
  const botFor = async (provider) => (await bot.getBotUser(provider))._id;
  const provider = connector.type;

  for (const e of effects) {
    try {
      if (e.type === 'task.create') {
        if (!e.explicit && !config.createTasks) continue;
        const channelId = resolveChannel(config, connector, e);
        if (!channelId) continue;
        if (e.link?.url && (await links.findTasksByLinkUrl(workspaceId, e.link.url)).length) continue;
        const task = await createTask({ integration, channelId, title: e.title, description: e.description, link: e.link, status: e.status || 'todo', dueDate: e.dueDate || null });
        if (!task) continue;
        out.createdTasks.push({ id: String(task._id), issueKey: task.issueKey || null });
        if (e.link?.url) linked.set(e.link.url, [task]);
        if (e.note) await links.applyToTasks([task], { note: e.note, statusSync: false, actorId: await botFor(provider), io });
      } else if (e.type === 'task.link') {
        if (config.linkTasks === false || !e.link?.url) continue;
        const keys = links.extractTaskKeys(...(e.texts || []));
        const [byKey, byLink] = await Promise.all([links.findTasksByKeys(workspaceId, keys), links.findTasksByLinkUrl(workspaceId, e.link.url)]);
        const tasks = [...new Map([...byKey, ...byLink].map(t => [String(t._id), t])).values()];
        if (!tasks.length) continue;
        linked.set(e.link.url, tasks);
        out.tasks.push(...await links.applyToTasks(tasks, {
          link: e.link, note: e.note || null, status: e.status || null, onlyFrom: e.onlyFrom,
          statusSync: config.statusSync !== false, actorId: await botFor(provider), io,
        }));
      } else if (e.type === 'task.status') {
        const tasks = await links.findTasksByLinkUrl(workspaceId, e.url);
        if (!tasks.length) continue;
        linked.set(e.url, tasks);
        out.tasks.push(...await links.applyToTasks(tasks, {
          link: e.link || null, note: e.note || null, status: e.status || null,
          statusSync: config.statusSync !== false, actorId: await botFor(provider), io,
        }));
      } else if (e.type === 'automation') {
        out.automation = e.data;
      } else if (e.type === 'response') {
        out.response = e.body;
      }
    } catch (err) {
      logger.warn({ err: err.message, type: e.type, provider }, '[integrations] effect failed');
    }
  }

  for (const e of effects) {
    if (e.type !== 'card') continue;
    try {
      const channelId = resolveChannel(config, connector, e);
      if (!channelId) continue;
      const card = { ...e.card };
      const tasks = card.url ? linked.get(card.url) : null;
      if (tasks?.length) {
        card.taskIds = tasks.map(t => t._id);
        card.taskKeys = tasks.map(t => t.issueKey).filter(Boolean);
      }
      const posted = await bot.upsertCard({
        workspaceId, channelId, provider: card.provider || provider, card,
        summary: String(e.summary || card.title || '').slice(0, 4000), dedupe: e.dedupe !== false, io,
      });
      if (posted) out.posted.push(String(posted.message._id));
    } catch (err) {
      logger.warn({ err: err.message, provider }, '[integrations] card post failed');
    }
  }
  return out;
}

module.exports = { applyEffects, createTask, resolveChannel };
