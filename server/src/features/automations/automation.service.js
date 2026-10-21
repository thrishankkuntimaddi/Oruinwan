const { hydrate, userSelect } = require('../../identity/hydrate');
const logger = require('../../../utils/logger');
const Automation = require('./automation.model');
const AutomationRun = require('./automationRun.model');
const {
    evaluateConditions,
    validateConditions,
    interpolateDeep,
    resolved,
} = require('./automation.conditions');
const { normalizeSchedule, dueSlot, previewRuns } = require('./automation.schedule');

const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const _cacheTimestamps = new Map();

const MAX_STEPS = 10;
const MAX_TRIGGER_DATA_BYTES = 16 * 1024;

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

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// ─────────────────────────────────────────────────────────────────────────────
// Event data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON-safe copy of the trigger data for storing on the run: drops `io` and
 * functions, caps depth and size (webhook payloads can be large).
 */
function _sanitizeTriggerData(data) {
    const seen = new WeakSet();
    const walk = (v, depth) => {
        if (v === null || v === undefined) return v;
        if (typeof v === 'function') return undefined;
        if (v instanceof Date) return v;
        if (typeof v !== 'object') return typeof v === 'string' && v.length > 2000 ? `${v.slice(0, 2000)}…` : v;
        if (seen.has(v) || depth > 6) return undefined;
        seen.add(v);
        if (Array.isArray(v)) return v.slice(0, 50).map((x) => walk(x, depth + 1));
        if (typeof v.toHexString === 'function') return String(v);
        const out = {};
        for (const [k, x] of Object.entries(v)) {
            if (k === 'io' || k.startsWith('$')) continue;
            const w = walk(x, depth + 1);
            if (w !== undefined) out[k.replace(/\./g, '_')] = w;
        }
        return out;
    };
    let clean = walk(data, 0) || {};
    try {
        if (JSON.stringify(clean).length > MAX_TRIGGER_DATA_BYTES) {
            const { event: _drop, ...rest } = clean;
            clean = { ...rest, truncated: true };
        }
    } catch {
        clean = { workspaceId: data?.workspaceId ? String(data.workspaceId) : null, truncated: true };
    }
    return clean;
}

/**
 * What templates and conditions see. The flat event data, plus:
 *  - `trigger` / `event`: the same data (for webhooks, `event` also exposes the raw payload's fields);
 *  - the trigger's noun (`task`, `meeting`, `file`, `message`, `github`) as an alias, so
 *    "{{task.title}}" and "{{title}}" both work;
 *  - `steps` and `previous`, filled in as steps run.
 */
function _buildContext(triggerType, eventData) {
    const { io: _io, ...flat } = eventData || {};
    const raw = flat.event && typeof flat.event === 'object' ? flat.event : {};
    const event = { ...raw, ...flat };
    const ctx = { ...flat, trigger: flat, event, steps: {}, previous: {}, now: new Date().toISOString() };
    const noun = String(triggerType || '').split('.')[0];
    if (noun && noun !== 'scheduled' && ctx[noun] === undefined) ctx[noun] = event;
    return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

const AUTOMATION_BOT = { email: 'automations@system.oruinwan.internal', username: 'Automations', roles: ['automation_bot'] };
let _botPromise = null;
function _getBotUser() {
    if (!_botPromise) {
        const { upsertSystemUser } = require('../../identity/queries/security');
        _botPromise = upsertSystemUser(AUTOMATION_BOT).catch((err) => { _botPromise = null; throw err; });
    }
    return _botPromise;
}

function _getIo(io) {
    if (io) return io;
    try { return require('../../socket/getIO').getIO(); } catch { return null; }
}

/** A channel of this workspace by id or by name ("engineering" / "#engineering"). */
async function _resolveChannel(workspaceId, { channelId, channelName }) {
    const Channel = require('../channels/channel.model.js');
    const fields = '_id workspace company isArchived name';
    if (resolved(channelId) && /^[a-f0-9]{24}$/i.test(String(channelId))) {
        return Channel.findOne({ _id: channelId, workspace: workspaceId }).select(fields).lean();
    }
    const name = resolved(channelName) ? String(channelName).replace(/^#/, '').trim() : null;
    if (!name) return null;
    return Channel.findOne({ workspace: workspaceId, name }).select(fields).lean();
}

/** Outbound URL must be http(s) and not point into the private network. */
async function _assertOutboundUrl(url) {
    let parsed;
    try { parsed = new URL(String(url)); } catch { throw new Error('Invalid URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http(s) URLs are allowed');
    const { assertNotSSRF } = require('../../modules/linkPreview/linkPreview.service');
    await assertNotSSRF(parsed.toString());
}

const _outbound = (opts) => require('axios')({ maxRedirects: 0, ...opts });

const firstResolved = (...vals) => vals.find((v) => resolved(v));

const ACTION_HANDLERS = {

    /** Post a message to a channel as the "Automations" bot (end-to-end encrypted with the channel key). */
    async send_message(config, ctx, io) {
        const { text } = config;
        if (!resolved(text)) return { skipped: true, reason: 'Missing text' };
        const channel = await _resolveChannel(ctx.workspaceId, { channelId: config.channelId, channelName: config.channelName || config.channel });
        if (!channel) return { skipped: true, reason: 'Channel not found in this workspace' };
        if (channel.isArchived) return { skipped: true, reason: 'Channel is archived' };

        const { encryptForConversation } = require('../../modules/conversations/cryptoUtils');
        let enc;
        try {
            enc = await encryptForConversation(String(channel._id), 'channel', String(text).slice(0, 4000));
        } catch {
            throw new Error('This channel has no server-held key yet, so automations cannot post to it');
        }
        const bot = await _getBotUser();
        const messagesService = require('../../modules/messages/messages.service');
        const msg = await messagesService.createMessage({
            type: 'message',
            company: channel.company || null,
            workspace: channel.workspace,
            channel: channel._id,
            sender: bot._id,
            ciphertext: enc.ciphertext,
            messageIv: enc.messageIv,
            fromAutomation: true,
        }, _getIo(io));
        return { messageId: String(msg._id), channelId: String(channel._id), channelName: channel.name };
    },

    /** Create a workspace task (owned by the automation's creator). */
    async create_task(config, ctx, io, automation) {
        const { title } = config;
        if (!resolved(title)) return { skipped: true, reason: 'Missing task title' };
        const priority = ['low', 'medium', 'high', 'urgent'].includes(config.priority) ? config.priority : 'medium';
        const assignedTo = (Array.isArray(config.assignedToIds) ? config.assignedToIds : [config.assignedToIds, config.assigneeId])
            .filter((id) => resolved(id) && /^[a-f0-9]{24}$/i.test(String(id)));
        let dueDate = null;
        if (resolved(config.dueInDays) && Number(config.dueInDays) > 0) {
            dueDate = new Date(Date.now() + Number(config.dueInDays) * 86_400_000);
        } else if (resolved(config.dueDate) && !Number.isNaN(Date.parse(config.dueDate))) {
            dueDate = new Date(config.dueDate);
        }

        const Tasks = require('../tasks/tasks.query');
        const task = await Tasks.create({
            workspace:   ctx.workspaceId,
            title:       String(title).slice(0, 300),
            description: resolved(config.description) ? String(config.description).slice(0, 5000) : '',
            priority,
            status:      'todo',
            assignedTo,
            visibility:  'workspace',
            tags:        ['automation', ...(Array.isArray(config.tags) ? config.tags.filter(resolved).map(String) : [])].slice(0, 20),
            ...(dueDate ? { dueDate } : {}),
            createdBy:   automation.createdBy
        });
        const realIo = _getIo(io);
        if (realIo) {
            try {
                const { emitToTaskAudience, loadTaskForClient } = require('../tasks/tasks.shared');
                await emitToTaskAudience(realIo, task, 'task-created', await loadTaskForClient(task._id));
            } catch (err) {
                logger.warn({ err: err.message }, '[Automation] task-created emit failed');
            }
        }
        return { taskId: String(task._id), taskTitle: task.title, issueKey: task.issueKey || null };
    },

    /** Add an assignee. The task defaults to the previous step's task, then the trigger's task. */
    async assign_task(config, ctx, io) {
        const taskId = firstResolved(config.taskId, ctx.previous?.taskId, ctx.taskId);
        const { assigneeId } = config;
        if (!taskId || !resolved(assigneeId)) return { skipped: true, reason: 'Missing taskId or assigneeId' };

        const Tasks = require('../tasks/tasks.query');
        let task = await Tasks.findById(taskId);
        if (!task || String(task.workspace) !== String(ctx.workspaceId)) return { skipped: true, reason: 'Task not found' };
        const identity = require('../../identity');
        const ws = await identity.workspaces.findById(String(ctx.workspaceId));
        if (!ws || !ws.isMember(String(assigneeId))) return { skipped: true, reason: 'Assignee is not a workspace member' };
        if (!(task.assignedTo || []).some((a) => String(a) === String(assigneeId))) {
            task = await Tasks.updateById(task._id, { assignedTo: [...(task.assignedTo || []), assigneeId] });
        }
        const realIo = _getIo(io);
        if (realIo) realIo.to(`user_${assigneeId}`).emit('task-assigned', task);
        return { taskId: String(task._id), assigneeId: String(assigneeId) };
    },

    async send_notification(config, ctx, io) {
        const { title, body } = config;
        if (!resolved(title)) return { skipped: true, reason: 'Missing notification title' };

        const recipient = firstResolved(config.recipientId, ctx.userId);
        if (!recipient) return { skipped: true, reason: 'No recipient resolved' };

        const notifService = require('../../modules/notifications/notificationService');
        await notifService.create(_getIo(io), {
            recipient,
            workspaceId: ctx.workspaceId,
            type:  'automation',
            title: String(title).slice(0, 200),
            body:  resolved(body) ? String(body).slice(0, 1000) : '',
            link:  resolved(config.link) ? String(config.link) : '/automations',
            meta:  { automationTriggered: true }
        });
        return { notified: String(recipient) };
    },

    async call_webhook(config) {
        const { url, method = 'POST', payload = {}, headers = {} } = config;
        if (!resolved(url)) return { skipped: true, reason: 'Missing webhook URL' };
        await _assertOutboundUrl(url);
        const m = String(method).toUpperCase();
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) throw new Error(`Unsupported method ${m}`);
        const safeHeaders = {};
        for (const [k, v] of Object.entries(headers || {})) {
            if (/^[A-Za-z0-9-]{1,64}$/.test(k) && typeof v === 'string') safeHeaders[k] = v.slice(0, 1000);
        }
        const res = await _outbound({ method: m, url, data: m === 'GET' ? undefined : payload, headers: safeHeaders, timeout: 5000 });
        let data = null;
        if (res.data && typeof res.data === 'object') {
            try { data = JSON.stringify(res.data).length <= 4000 ? res.data : null; } catch { data = null; }
        }
        return { status: res.status, data };
    },

    async post_to_slack(config) {
        const { webhookUrl, text } = config;
        if (!resolved(webhookUrl) || !resolved(text)) return { skipped: true, reason: 'Missing Slack webhookUrl or text' };
        await _assertOutboundUrl(webhookUrl);
        await _outbound({ method: 'POST', url: webhookUrl, data: { text }, timeout: 5000 });
        return { posted: true };
    },

    async trigger_ci_pipeline(config) {
        const { url, token } = config;
        if (!resolved(url)) return { skipped: true, reason: 'Missing CI pipeline URL' };
        await _assertOutboundUrl(url);
        const headers = resolved(token) ? { Authorization: `Bearer ${token}` } : {};
        const res = await _outbound({ method: 'POST', url, data: config.payload || {}, headers, timeout: 8000 });
        return { status: res.status };
    }
};

const SECRET_KEYS = /token|secret|password|authorization|webhookurl/i;
function _maskSecrets(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = SECRET_KEYS.test(k) && v ? '••••' : v;
    return out;
}

/**
 * Run the steps in order. Each step's output is stored under ctx.steps[id] and
 * ctx.steps[index] and becomes ctx.previous for the next step. A failed step
 * stops the run (later steps are recorded as skipped) unless it has
 * continueOnError. With dryRun nothing is executed: each step's interpolated
 * config is returned as a preview.
 */
async function executeActions(automation, eventData, io, { dryRun = false, context = null } = {}) {
    const ctx = context || _buildContext(automation.trigger?.type, eventData);
    const results = [];
    let halted = null;
    const actions = (automation.actions || []).slice(0, MAX_STEPS);

    for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        const stepId = action.id || null;
        const base = { index, stepId, type: action.type, startedAt: new Date() };

        if (halted) {
            results.push({ ...base, status: 'skipped', success: false, reason: `Not run: step ${halted} failed`, durationMs: 0 });
            continue;
        }
        const handler = ACTION_HANDLERS[action.type];
        if (!handler) {
            results.push({ ...base, status: 'failed', success: false, error: 'Unknown action type', durationMs: 0 });
            if (!action.continueOnError) halted = index + 1;
            continue;
        }

        const start = Date.now();
        try {
            const config = interpolateDeep(action.config || {}, ctx);
            if (dryRun) {
                results.push({ ...base, status: 'skipped', success: false, reason: 'Test run: not executed', preview: _maskSecrets(config), durationMs: 0 });
                // Later steps can still reference this one in their preview.
                const placeholder = { dryRun: true };
                ctx.steps[index] = placeholder;
                if (stepId) ctx.steps[stepId] = placeholder;
                ctx.previous = placeholder;
                continue;
            }
            const result = (await handler(config, ctx, io, automation)) || {};
            const { skipped, reason, ...output } = result;
            if (skipped) {
                results.push({ ...base, status: 'skipped', success: false, reason, durationMs: Date.now() - start });
            } else {
                results.push({ ...base, status: 'success', success: true, output, durationMs: Date.now() - start });
            }
            ctx.steps[index] = output;
            if (stepId) ctx.steps[stepId] = output;
            ctx.previous = output;
        } catch (err) {
            logger.error(`[Automation] Step ${index + 1} (${action.type}) failed for automation ${automation._id}: ${err.message}`);
            results.push({ ...base, status: 'failed', success: false, error: String(err.message || err).slice(0, 500), durationMs: Date.now() - start });
            if (!action.continueOnError) halted = index + 1;
        }
    }
    return results;
}

function _runStatus(steps) {
    const ran = steps.filter((s) => s.status !== 'skipped');
    const failed = ran.filter((s) => s.status === 'failed').length;
    const succeeded = ran.filter((s) => s.status === 'success').length;
    if (failed && succeeded) return 'partial';
    if (failed) return 'failed';
    return 'success';
}

/** Step rows as stored on the run (spread handler outputs live under `output`). */
function _storedSteps(steps) {
    return steps.map(({ index, stepId, type, status, success, error = null, reason = null, output = null, preview, startedAt, durationMs }) => ({
        index, stepId, type, status, success, error, reason, output, ...(preview !== undefined ? { preview } : {}), startedAt, durationMs,
    }));
}

/**
 * Evaluate conditions and run one automation; records an AutomationRun.
 * source: 'event' | 'schedule' | 'manual' | 'test'. Event and schedule runs whose
 * conditions are not met are not recorded (they would flood the history);
 * manual and test runs always are.
 */
async function runAutomation(automation, triggerType, eventData, io, { source = 'event', triggeredBy = null, dryRun = false } = {}) {
    const start = Date.now();
    const ctx = _buildContext(triggerType, eventData);
    let steps = [];
    let status = 'success';
    let errorMsg = null;

    const conditionsMet = evaluateConditions(automation, ctx);
    if (!conditionsMet && (source === 'event' || source === 'schedule')) {
        logger.debug(`[Automation] Conditions not met for "${automation.name}" (${automation._id})`);
        return null;
    }

    if (!conditionsMet) {
        status = 'skipped';
    } else {
        try {
            steps = await executeActions(automation, eventData, io, { dryRun, context: ctx });
            status = dryRun ? 'success' : _runStatus(steps);
            const firstError = steps.find((s) => s.status === 'failed');
            if (firstError) errorMsg = `Step ${firstError.index + 1} (${firstError.type}): ${firstError.error}`;
        } catch (err) {
            status = 'failed';
            errorMsg = err.message;
            logger.error(`[Automation] Automation "${automation.name}" failed:`, err.message);
        }
    }

    const runDoc = {
        automationId: automation._id,
        workspaceId:  automation.workspaceId,
        triggerType,
        triggerData:  _sanitizeTriggerData(eventData),
        source,
        dryRun,
        triggeredBy,
        conditionsMet,
        status,
        actionsExecuted: _storedSteps(steps),
        error:         errorMsg,
        durationMs:    Date.now() - start
    };

    let run = runDoc;
    try {
        run = await AutomationRun.create(runDoc);
        if (!dryRun && conditionsMet) {
            await Automation.updateOne({ _id: automation._id }, {
                $inc: { runCount: 1 },
                $set: { lastRunAt: new Date(), lastError: errorMsg }
            });
        }
    } catch (err) {
        logger.error('[Automation] Failed to persist run log:', err.message);
    }
    return run;
}

async function processEvent(triggerType, eventData, io) {
    if (!eventData || !eventData.workspaceId) return;


    setImmediate(async () => {
        try {
            const automations = await _getCachedAutomations(
                eventData.workspaceId.toString(),
                triggerType
            );
            if (!automations.length) return;

            logger.info(`[Automation] Processing ${automations.length} automation(s) for event: ${triggerType}`);

            for (const automation of automations) {
                await runAutomation(automation, triggerType, eventData, io, { source: 'event' })
                    .catch((err) => logger.error(`[Automation] "${automation.name}" failed:`, err.message));
            }
        } catch (err) {
            logger.error(`[Automation] processEvent error for ${triggerType}:`, err.message);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function _validateActions(actions) {
    const { ACTION_TYPES } = require('./automation.model');
    if (!Array.isArray(actions) || actions.length === 0) throw httpError(400, 'At least one action is required');
    if (actions.length > MAX_STEPS) throw httpError(400, `At most ${MAX_STEPS} actions`);
    const ids = new Set();
    return actions.map((a, i) => {
        if (!a || !ACTION_TYPES.includes(a.type)) throw httpError(400, `Action ${i + 1}: unknown type "${a && a.type}"`);
        let id = a.id == null || a.id === '' ? null : String(a.id).trim();
        if (id !== null) {
            if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(id)) throw httpError(400, `Action ${i + 1}: id must start with a letter and use letters, digits, _ or -`);
            if (ids.has(id)) throw httpError(400, `Action ${i + 1}: duplicate id "${id}"`);
            ids.add(id);
        }
        const config = a.config && typeof a.config === 'object' && !Array.isArray(a.config) ? a.config : {};
        return { type: a.type, config, id, name: a.name ? String(a.name).slice(0, 120) : null, continueOnError: Boolean(a.continueOnError) };
    });
}

function _validateDefinition(data, { partial = false } = {}) {
    const out = {};
    if (!partial || data.conditions !== undefined) out.conditions = validateConditions(data.conditions);
    if (!partial || data.actions !== undefined) out.actions = _validateActions(data.actions);
    if (data.conditionLogic !== undefined) {
        if (!['all', 'any'].includes(data.conditionLogic)) throw httpError(400, 'conditionLogic must be "all" or "any"');
        out.conditionLogic = data.conditionLogic;
    }
    const triggerType = data.trigger?.type;
    if (data.schedule !== undefined || triggerType === 'scheduled') {
        if (triggerType === 'scheduled' && !data.schedule && !partial) {
            out.schedule = { type: 'interval', expression: '24h', timezone: 'UTC' };
        } else if (data.schedule) {
            out.schedule = normalizeSchedule(data.schedule);
        } else if (data.schedule === null) {
            out.schedule = null;
        }
    }
    return out;
}

const MAX_AUTOMATIONS_PER_WORKSPACE = 50;

async function createAutomation(userId, data) {
    const { workspaceId, name, description, trigger, templateId } = data;


    const count = await Automation.countDocuments({ workspaceId, deleted: { $ne: true } });
    if (count >= MAX_AUTOMATIONS_PER_WORKSPACE) {
        const err = new Error(`Workspace limit of ${MAX_AUTOMATIONS_PER_WORKSPACE} automations reached`);
        err.statusCode = 422;
        throw err;
    }

    const valid = _validateDefinition(data);
    const automation = await Automation.create({
        workspaceId,
        name,
        description,
        trigger,
        conditions: valid.conditions,
        conditionLogic: valid.conditionLogic || 'all',
        actions: valid.actions,
        schedule:   valid.schedule || null,
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
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .then((rows) => hydrate(rows, { createdBy: userSelect('username firstName lastName') })),
        Automation.countDocuments({ workspaceId, deleted: { $ne: true } })
    ]);
    return { automations: automations.map(_withNextRuns), total, page, limit };
}

/** Scheduled automations get `nextRunAt` for the UI. */
function _withNextRuns(automation) {
    if (!automation || automation.trigger?.type !== 'scheduled' || !automation.schedule?.expression) return automation;
    try {
        const [next] = previewRuns(automation.schedule, { count: 1, lastRunAt: automation.lastRunAt });
        return { ...automation, nextRunAt: next || null };
    } catch {
        return { ...automation, nextRunAt: null };
    }
}

async function getAutomation(automationId, workspaceId) {
    const automation = await Automation.findOne({
        _id:         automationId,
        workspaceId,
        deleted:     { $ne: true }
    }).lean().then((doc) => (doc ? hydrate(doc, { createdBy: userSelect('username firstName lastName') }) : doc));

    if (!automation) {
        const err = new Error('Automation not found');
        err.statusCode = 404;
        throw err;
    }
    return _withNextRuns(automation);
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

    const valid = _validateDefinition({
        ...updates,
        trigger: updates.trigger || automation.trigger,
    }, { partial: true });

    for (const field of ['name', 'description', 'trigger', 'isActive']) {
        if (updates[field] !== undefined) automation[field] = updates[field];
    }
    for (const field of ['conditions', 'actions', 'conditionLogic', 'schedule']) {
        if (valid[field] !== undefined) automation[field] = valid[field];
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

/**
 * "Run now" / "Test". Runs the automation once with `eventData` (sample trigger
 * data from the caller; defaults to { workspaceId }). With dryRun, conditions are
 * evaluated and each step's interpolated config is returned, but nothing runs.
 * Works for inactive automations too, so a draft can be tested.
 */
async function runNow(automationId, workspaceId, userId, { eventData = {}, dryRun = false } = {}, io) {
    const automation = await Automation.findOne({ _id: automationId, workspaceId, deleted: { $ne: true } }).lean();
    if (!automation) throw httpError(404, 'Automation not found');
    const sample = eventData && typeof eventData === 'object' && !Array.isArray(eventData) ? eventData : {};
    const data = {
        ...sample,
        workspaceId: String(workspaceId),
        userId: sample.userId || String(userId),
        automationId: String(automation._id),
        manual: true,
    };
    return runAutomation(automation, automation.trigger.type, data, io, {
        source: dryRun ? 'test' : 'manual',
        triggeredBy: userId,
        dryRun: Boolean(dryRun),
    });
}

async function getRuns(automationId, workspaceId, { limit = 20, before = null } = {}) {
    const query = { automationId, workspaceId };
    if (before && !Number.isNaN(Date.parse(before))) query.createdAt = { $lt: new Date(before) };
    const runs = await AutomationRun.find(query)
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100))
        .lean();
    return runs;
}

async function runScheduledAutomations(io, now = new Date()) {
    try {
        const scheduled = await Automation.find({
            'trigger.type': 'scheduled',
            isActive:        true,
            deleted:         { $ne: true }
        }).lean();

        if (!scheduled.length) return;
        logger.info(`[Automation] Checking ${scheduled.length} scheduled automation(s)...`);

        for (const automation of scheduled) {
            const schedule = automation.schedule?.expression
                ? automation.schedule
                : { type: 'interval', expression: '24h' };
            const slot = dueSlot(schedule, { lastRunAt: automation.lastRunAt, createdAt: automation.createdAt, now });
            if (!slot) continue;

            // Claim the slot so a second instance (or an overlapping tick) cannot run it again.
            const claim = await Automation.updateOne(
                { _id: automation._id, lastRunAt: automation.lastRunAt || null },
                { $set: { lastRunAt: now } }
            );
            if (!claim || claim.modifiedCount === 0) continue;

            logger.info(`[Automation] Running scheduled automation "${automation.name}"`);
            await runAutomation(automation, 'scheduled', {
                workspaceId: automation.workspaceId.toString(),
                automationId: automation._id.toString(),
                scheduledAt: slot.toISOString(),
                userId: automation.createdBy ? String(automation.createdBy) : null,
            }, io, { source: 'schedule' }).catch((err) => logger.error('[Automation] scheduled run failed:', err.message));
        }
    } catch (err) {
        logger.error('[Automation] runScheduledAutomations error:', err.message);
    }
}

module.exports = {
    processEvent,
    runAutomation,
    runNow,
    getRuns,
    createAutomation,
    getAutomations,
    getAutomation,
    updateAutomation,
    deleteAutomation,
    executeActions,
    runScheduledAutomations,
    evaluateConditions,
    previewSchedule: (schedule, count) => previewRuns(schedule, { count }),
    // exported for tests
    _buildContext,
    _sanitizeTriggerData,
    ACTION_HANDLERS,
};
