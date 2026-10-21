'use strict';

/**
 * Express middleware that refuses a create request over the plan's limits
 * before the controller runs. A refusal is HTTP 403 with the PLAN_LIMIT body;
 * anything unexpected (a counting query failing) lets the request through
 * rather than blocking people because of a counting problem.
 */

const crypto = require('crypto');
const logger = require('../../../utils/logger');
const planService = require('./planService');
const { sendPlanLimit } = require('./index');

const uid = (req) => String(req.user?.sub || req.user?.id || '');

function guard(name, run) {
    return async function planGuard(req, res, next) {
        try {
            await run(req, res);
            return next();
        } catch (err) {
            if (sendPlanLimit(res, err)) return undefined;
            logger.warn({ err: err?.message, guard: name }, '[plans] limit check skipped');
            return next();
        }
    };
}

/** POST /api/workspaces, /create, /import, /:id/clone */
const workspaceCreate = guard('workspaces.create', (req) => planService.assertCanCreateWorkspace(uid(req)));

/**
 * Who could not join: tell the person who invited them (socket + notification),
 * so they know why the invite was not accepted.
 */
async function tellInviter(req, invite, workspace, err) {
    if (!invite?.invitedBy || err.body?.limit !== 'workspaces.join') return;
    try {
        const identity = require('../../identity');
        const joiner = await identity.users.findById(uid(req));
        const name = joiner?.username || joiner?.email || 'Someone';
        const message = `${name} couldn't join ${workspace.name}: they've reached the free plan limit of ${err.body.max} joined workspaces.`;
        const io = req.app?.get?.('io') || require('../../socket/getIO').getIO();
        if (io) {
            io.to(`user_${invite.invitedBy}`).emit('plan:limit_reached', {
                code: 'PLAN_LIMIT', limit: 'workspaces.join', workspaceId: String(workspace._id), workspaceName: workspace.name,
                userId: uid(req), username: name, message,
            });
        }
        await require('../../modules/notifications/notificationService').create(io, {
            recipient: String(invite.invitedBy), workspaceId: String(workspace._id), type: 'plan_limit',
            title: 'Invite not accepted', body: message, link: null, meta: { limit: 'workspaces.join', userId: uid(req) }, push: false,
        });
    } catch (e) {
        logger.warn({ err: e?.message }, '[plans] could not tell the inviter');
    }
}

/** POST /api/workspaces/join { token } — the joiner's join limit and the workspace's seats. */
const workspaceJoin = guard('workspaces.join', async (req) => {
    const token = req.body?.token;
    if (!token) return;
    const { invites } = require('../../identity/queries/auth');
    const invite = await invites.findByTokenHash(crypto.createHash('sha256').update(String(token)).digest('hex'));
    if (!invite || !invite.workspace) return; // the controller explains bad tokens
    const workspace = await require('../../identity').workspaces.findById(invite.workspace);
    if (!workspace) return;
    const me = uid(req);
    if ((workspace.members || []).some((m) => String(m.user) === me && m.status !== 'removed')) return;
    try {
        await planService.assertCanJoinWorkspace(me, workspace);
    } catch (err) {
        if (err.code === 'PLAN_LIMIT') await tellInviter(req, invite, workspace, err);
        throw err;
    }
    const holdsSeat = invite.inviteType === 'email' && invite.status === 'pending' && !invite.used && !!invite.email;
    await planService.assertMemberCapacity(workspace, 1, { inviteHoldsSeat: holdsSeat });
});

/** POST /api/workspaces/:workspaceId/invite — every email invite takes a seat; a link needs one free seat. */
const workspaceInvite = guard('members.perWorkspace', async (req) => {
    const workspaceId = req.params.workspaceId || req.params.id;
    const { emails, inviteType = 'link' } = req.body || {};
    let adding = 1;
    if (inviteType === 'email' && emails) {
        const list = (Array.isArray(emails) ? emails : String(emails).split(','))
            .map((e) => String(e).trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        adding = Math.max(1, new Set(list).size);
    }
    await planService.assertMemberCapacity(workspaceId, adding);
});

/** POST /api/channels { workspaceId } and POST /api/workspaces/:workspaceId/channels */
const channelCreate = guard('channels.perWorkspace', async (req) => {
    const workspaceId = req.params.workspaceId || req.body?.workspaceId;
    if (!workspaceId) return;
    await planService.assertCanCreateChannel(workspaceId);
});

/** POST /api/notes { workspaceId, templateId } — blank notes are unlimited. */
const noteCreate = guard('notes.perTemplate', async (req) => {
    const templateKey = planService.templateKeyFor(req.body?.templateId);
    if (!templateKey || !req.body?.workspaceId) return;
    await planService.assertCanCreateNote(req.body.workspaceId, uid(req), templateKey);
});

/** POST /api/tasks */
const taskCreate = guard('tasks', async (req) => {
    const workspaceId = req.body?.workspaceId;
    if (!workspaceId) return;
    const adds = planService.taskAddsForBody(req.body, uid(req));
    if (!adds.self && !adds.others) return;
    await planService.assertCanCreateTasks(workspaceId, uid(req), adds);
});

/** POST /api/tasks/:id/subtasks — the parent's workspace. */
const subtaskCreate = guard('tasks', async (req) => {
    const parent = await require('../../features/tasks/tasks.query').findById(req.params.id);
    if (!parent?.workspace) return;
    const me = uid(req);
    const ids = [...new Set((Array.isArray(req.body?.assignedTo) ? req.body.assignedTo : []).map(String))];
    const adds = ids.length === 1 && ids[0] === me ? { self: 1, others: 0 } : { self: 0, others: 1 };
    await planService.assertCanCreateTasks(String(parent.workspace._id || parent.workspace), me, adds);
});

module.exports = { workspaceCreate, workspaceJoin, workspaceInvite, channelCreate, noteCreate, taskCreate, subtaskCreate, tellInviter };
