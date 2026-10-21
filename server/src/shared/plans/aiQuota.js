'use strict';

/**
 * Daily AI request counters (UTC day) for requests answered with the server's
 * own AI key. A request that carries a provider instance (a person's own key
 * from Agents & tools, or a workspace-installed key) is not counted.
 *
 *   ai:u:<userId>:<YYYY-MM-DD>        per person
 *   ai:w:<workspaceId>:<YYYY-MM-DD>   per workspace
 *
 * Counting is increment-then-check, so concurrent requests on several instances
 * can never get past the limit; a refused request gives its increment back.
 */

const plans = require('./plans');
const counters = require('./planCounters');
const planService = require('./planService');

const SYSTEM_IDS = new Set(['system', 'anonymous', '']);

function dayOf(now = new Date()) {
    return now.toISOString().slice(0, 10);
}

function resetsAt(now = new Date()) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return d.toISOString();
}

function ttlSeconds(now = new Date()) {
    return Math.ceil((Date.parse(resetsAt(now)) - now.getTime()) / 1000) + 3600;
}

const userKey = (userId, day) => `ai:u:${userId}:${day}`;
const wsKey = (workspaceId, day) => `ai:w:${workspaceId}:${day}`;

const realId = (v) => {
    const s = v == null ? '' : String(v._id || v);
    return SYSTEM_IDS.has(s) ? null : s;
};

/** Which counters apply: { user: {id, max}|null, workspace: {id, max}|null }. */
async function scopesFor({ userId, workspaceId }) {
    const uid = realId(userId);
    const wid = realId(workspaceId);
    let user = null;
    let workspace = null;
    if (wid) {
        const wp = await planService.cachedWorkspacePlan(wid);
        // A company workspace is never limited, whoever asks.
        if (wp.exempt) return { user: null, workspace: null, exempt: true };
        workspace = { id: wid, max: plans.limitOf(wp.plan, 'ai.workspaceDaily'), plan: wp.plan };
    }
    if (uid) {
        const up = await planService.userPlan(uid).catch(() => ({ plan: 'free', exempt: false }));
        if (!up.exempt) user = { id: uid, max: plans.limitOf(up.plan, 'ai.userDaily'), plan: up.plan };
        else if (!wid) return { user: null, workspace: null, exempt: true };
    }
    return { user, workspace, exempt: false };
}

/** Is this gateway context answered with the server's key (and so counted)? */
function usesServerKey(context = {}) {
    return !context.provider && context.keySource !== 'personal' && context.keySource !== 'workspace';
}

/**
 * Count one AI request. Throws PlanLimitError (ai.userDaily / ai.workspaceDaily)
 * when the day's allowance is used up. Resolves to the usage after counting.
 */
async function consume({ userId, workspaceId, now = new Date() } = {}) {
    const scopes = await scopesFor({ userId, workspaceId });
    const day = dayOf(now);
    const ttl = ttlSeconds(now);
    const out = { userUsed: null, userMax: null, workspaceUsed: null, workspaceMax: null, resetsAt: resetsAt(now), exempt: !!scopes.exempt };
    if (scopes.exempt || plans.isUnlimitedServer()) return out;

    const taken = [];
    try {
        if (scopes.user && scopes.user.max !== null) {
            const k = userKey(scopes.user.id, day);
            const n = await counters.incr(k, 1, ttl);
            taken.push(k);
            if (n > scopes.user.max) {
                throw new plans.PlanLimitError('ai.userDaily', { max: scopes.user.max, used: n - 1, plan: scopes.user.plan });
            }
            out.userUsed = n; out.userMax = scopes.user.max;
        }
        if (scopes.workspace && scopes.workspace.max !== null) {
            const k = wsKey(scopes.workspace.id, day);
            const n = await counters.incr(k, 1, ttl);
            taken.push(k);
            if (n > scopes.workspace.max) {
                throw new plans.PlanLimitError('ai.workspaceDaily', { max: scopes.workspace.max, used: n - 1, plan: scopes.workspace.plan });
            }
            out.workspaceUsed = n; out.workspaceMax = scopes.workspace.max;
        }
    } catch (err) {
        await Promise.all(taken.map((k) => counters.incr(k, -1, ttl).catch(() => {})));
        throw err;
    }
    return out;
}

/** Today's usage without counting anything. */
async function peek({ userId, workspaceId, now = new Date() } = {}) {
    const scopes = await scopesFor({ userId, workspaceId });
    const day = dayOf(now);
    const keys = [];
    if (scopes.user) keys.push(userKey(scopes.user.id, day));
    if (scopes.workspace) keys.push(wsKey(scopes.workspace.id, day));
    const vals = await counters.getMany(keys);
    let i = 0;
    const userUsed = scopes.user ? vals[i++] : null;
    const workspaceUsed = scopes.workspace ? vals[i++] : null;
    const userMax = scopes.user ? scopes.user.max : null;
    const workspaceMax = scopes.workspace ? scopes.workspace.max : null;
    const rem = (used, max) => (max === null || used === null ? null : Math.max(0, max - used));
    return {
        exempt: !!scopes.exempt,
        userUsed, userMax, userRemaining: rem(userUsed, userMax),
        workspaceUsed, workspaceMax, workspaceRemaining: rem(workspaceUsed, workspaceMax),
        resetsAt: resetsAt(now),
    };
}

/** Tell the person's open apps how much they have left (fire and forget). */
function announce(io, userId, workspaceId, usage) {
    const uid = realId(userId);
    if (!io || !uid || !usage || usage.exempt) return;
    try {
        io.to(`user_${uid}`).emit('plan:ai_usage', {
            workspaceId: realId(workspaceId),
            userUsed: usage.userUsed, userMax: usage.userMax,
            workspaceUsed: usage.workspaceUsed, workspaceMax: usage.workspaceMax,
            resetsAt: usage.resetsAt,
        });
    } catch { /* a socket problem never fails an AI request */ }
}

module.exports = { consume, peek, announce, usesServerKey, dayOf, resetsAt, scopesFor };
