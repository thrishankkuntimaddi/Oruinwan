/**
 * automation.service.js
 *
 * Core Workflow Automation Service.
 * Implements:
 *   - CRUD operations (admin-only writes)
 *   - Condition evaluation engine
 *   - Action execution fanout
 *   - Event processing pipeline
 *   - Scheduled automation runner
 *
 * Design principles:
 *   - Async / non-blocking: processEvent never throws into the event emitter
 *   - Lightweight in-memory cache for active automations per workspace
 *   - All action handlers are isolated — one failure doesn't block others
 *   - Extensible: add new action types in the ACTION_HANDLERS map below
 */

const logger = require('../../../utils/logger');
const Automation = require('./automation.model');
const AutomationRun = require('./automationRun.model');

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Maps workspaceId+triggerType → Automation[] (cleared on any write)
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _cacheTimestamps = new Map();

function _cacheKey(workspaceId, triggerType) {
    return `${workspaceId}:${triggerType}`;
}

function _invalidateWorkspace(workspaceId) {
    for (const key of _cache.keys()) {
        if (key.startsWith(workspaceId)) {
            _cache.delete(key);
            _cacheTimestamps.delete(key);
        }
    }
}

async function _getCachedAutomations(workspaceId, triggerType) {
    const key = _cacheKey(workspaceId, triggerType);
    const ts = _cacheTimestamps.get(key);
    if (ts && Date.now() - ts < CACHE_TTL_MS && _cache.has(key)) {
        return _cache.get(key);
    }
    // Re-fetch
    const results = await Automation.find({
        workspaceId,
        'trigger.type': triggerType,
        isActive: true,
        deleted: { $ne: true }
    }).lean();
    _cache.set(key, results);
    _cacheTimestamps.set(key, Date.now());
    return results;
}

// ─── Condition Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a single condition against eventData.
 * Supports dot-notation field paths (e.g. "trigger.config.repo").
 */
function _evaluateCondition(condition, eventData) {
    const { field, operator, value } = condition;

    // Resolve nested field value
    const actual = field.split('.').reduce((obj, key) => {
        return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, eventData);

    if (actual === undefined) return false;

    const actualStr = String(actual).toLowerCase();
    const valueStr  = String(value).toLowerCase();

    switch (operator) {
        case 'equals':     return actualStr === valueStr;
        case 'not_equals': return actualStr !== valueStr;
        case 'contains':   return actualStr.includes(valueStr);
        default:           return false;
    }
}

/**
 * Return true only if ALL conditions pass (empty conditions = always true).
 */
function _evaluateConditions(automation, eventData) {
    if (!automation.conditions || automation.conditions.length === 0) return true;
    return automation.conditions.every(c => _evaluateCondition(c, eventData));
}

// ─── Template variable interpolation ─────────────────────────────────────────

/**
 * Replace {{key}} tokens in a string using eventData values.
 * Supports flat and one-level dot-notation: {{event.title}}, {{task.title}}.
 */
function _interpolate(template, data) {
    if (!template || typeof template !== 'string') return template;
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
        const val = path.trim().split('.').reduce((obj, k) => obj && obj[k], data);
        return val !== undefined ? String(val) : `{{${path}}}`;
    });
}

function _interpolateConfig(config, data) {
    if (!config || typeof config !== 'object') return config;
    const result = {};
    for (const [k, v] of Object.entries(config)) {
        result[k] = typeof v === 'string' ? _interpolate(v, data) : v;
    }
    return result;
}

// ─── Action Handlers ──────────────────────────────────────────────────────────

/**
 * Each handler receives (config, eventData, io) and returns a result or throws.
 * Add new action types here to extend the system.
 */
const ACTION_HANDLERS = {

    async send_message(config, eventData, io) {
        const { channelId, text } = config;
        if (!channelId || !text) return { skipped: true, reason: 'Missing channelId or text' };

        const Message = require('../messages/message.model');
        const msg = await Message.create({
            workspace: eventData.workspaceId,
            channel:   channelId,
            sender:    null, // system message
            text:      `🤖 **Automation:** ${text}`
        });
        if (io) io.to(`channel:${channelId}`).emit('new-message', msg);
        return { messageId: msg._id };
    },

    async create_task(config, eventData, io) {
        const { title, priority = 'medium', assignedToIds = [] } = config;
        if (!title) return { skipped: true, reason: 'Missing task title' };

        const Task = require('../../../models/Task');
        const task = await Task.create({
            workspace:  eventData.workspaceId,
            title,
            priority,
            status:     'todo',
            assignedTo: assignedToIds,
            source:     'automation',
            visibility: 'workspace',
            createdBy:  null // system
        });
        if (io) io.to(`workspace_${eventData.workspaceId}`).emit('task-created', task);
        return { taskId: task._id };
    },

    async assign_task(config, eventData, io) {
        const { taskId, assigneeId } = config;
        if (!taskId || !assigneeId) return { skipped: true, reason: 'Missing taskId or assigneeId' };

        const Task = require('../../../models/Task');
        const task = await Task.findById(taskId);
        if (!task) return { skipped: true, reason: 'Task not found' };
        if (!task.assignedTo.includes(assigneeId)) {
            task.assignedTo.push(assigneeId);
            await task.save();
        }
        if (io) io.to(`user_${assigneeId}`).emit('task-assigned', task);
        return { taskId: task._id };
    },

    async send_notification(config, eventData, io) {
        const { title, body, recipientId } = config;
        if (!title) return { skipped: true, reason: 'Missing notification title' };

        const notifService = require('../notifications/notificationService');
        const recipient = recipientId || eventData.userId || null;
        if (!recipient) return { skipped: true, reason: 'No recipient resolved' };

        await notifService.create(io, {
            recipient,
            workspaceId: eventData.workspaceId,
            type:  'automation',
            title,
            body:  body || '',
            link:  '/automations',
            meta:  { automationTriggered: true }
        });
        return { notified: recipient };
    },

    async call_webhook(config, _eventData, _io) {
        const { url, method = 'POST', payload = {} } = config;
        if (!url) return { skipped: true, reason: 'Missing webhook URL' };

        const axios = require('axios');
        const res = await axios({ method, url, data: payload, timeout: 5000 });
        return { status: res.status };
    },

    async post_to_slack(config, _eventData, _io) {
        const { webhookUrl, text } = config;
        if (!webhookUrl || !text) return { skipped: true, reason: 'Missing Slack webhookUrl or text' };

        const axios = require('axios');
        await axios.post(webhookUrl, { text }, { timeout: 5000 });
        return { posted: true };
    },

    async trigger_ci_pipeline(config, _eventData, _io) {
        const { url, token } = config;
        if (!url) return { skipped: true, reason: 'Missing CI pipeline URL' };

        const axios = require('axios');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.post(url, {}, { headers, timeout: 8000 });
        return { status: res.status };
    }
};

// ─── Execute All Actions ──────────────────────────────────────────────────────

async function executeActions(automation, eventData, io) {
    const results = [];
    for (const action of automation.actions) {
        const handler = ACTION_HANDLERS[action.type];
        if (!handler) {
            results.push({ type: action.type, success: false, error: 'Unknown action type' });
            continue;
        }
        try {
            const config = _interpolateConfig(action.config || {}, eventData);
            const result = await handler(config, eventData, io);
            results.push({ type: action.type, success: true, ...result });
        } catch (err) {
            logger.error(`[Automation] Action ${action.type} failed for automation ${automation._id}:`, err.message);
            results.push({ type: action.type, success: false, error: err.message });
        }
    }
    return results;
}

// ─── Process Event ─────────────────────────────────────────────────────────────

/**
 * Main entry point — called by event hooks.
 * Fully async & non-blocking: errors are swallowed to protect caller.
 *
 * @param {string} triggerType  - e.g. 'task.created'
 * @param {Object} eventData    - { workspaceId, ...contextFields }
 * @param {Object} io           - Socket.io server instance
 */
async function processEvent(triggerType, eventData, io) {
    if (!eventData || !eventData.workspaceId) return;

    // Run fully async — don't block the event emitter
    setImmediate(async () => {
        try {
            const automations = await _getCachedAutomations(
                eventData.workspaceId.toString(),
                triggerType
            );
            if (!automations.length) return;

            logger.info(`[Automation] Processing ${automations.length} automation(s) for event: ${triggerType}`);

            for (const automation of automations) {
                const start = Date.now();
                let status = 'success';
                let actionsExecuted = [];
                let errorMsg = null;

                try {
                    if (!_evaluateConditions(automation, eventData)) {
                        logger.debug(`[Automation] Conditions not met for "${automation.name}" (${automation._id})`);
                        continue;
                    }

                    actionsExecuted = await executeActions(automation, eventData, io);
                    const anyFailed = actionsExecuted.some(r => !r.success);
                    const anySucceeded = actionsExecuted.some(r => r.success);
                    if (anyFailed && anySucceeded) status = 'partial';
                    if (anyFailed && !anySucceeded) status = 'failed';
                } catch (err) {
                    status = 'failed';
                    errorMsg = err.message;
                    logger.error(`[Automation] Automation "${automation.name}" failed:`, err.message);
                }

                // Persist run log + update telemetry (fire-and-forget)
                Promise.all([
                    AutomationRun.create({
                        automationId: automation._id,
                        workspaceId:  automation.workspaceId,
                        triggerType,
                        triggerData:  eventData,
                        status,
                        actionsExecuted,
                        error:         errorMsg,
                        durationMs:    Date.now() - start
                    }),
                    Automation.updateOne({ _id: automation._id }, {
                        $inc: { runCount: 1 },
                        $set: { lastRunAt: new Date(), lastError: errorMsg }
                    })
                ]).catch(err => logger.error('[Automation] Failed to persist run log:', err.message));
            }
        } catch (err) {
            logger.error(`[Automation] processEvent error for ${triggerType}:`, err.message);
        }
    });
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

const MAX_AUTOMATIONS_PER_WORKSPACE = 50;

async function createAutomation(userId, data) {
    const { workspaceId, name, description, trigger, conditions, actions, schedule, templateId } = data;

    // Limit per workspace
    const count = await Automation.countDocuments({ workspaceId, deleted: { $ne: true } });
    if (count >= MAX_AUTOMATIONS_PER_WORKSPACE) {
        const err = new Error(`Workspace limit of ${MAX_AUTOMATIONS_PER_WORKSPACE} automations reached`);
        err.statusCode = 422;
        throw err;
    }

    const automation = await Automation.create({
        workspaceId,
        name,
        description,
        trigger,
        conditions: conditions || [],
        actions,
        schedule:   schedule || null,
        isActive:   true,
        createdBy:  userId,
        templateId: templateId || null
    });

    _invalidateWorkspace(workspaceId.toString());
    logger.info(`[Automation] Created "${name}" (${automation._id}) in workspace ${workspaceId}`);
    return automation;
}

async function getAutomations(workspaceId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [automations, total] = await Promise.all([
        Automation.find({ workspaceId, deleted: { $ne: true } })
            .populate('createdBy', 'username firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Automation.countDocuments({ workspaceId, deleted: { $ne: true } })
    ]);
    return { automations, total, page, limit };
}

async function getAutomation(automationId, workspaceId) {
    const automation = await Automation.findOne({
        _id:         automationId,
        workspaceId,
        deleted:     { $ne: true }
    }).populate('createdBy', 'username firstName lastName').lean();

    if (!automation) {
        const err = new Error('Automation not found');
        err.statusCode = 404;
        throw err;
    }
    return automation;
}

async function updateAutomation(automationId, workspaceId, updates) {
    const automation = await Automation.findOne({
        _id:         automationId,
        workspaceId,
        deleted:     { $ne: true }
    });

    if (!automation) {
        const err = new Error('Automation not found');
        err.statusCode = 404;
        throw err;
    }

    const allowed = ['name', 'description', 'trigger', 'conditions', 'actions', 'isActive', 'schedule'];
    for (const field of allowed) {
        if (updates[field] !== undefined) automation[field] = updates[field];
    }

    await automation.save();
    _invalidateWorkspace(workspaceId.toString());
    logger.info(`[Automation] Updated "${automation.name}" (${automationId})`);
    return automation;
}

async function deleteAutomation(automationId, workspaceId) {
    const automation = await Automation.findOne({
        _id:         automationId,
        workspaceId,
        deleted:     { $ne: true }
    });

    if (!automation) {
        const err = new Error('Automation not found');
        err.statusCode = 404;
        throw err;
    }

    automation.deleted = true;
    await automation.save();
    _invalidateWorkspace(workspaceId.toString());
    logger.info(`[Automation] Soft-deleted "${automation.name}" (${automationId})`);
}

// ─── Scheduled Automation Runner ──────────────────────────────────────────────

/**
 * Called by the cron job.
 * Finds all automations with trigger.type === 'scheduled' that are due to run
 * based on their schedule.expression (e.g. '30m', '1h', '24h').
 */
async function runScheduledAutomations(io) {
    try {
        const scheduled = await Automation.find({
            'trigger.type': 'scheduled',
            isActive:        true,
            deleted:         { $ne: true }
        }).lean();

        if (!scheduled.length) return;
        logger.info(`[Automation] Checking ${scheduled.length} scheduled automation(s)...`);

        const now = Date.now();

        for (const automation of scheduled) {
            const expression = automation.schedule?.expression || '24h';
            const intervalMs = _parseInterval(expression);
            if (!intervalMs) continue;

            const lastRun = automation.lastRunAt ? new Date(automation.lastRunAt).getTime() : 0;
            const isDue   = (now - lastRun) >= intervalMs;
            if (!isDue) continue;

            logger.info(`[Automation] Running scheduled automation "${automation.name}"`);
            await processEvent('scheduled', {
                workspaceId: automation.workspaceId.toString(),
                automationId: automation._id.toString()
            }, io);
        }
    } catch (err) {
        logger.error('[Automation] runScheduledAutomations error:', err.message);
    }
}

/** Parse interval strings like '30m', '2h', '24h' to milliseconds. */
function _parseInterval(expression) {
    if (!expression) return null;
    const match = expression.match(/^(\d+)(m|h|d)$/i);
    if (!match) return null;
    const [, amount, unit] = match;
    const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    return parseInt(amount, 10) * (multipliers[unit.toLowerCase()] || 0);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    processEvent,
    createAutomation,
    getAutomations,
    getAutomation,
    updateAutomation,
    deleteAutomation,
    executeActions,
    runScheduledAutomations,
    evaluateConditions: _evaluateConditions
};
