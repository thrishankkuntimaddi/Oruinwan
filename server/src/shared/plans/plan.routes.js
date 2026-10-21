'use strict';

/**
 * /api/plan — the caller's plan, its limits and what is used (docs/api/plans.md).
 *
 *   GET /api/plan?workspaceId=     plan, limits, usage and progress-bar items
 *   GET /api/plan/ai?workspaceId=  today's AI counters only
 */

const express = require('express');
const requireAuth = require('../middleware/auth');
const plans = require('./plans');
const planService = require('./planService');
const aiQuota = require('./aiQuota');
const logger = require('../../../utils/logger');

const router = express.Router();
router.use(requireAuth);

const ITEM_ORDER = [
    ['workspaces.create', 'user'],
    ['workspaces.join', 'user'],
    ['members.perWorkspace', 'workspace'],
    ['channels.perWorkspace', 'workspace'],
    ['tasks.perWorkspace', 'workspace'],
    ['tasks.selfCreated', 'user'],
    ['tasks.assignedToOthers', 'user'],
    ['ai.userDaily', 'user'],
    ['ai.workspaceDaily', 'workspace'],
];

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

/** Resolve the workspace the caller asked about; null when not given, 403/404 via throw. */
async function workspaceFor(req) {
    const workspaceId = req.query.workspaceId;
    if (!workspaceId) return null;
    if (!isId(String(workspaceId))) throw Object.assign(new Error('Invalid workspaceId'), { status: 400 });
    const access = await require('../../identity').workspaces.membership(workspaceId, req.user.sub);
    if (!access) throw Object.assign(new Error('Workspace not found'), { status: 404 });
    if (!access.member) throw Object.assign(new Error('You are not a member of this workspace'), { status: 403 });
    return access.workspace;
}

/** settle(promise) -> value or null, so one failing count never hides the others. */
const settle = (p) => Promise.resolve(p).catch((err) => { logger.warn({ err: err?.message }, '[plans] usage count failed'); return null; });

async function buildPlan(userId, workspace) {
    const up = await planService.userPlan(userId);
    const wp = workspace ? await planService.workspacePlan(workspace) : null;
    const userLimits = plans.limitsFor(up.plan);
    const wsLimits = wp ? plans.limitsFor(wp.plan) : null;

    const limits = {};
    for (const key of plans.LIMIT_KEYS) {
        const userScoped = key.startsWith('workspaces.') || key === 'ai.userDaily';
        limits[key] = userScoped || !wsLimits ? userLimits[key] : wsLimits[key];
    }

    const wsId = workspace ? String(workspace._id) : null;
    const [counts, seats, channels, tasks, byTemplate, ai] = await Promise.all([
        up.exempt ? null : settle(planService.workspaceCounts(userId)),
        wsId && !wp.exempt ? settle(planService.seatCount(wsId)) : null,
        wsId && !wp.exempt ? settle(planService.channelCount(wsId)) : null,
        wsId && !wp.exempt ? settle(planService.taskCounts(wsId, userId)) : null,
        wsId && !wp.exempt ? settle(planService.notesByTemplate(wsId, userId)) : null,
        settle(aiQuota.peek({ userId, workspaceId: wsId })),
    ]);

    const usage = {};
    if (counts) { usage['workspaces.create'] = counts.owned; usage['workspaces.join'] = counts.joined; }
    if (seats) usage['members.perWorkspace'] = seats.total;
    if (channels !== null && channels !== undefined) usage['channels.perWorkspace'] = channels;
    if (tasks) {
        usage['tasks.perWorkspace'] = tasks.workspace;
        usage['tasks.selfCreated'] = tasks.self;
        usage['tasks.assignedToOthers'] = tasks.others;
    }
    if (ai && ai.userUsed !== null) usage['ai.userDaily'] = ai.userUsed;
    if (ai && ai.workspaceUsed !== null) usage['ai.workspaceDaily'] = ai.workspaceUsed;

    // When the workspace is a company one, everything about it is unlimited.
    if (wp && wp.exempt) for (const key of Object.keys(limits)) if (!key.startsWith('workspaces.')) limits[key] = key === 'notes.externalSharing' ? true : null;
    if (up.exempt) { limits['workspaces.create'] = null; limits['workspaces.join'] = null; }

    const items = [];
    const blocked = {};
    for (const [key, scope] of ITEM_ORDER) {
        if (scope === 'workspace' && !wsId) continue;
        const max = limits[key] === undefined ? null : limits[key];
        const used = usage[key] === undefined ? null : usage[key];
        const atLimit = max !== null && used !== null && used >= max;
        blocked[key] = atLimit;
        items.push({ key, label: plans.LABELS[key].label, used, max, atLimit, scope });
    }
    const perTemplate = limits['notes.perTemplate'];
    const exempt = !!(wp ? wp.exempt : up.exempt);

    return {
        plan: wp ? wp.plan : up.plan,
        userPlan: up.plan,
        workspacePlan: wp ? wp.plan : null,
        exempt,
        upgradeUrl: plans.UPGRADE_URL,
        plans: plans.publicPlans().map(({ id, name, comingSoon }) => ({ id, name, comingSoon })),
        limits,
        usage,
        items,
        notes: { perTemplate, byTemplate: byTemplate || {}, externalSharing: limits['notes.externalSharing'] !== false },
        huddles: { participants: limits['huddles.participants'], minutes: limits['huddles.minutes'] },
        ai: ai || null,
        blocked,
    };
}

router.get('/', async (req, res) => {
    try {
        const workspace = await workspaceFor(req);
        return res.json(await buildPlan(String(req.user.sub), workspace));
    } catch (err) {
        if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message });
        logger.error({ err }, '[plans] GET /api/plan failed');
        return res.status(500).json({ message: 'Could not load your plan' });
    }
});

router.get('/ai', async (req, res) => {
    try {
        const workspace = await workspaceFor(req);
        return res.json(await aiQuota.peek({ userId: String(req.user.sub), workspaceId: workspace ? String(workspace._id) : null }));
    } catch (err) {
        if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message });
        logger.error({ err }, '[plans] GET /api/plan/ai failed');
        return res.status(500).json({ message: 'Could not load AI usage' });
    }
});

module.exports = router;
module.exports.buildPlan = buildPlan;
