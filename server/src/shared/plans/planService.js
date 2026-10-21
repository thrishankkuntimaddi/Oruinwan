'use strict';

/**
 * Which plan applies, what is used, and the checks that refuse new additions
 * over a plan's limits. Every `assert*` throws PlanLimitError (HTTP 403,
 * code PLAN_LIMIT) or resolves; none of them touch existing data, so anything
 * created before a limit existed keeps working (grandfathering).
 *
 * Company accounts (users with a company) and company workspaces are exempt.
 */

const plans = require('./plans');
const { PlanLimitError } = plans;

const identity = () => require('../../identity');
const wsQueries = () => require('../../identity/queries/workspaces');
const Channel = () => require('../../features/channels/channel.model');
const Note = () => require('../../../models/Note');
const tasksQuery = () => require('../../features/tasks/tasks.query');

const DEFAULT_CHANNELS = ['general', 'random'];

/**
 * Counting needs the document store. Without a live MongoDB connection (a
 * process still booting, unit tests) a count would only queue, so the check is
 * skipped instead (a non-PLAN error, which every caller treats as "allow").
 */
const deps = {
    mongoReady: () => require('mongoose').connection.readyState === 1,
    tasksOnPg: () => require('../../features/tasks/tasks.store').tasksStore() === 'pg',
};
function needMongo() {
    if (!deps.mongoReady()) throw Object.assign(new Error('plan counts unavailable: database not connected'), { code: 'PLAN_COUNT_UNAVAILABLE' });
}
const ACTIVE_TASK_EXCLUDED = ['done', 'cancelled'];

/** Note template ids from the web and phone pickers -> one key per template. */
const TEMPLATE_ALIASES = {
    spec: 'projectspec', projectspec: 'projectspec',
    tech: 'techdesign', techdesign: 'techdesign',
    meeting: 'meeting', brainstorm: 'brainstorm', sop: 'sop', announcement: 'announcement',
    document: 'document', documentation: 'document', doc: 'document',
};

const idOf = (v) => (v == null ? null : String(v._id || v.id || v));

function isCompanyUser(user) {
    return !!(user && (user.companyId || user.userType === 'company'));
}

function isCompanyWorkspace(ws) {
    return !!(ws && (ws.company || ws.companyId));
}

/** The note template key for a create request, or null for a blank note. */
function templateKeyFor(templateId) {
    if (templateId == null || templateId === '') return null;
    const k = String(templateId).trim().toLowerCase();
    if (!k || k === 'blank' || k === 'note') return null;
    return TEMPLATE_ALIASES[k] || k.replace(/[^a-z0-9_-]/g, '').slice(0, 40) || null;
}

async function loadUser(userOrId) {
    if (userOrId && typeof userOrId === 'object' && ('companyId' in userOrId || 'userType' in userOrId)) return userOrId;
    return identity().users.findById(idOf(userOrId));
}

async function loadWorkspace(wsOrId) {
    if (wsOrId && typeof wsOrId === 'object' && 'members' in wsOrId) return wsOrId;
    return identity().workspaces.findById(idOf(wsOrId));
}

/** { plan, exempt } for a person (workspace counts, personal AI use). */
async function userPlan(userOrId) {
    const user = await loadUser(userOrId);
    if (isCompanyUser(user)) return { plan: 'company', exempt: true, user };
    return { plan: plans.normalizePlan(user?.plan || 'free'), exempt: false, user };
}

/** { plan, exempt } for a workspace (members, channels, tasks, notes, calls, workspace AI). */
async function workspacePlan(wsOrId) {
    const ws = await loadWorkspace(wsOrId);
    if (isCompanyWorkspace(ws)) return { plan: 'company', exempt: true, workspace: ws };
    return { plan: plans.normalizePlan(ws?.plan || 'free'), exempt: false, workspace: ws };
}

// Short cache of workspace plans for hot paths (calls, AI): plan changes are rare.
const PLAN_CACHE_MS = 60 * 1000;
const planCache = new Map();
async function cachedWorkspacePlan(workspaceId) {
    const key = idOf(workspaceId);
    if (!key) return { plan: 'free', exempt: false };
    const hit = planCache.get(key);
    if (hit && Date.now() - hit.at < PLAN_CACHE_MS) return hit.value;
    const { plan, exempt } = await workspacePlan(key);
    const value = { plan, exempt };
    planCache.set(key, { at: Date.now(), value });
    return value;
}
function _clearCache() { planCache.clear(); }

/** Throw when adding `adding` to `used` would pass `max` (null = unlimited). */
function check(key, plan, used, adding = 1) {
    const max = plans.limitOf(plan, key);
    if (max === null || max === true) return;
    if (used + adding > max) throw new PlanLimitError(key, { max, used, plan });
}

// ── Counts ────────────────────────────────────────────────────────────

async function workspaceCounts(userId) {
    return wsQueries().planWorkspaceCounts(userId);
}

/** Seats taken in a workspace: members (not removed) plus pending email invites. */
async function seatCount(workspaceId) {
    const [seats, pending] = await Promise.all([
        wsQueries().countSeats(workspaceId),
        wsQueries().countPendingEmailInvites(workspaceId),
    ]);
    return { seats, pending, total: seats + pending };
}

async function channelCount(workspaceId) {
    needMongo();
    return Channel().countDocuments({ workspace: idOf(workspaceId), name: { $nin: DEFAULT_CHANNELS }, isArchived: { $ne: true } });
}

async function noteTemplateCount(workspaceId, userId, templateKey) {
    needMongo();
    return Note().countDocuments({ workspace: idOf(workspaceId), owner: idOf(userId), templateKey });
}

async function notesByTemplate(workspaceId, userId) {
    needMongo();
    const rows = await Note().aggregate([
        { $match: { workspace: toObjectId(workspaceId), owner: toObjectId(userId), templateKey: { $type: 'string' } } },
        { $group: { _id: '$templateKey', n: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

function toObjectId(id) {
    const mongoose = require('mongoose');
    const s = idOf(id);
    return mongoose.isValidObjectId(s) ? new mongoose.Types.ObjectId(s) : s;
}

const activeTasks = (workspaceId) => ({ workspace: idOf(workspaceId), deleted: { $ne: true }, status: { $nin: ACTIVE_TASK_EXCLUDED } });

async function taskCounts(workspaceId, userId) {
    if (!deps.tasksOnPg()) needMongo();
    const q = tasksQuery();
    const base = activeTasks(workspaceId);
    const [workspace, self, mine] = await Promise.all([
        q.countDocuments(base),
        userId ? q.countDocuments({ ...base, createdBy: idOf(userId), assignedTo: { $eq: idOf(userId), $size: 1 } }) : 0,
        userId ? q.countDocuments({ ...base, createdBy: idOf(userId) }) : 0,
    ]);
    return { workspace, self, others: Math.max(0, mine - self) };
}

// ── Checks ────────────────────────────────────────────────────────────

async function assertCanCreateWorkspace(userOrId) {
    const { plan, exempt, user } = await userPlan(userOrId);
    if (exempt) return;
    const { owned } = await workspaceCounts(idOf(user || userOrId));
    check('workspaces.create', plan, owned);
}

/** Joining someone else's workspace. Company workspaces and company accounts never count. */
async function assertCanJoinWorkspace(userOrId, wsOrId) {
    const ws = await loadWorkspace(wsOrId);
    if (isCompanyWorkspace(ws)) return;
    const { plan, exempt, user } = await userPlan(userOrId);
    if (exempt) return;
    const { joined } = await workspaceCounts(idOf(user || userOrId));
    check('workspaces.join', plan, joined);
}

/**
 * Room for `adding` more people in a workspace. `inviteHoldsSeat`: the person
 * joining already holds a seat through their own pending email invite.
 */
async function assertMemberCapacity(wsOrId, adding = 1, { inviteHoldsSeat = false } = {}) {
    const { plan, exempt, workspace } = await workspacePlan(wsOrId);
    if (exempt) return;
    const { total } = await seatCount(idOf(workspace || wsOrId));
    check('members.perWorkspace', plan, inviteHoldsSeat ? total - 1 : total, adding);
}

async function assertCanCreateChannel(wsOrId) {
    const { plan, exempt, workspace } = await workspacePlan(wsOrId);
    if (exempt) return;
    check('channels.perWorkspace', plan, await channelCount(idOf(workspace || wsOrId)));
}

async function assertCanCreateNote(wsOrId, userId, templateKey) {
    if (!templateKey) return;
    const { plan, exempt, workspace } = await workspacePlan(wsOrId);
    if (exempt) return;
    check('notes.perTemplate', plan, await noteTemplateCount(idOf(workspace || wsOrId), userId, templateKey));
}

/** `adds` = { self, others } tasks this request would create. */
async function assertCanCreateTasks(wsOrId, userId, adds = { self: 1, others: 0 }) {
    const { plan, exempt, workspace } = await workspacePlan(wsOrId);
    if (exempt) return;
    const self = Number(adds.self) || 0;
    const others = Number(adds.others) || 0;
    const counts = await taskCounts(idOf(workspace || wsOrId), userId);
    check('tasks.perWorkspace', plan, counts.workspace, self + others);
    if (self) check('tasks.selfCreated', plan, counts.self, self);
    if (others) check('tasks.assignedToOthers', plan, counts.others, others);
}

/**
 * Run a check where a refusal must stop the caller but a counting problem must
 * not (call sites outside the route guards: convert-to-task, AI task creation).
 */
async function enforce(promise) {
    try {
        await promise;
    } catch (err) {
        if (err && err.code === 'PLAN_LIMIT') throw err;
        require('../../../utils/logger').warn({ err: err?.message }, '[plans] limit check skipped');
    }
}

/** { self, others } for a list of assignees of one new task created by `userId`. */
function taskAddsFor(userId, assignedTo = []) {
    const ids = [...new Set((assignedTo || []).map((v) => idOf(v)))];
    return ids.length === 1 && ids[0] === idOf(userId) ? { self: 1, others: 0 } : { self: 0, others: 1 };
}

/** How many tasks a create request makes, split into "for myself" and "for others". */
function taskAddsForBody(body = {}, me) {
    me = idOf(me);
    const type = body.assignmentType === 'members' ? 'individual' : (body.assignmentType || 'self');
    const ids = [...new Set((Array.isArray(body.assignedToIds) ? body.assignedToIds : []).map(String))];
    if (type === 'self') return { self: 1, others: 0 };
    if (type === 'individual') {
        if (!ids.length) return { self: 0, others: 0 };
        if ((body.taskMode || 'split') === 'split' && ids.length > 1) {
            const mine = ids.includes(me) ? 1 : 0;
            return { self: mine, others: ids.length - mine };
        }
        return ids.length === 1 && ids[0] === me ? { self: 1, others: 0 } : { self: 0, others: 1 };
    }
    return { self: 0, others: 1 }; // a channel task
}

/** Max people in one call of this workspace (null = only the server's technical cap). */
async function huddleLimits(workspaceId) {
    const { plan, exempt } = await cachedWorkspacePlan(workspaceId);
    if (exempt) return { plan, exempt, participants: null, minutes: null };
    return { plan, exempt, participants: plans.limitOf(plan, 'huddles.participants'), minutes: plans.limitOf(plan, 'huddles.minutes') };
}

module.exports = {
    isCompanyUser, isCompanyWorkspace, templateKeyFor,
    userPlan, workspacePlan, cachedWorkspacePlan,
    workspaceCounts, seatCount, channelCount, noteTemplateCount, notesByTemplate, taskCounts,
    assertCanCreateWorkspace, assertCanJoinWorkspace, assertMemberCapacity, assertCanCreateChannel,
    assertCanCreateNote, assertCanCreateTasks, huddleLimits, enforce, taskAddsFor, taskAddsForBody,
    DEFAULT_CHANNELS, ACTIVE_TASK_EXCLUDED, deps, _clearCache,
};
