'use strict';

/**
 * Per-workspace feature switches (WorkspacePermission.featureToggles), set by a
 * workspace's owners/admins. Every feature is on unless turned off.
 *
 *   isFeatureEnabled(workspaceId, 'polls')
 *   requireWorkspaceFeature('polls', resolvers.fromBodyConversation)   // express middleware
 */

const mongoose = require('mongoose');

const FEATURES = Object.freeze(['tasks', 'notes', 'polls', 'ai', 'huddles', 'fileUploads', 'reactions', 'threads', 'bookmarks', 'reminders']);
const DEFAULTS = Object.freeze(Object.fromEntries(FEATURES.map((f) => [f, true])));

const TTL_MS = 30 * 1000;
const cache = new Map(); // workspaceId -> { toggles, at }

async function getWorkspaceFeatures(workspaceId) {
    if (!workspaceId || !mongoose.isValidObjectId(String(workspaceId))) return { ...DEFAULTS };
    const key = String(workspaceId);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.toggles;
    const WorkspacePermission = require('../../models/WorkspacePermission');
    const doc = await WorkspacePermission.findOne({ workspace: key }).select('featureToggles').lean();
    const toggles = { ...DEFAULTS };
    for (const f of FEATURES) {
        if (doc?.featureToggles && typeof doc.featureToggles[f] === 'boolean') toggles[f] = doc.featureToggles[f];
    }
    cache.set(key, { toggles, at: Date.now() });
    return toggles;
}

async function isFeatureEnabled(workspaceId, feature) {
    if (!FEATURES.includes(feature)) throw new Error(`Unknown workspace feature "${feature}"`);
    return (await getWorkspaceFeatures(workspaceId))[feature] !== false;
}

/** Call after toggles change so the next check sees them. */
function invalidateWorkspaceFeatures(workspaceId) {
    if (workspaceId) cache.delete(String(workspaceId)); else cache.clear();
}

// ── Finding the workspace a request acts on ─────────────────────────────────
const workspaceOfChannel = async (id) => {
    if (!id || !mongoose.isValidObjectId(String(id))) return null;
    const Channel = require('../../features/channels/channel.model');
    return (await Channel.findById(id).select('workspace').lean())?.workspace || null;
};
const workspaceOfDm = async (id) => {
    if (!id || !mongoose.isValidObjectId(String(id))) return null;
    const DMSession = require('../../../models/DMSession');
    return (await DMSession.findById(id).select('workspace').lean())?.workspace || null;
};
const workspaceOfMessage = async (id) => {
    if (!id || !mongoose.isValidObjectId(String(id))) return null;
    const Message = require('../../modules/messages/message.model');
    return (await Message.findById(id).select('workspace').lean())?.workspace || null;
};

const resolvers = {
    fromWorkspaceField: async (req) => req.body?.workspaceId || req.query?.workspaceId || req.params?.workspaceId || null,
    fromBodyConversation: async (req) => req.body?.workspaceId
        || (req.body?.channelId && await workspaceOfChannel(req.body.channelId))
        || ((req.body?.dmSessionId || req.body?.dmId) && await workspaceOfDm(req.body.dmSessionId || req.body.dmId))
        || null,
    fromUploadConversation: async (req) => {
        const { conversationId, conversationType } = req.body || {};
        if (!conversationId) return req.body?.workspaceId || null;
        return conversationType === 'dm' ? workspaceOfDm(conversationId) : workspaceOfChannel(conversationId);
    },
    fromMessageParam: async (req) => workspaceOfMessage(req.params?.messageId || req.params?.id),
};

function requireWorkspaceFeature(feature, resolve = resolvers.fromWorkspaceField) {
    if (!FEATURES.includes(feature)) throw new Error(`Unknown workspace feature "${feature}"`);
    return async function workspaceFeatureGuard(req, res, next) {
        try {
            const workspaceId = await resolve(req);
            if (workspaceId && !(await isFeatureEnabled(workspaceId, feature))) {
                return res.status(403).json({
                    code: 'FEATURE_DISABLED_FOR_WORKSPACE',
                    feature,
                    message: 'This feature is turned off in this workspace.',
                });
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = {
    FEATURES, DEFAULTS, getWorkspaceFeatures, isFeatureEnabled, invalidateWorkspaceFeatures,
    requireWorkspaceFeature, resolvers, workspaceOfChannel, workspaceOfDm, workspaceOfMessage,
};
