'use strict';

/**
 * Access control shared by every AI endpoint:
 *   - the caller must be an active member of the workspace named in the
 *     request (body.workspaceId, query.workspaceId or params.workspaceId);
 *   - the workspace must not have AI switched off;
 *   - per-user rate limit.
 * Sets req.aiWorkspace = { id, role, settings } and req.aiContext (provider
 * override + model) for the gateway.
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const mongoose = require('mongoose');
const Workspace = require('../../../models/Workspace');
const resolver = require('./ai.provider.resolver');

const isProduction = process.env.NODE_ENV === 'production';

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.AI_RATE_LIMIT_PER_MIN || (isProduction ? 40 : 200)),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.sub ? `u:${req.user.sub}` : ipKeyGenerator(req.ip)),
    handler: (_req, res) => res.status(429).json({ message: 'Too many AI requests. Please slow down.', code: 'AI_RATE_LIMITED' }),
});

/**
 * Per-user AI rate limit, counted once per request even when several AI
 * routers (all mounted at /api/ai) each apply it on the way to their route.
 */
function aiLimiter(req, res, next) {
    if (req.aiRateCounted) return next();
    req.aiRateCounted = true;
    return limiter(req, res, next);
}

function workspaceIdFrom(req) {
    return req.body?.workspaceId || req.query?.workspaceId || req.params?.workspaceId || null;
}

/** Membership + enabled check. `optional: true` lets calls without a workspace through (personal use). */
function requireAIAccess({ optional = false, adminOnly = false } = {}) {
    return async (req, res, next) => {
        try {
            const workspaceId = workspaceIdFrom(req);
            if (!workspaceId) {
                if (optional) { req.aiWorkspace = null; req.aiContext = {}; return next(); }
                return res.status(400).json({ message: 'workspaceId is required' });
            }
            if (!mongoose.Types.ObjectId.isValid(String(workspaceId))) {
                return res.status(400).json({ message: 'Invalid workspaceId' });
            }
            const ws = await Workspace.findOne({ _id: workspaceId, isActive: { $ne: false } }).select('name members settings').lean();
            if (!ws) return res.status(404).json({ message: 'Workspace not found' });
            const me = (ws.members || []).find(m => String(m.user?._id || m.user) === String(req.user.sub) && m.status !== 'removed');
            if (!me) return res.status(403).json({ message: 'You are not a member of this workspace', code: 'WORKSPACE_ACCESS_DENIED' });
            const isAdmin = me.role === 'admin' || me.role === 'owner';
            if (adminOnly && !isAdmin) return res.status(403).json({ message: 'Workspace admin required', code: 'INSUFFICIENT_WORKSPACE_ROLE' });

            const aiSettings = ws.settings?.ai || {};
            const { isFeatureEnabled } = require('../../shared/workspaceFeatures');
            if ((aiSettings.enabled === false || !(await isFeatureEnabled(ws._id, 'ai'))) && !adminOnly) {
                return res.status(403).json({ message: 'AI features are turned off for this workspace', code: 'AI_DISABLED' });
            }

            req.aiWorkspace = { id: String(ws._id), name: ws.name, role: me.role, isAdmin, settings: aiSettings };
            req.aiContext = await resolver.contextFor(ws._id);
            return next();
        } catch (err) {
            return next(err);
        }
    };
}

module.exports = { aiLimiter, requireAIAccess, workspaceIdFrom };
