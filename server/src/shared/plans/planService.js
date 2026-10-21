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
function _clearCache() { planCache.clear(); userPlanCache.clear(); }

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

/**
 * Channels that count against channels.perWorkspace: everything not archived
 * except #general, #random and the channels the workspace was created with
 * (`autoCreated`, e.g. the wizard's project channel).
 */
async function channelCount(workspaceId) {
    needMongo();
    const ws = idOf(workspaceId);
    const total = await Channel().countDocuments({
        workspace: ws, name: { $nin: DEFAULT_CHANNELS }, isArchived: { $ne: true }, autoCreated: { $ne: true },
    });
    if (!total) return 0;
    return Math.max(0, total - await legacyWizardChannels(ws));
}

/**
 * Workspaces made before channels carried `autoCreated`: the wizard's project
 * channel is identifiable as a default channel with no channel admins, made by
 * the creator of #general within a minute of it (template channels always have
 * an admin). At most one per workspace. Unknown -> 0 (it simply counts).
 */
const WIZARD_WINDOW_MS = 60 * 1000;
async function legacyWizardChannels(workspaceId) {
    const C = Channel();
    if (typeof C.find !== 'function') return 0;
    try {
        const rows = await C.find({
            workspace: workspaceId,
            isArchived: { $ne: true },
            $or: [
                { name: 'general' },
                { isDefault: true, autoCreated: { $ne: true }, name: { $nin: DEFAULT_CHANNELS }, 'admins.0': { $exists: false } },
            ],
        }).select('name createdAt createdBy').lean();
        const general = (rows || []).find((r) => r.name === 'general');
        if (!general?.createdAt) return 0;
        const at = new Date(general.createdAt).getTime();
        const wizard = rows.filter((r) => r.name !== 'general'
            && String(r.createdBy) === String(general.createdBy)
            && Math.abs(new Date(r.createdAt).getTime() - at) <= WIZARD_WINDOW_MS);
        return Math.min(1, wizard.length);
    } catch {
        return 0;
    }
}

/**
 * Which of `channels` (in order) still fit a workspace's channel allowance,
 * for bulk creation (templates, imports, clones). `isFree(ch)` marks the ones
 * that never count (#general, #random by default). A counting problem allows
 * everything (logged), like the route guards.
 *   -> { allowed, skipped: [names], max }   max = null when unlimited
 */
async function fitChannels(wsOrId, channels = [], { isFree = (ch) => DEFAULT_CHANNELS.includes(ch?.name) } = {}) {
    const list = Array.isArray(channels) ? channels : [];
    let remaining = Infinity;
    let max = null;
    try {
        const { plan, exempt, workspace } = await workspacePlan(wsOrId);
        const limit = exempt ? null : plans.limitOf(plan, 'channels.perWorkspace');
        if (limit !== null && limit !== true) {
            max = limit;
            remaining = Math.max(0, limit - await channelCount(idOf(workspace || wsOrId)));
        }
    } catch (err) {
        require('../../../utils/logger').warn({ err: err?.message }, '[plans] channel allowance unknown, creating every channel');
    }
    const allowed = [];
    const skipped = [];
    for (const ch of list) {
        if (isFree(ch)) { allowed.push(ch); continue; }
        if (remaining > 0) { allowed.push(ch); remaining -= 1; } else skipped.push(ch?.name);
    }
    return { allowed, skipped, max };
}

/** "3 channels skipped: free plan allows 10" (or null). */
function channelsSkippedMessage(skipped, max) {
    const n = (skipped || []).length;
    if (!n) return null;
    return `${n} channel${n === 1 ? '' : 's'} skipped: free plan allows ${max} channels`;
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
 * People to copy into a cloned workspace, within each person's join limit and
 * the new workspace's member cap (the cloner is its owner and holds a seat).
 * `newWorkspace` = { company } of the clone. Other owners become admins.
 *   -> { members: [{ user, role, status, joinedAt }], skipped: [{ userId, reason }] }
 * reason is the limit key: 'workspaces.join' or 'members.perWorkspace'.
 */
async function fitCloneMembers(newWorkspace, sourceMembers = [], clonerId) {
    const me = idOf(clonerId);
    const now = new Date();
    const members = [{ user: me, role: 'owner', status: 'active', joinedAt: now }];
    const skipped = [];
    const ws = { _id: null, members: [], ...newWorkspace };
    const company = isCompanyWorkspace(ws);
    let max = null;
    if (!company) {
        try {
            const { plan, exempt } = await workspacePlan(ws);
            const limit = exempt ? null : plans.limitOf(plan, 'members.perWorkspace');
            max = limit === true ? null : limit;
        } catch { max = null; }
    }
    const seen = new Set([me]);
    for (const m of sourceMembers || []) {
        const uid = idOf(m?.user);
        if (!uid || seen.has(uid) || m.status === 'removed') continue;
        seen.add(uid);
        if (max !== null && members.length + 1 > max) { skipped.push({ userId: uid, reason: 'members.perWorkspace' }); continue; }
        if (!company) {
            try {
                await assertCanJoinWorkspace(uid, ws);
            } catch (err) {
                if (err?.code === 'PLAN_LIMIT') { skipped.push({ userId: uid, reason: 'workspaces.join' }); continue; }
                require('../../../utils/logger').warn({ err: err?.message }, '[plans] join limit unknown for a cloned member, adding them');
            }
        }
        members.push({ user: uid, role: m.role === 'owner' ? 'admin' : (m.role || 'member'), status: 'active', joinedAt: now });
    }
    return { members, skipped };
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

/**
 * `adds` = { self, others } tasks this request would create. `adds.workspace`
 * overrides how many become active in the workspace (0 when an active task only
 * moves from "for myself" to "for others").
 */
async function assertCanCreateTasks(wsOrId, userId, adds = { self: 1, others: 0 }) {
    const { plan, exempt, workspace } = await workspacePlan(wsOrId);
    if (exempt) return;
    const self = Number(adds.self) || 0;
    const others = Number(adds.others) || 0;
    const toWorkspace = adds.workspace === undefined ? self + others : Number(adds.workspace) || 0;
    const counts = await taskCounts(idOf(workspace || wsOrId), userId);
    if (toWorkspace) check('tasks.perWorkspace', plan, counts.workspace, toWorkspace);
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

/**
 * What changing an existing task adds to its creator's active-task counters, or
 * null when nothing new counts. A restore (deleted -> back) or a reopen (done /
 * cancelled -> an open status) makes it active again; reassigning an active task
 * from its creator alone to anyone else moves it to "assigned to others".
 * Tasks that are already active and stay so are never refused (grandfathering).
 *   change = { restore?: true, status?: string, assignedTo?: [ids] }
 *   -> { self, others, workspace } or null
 */
function taskChangeAdds(task, change = {}) {
    if (!task) return null;
    const creator = idOf(task.createdBy);
    const wasActive = !task.deleted && !ACTIVE_TASK_EXCLUDED.includes(task.status);
    const status = change.status === undefined || change.status === null ? task.status : change.status;
    const deleted = change.restore ? false : !!task.deleted;
    if (deleted || ACTIVE_TASK_EXCLUDED.includes(status)) return null;
    const oldAssignees = task.assignedTo || [];
    const newAssignees = change.assignedTo === undefined ? oldAssignees : change.assignedTo;
    const next = taskAddsFor(creator, newAssignees);
    if (!wasActive) return { ...next, workspace: 1 };
    const before = taskAddsFor(creator, oldAssignees);
    if (before.self && next.others) return { self: 0, others: 1, workspace: 0 };
    return null;
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

// Same short cache for a person's plan (calls outside any workspace).
const userPlanCache = new Map();
async function cachedUserPlan(userId) {
    const key = idOf(userId);
    const hit = userPlanCache.get(key);
    if (hit && Date.now() - hit.at < PLAN_CACHE_MS) return hit.value;
    const { plan, exempt } = await userPlan(key);
    const value = { plan, exempt };
    userPlanCache.set(key, { at: Date.now(), value });
    return value;
}

/**
 * Limits for one call (null = only the server's technical cap). A call in a
 * workspace follows the workspace's plan (company workspaces are exempt); a
 * call outside any workspace (`workspaceId` null) follows `userId`'s own plan
 * (company accounts are exempt, everyone else gets the free plan's numbers).
 */
async function huddleLimits(workspaceId, { userId = null } = {}) {
    const { plan, exempt } = !idOf(workspaceId) && userId ? await cachedUserPlan(userId) : await cachedWorkspacePlan(workspaceId);
    if (exempt) return { plan, exempt, participants: null, minutes: null };
    return { plan, exempt, participants: plans.limitOf(plan, 'huddles.participants'), minutes: plans.limitOf(plan, 'huddles.minutes') };
}

module.exports = {
    isCompanyUser, isCompanyWorkspace, templateKeyFor,
    userPlan, workspacePlan, cachedWorkspacePlan,
    workspaceCounts, seatCount, channelCount, fitChannels, channelsSkippedMessage, fitCloneMembers, noteTemplateCount, notesByTemplate, taskCounts,
    assertCanCreateWorkspace, assertCanJoinWorkspace, assertMemberCapacity, assertCanCreateChannel,
    assertCanCreateNote, assertCanCreateTasks, huddleLimits, enforce, taskAddsFor, taskAddsForBody, taskChangeAdds,
    DEFAULT_CHANNELS, ACTIVE_TASK_EXCLUDED, deps, _clearCache,
};
