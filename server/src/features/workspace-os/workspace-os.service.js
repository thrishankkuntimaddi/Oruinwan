'use strict';
const logger = require('../../../utils/logger');

const mongoose = require('mongoose');
const identity = require('../../identity');
const wsQueries = require('../../identity/queries/workspaces');
const { hydrate } = require('../../identity/hydrate');
const Channel = require('../channels/channel.model');
const Message = require('../../modules/messages/message.model');
const Tasks = require('../tasks/tasks.query');
const WorkspaceTemplate = require('../../models/WorkspaceTemplate');
const { invalidateWorkspaceFeatures } = require('../../shared/workspaceFeatures');
const conversationKeysService = require('../../modules/conversations/conversationKeys.service');

const { recordAdminAction: logAction } = require('../../shared/adminAudit');

// Same free-plan cap createWorkspace applies to personal accounts.
const PERSONAL_WORKSPACE_LIMIT = 3;
async function assertPersonalWorkspaceLimit(companyId, userId) {
    if (companyId) return;
    if (await wsQueries.countCreatedBy(userId) >= PERSONAL_WORKSPACE_LIMIT) {
        throw Object.assign(new Error(`Free plan limit reached. You can only create up to ${PERSONAL_WORKSPACE_LIMIT} workspaces.`), { status: 403, isLimitReached: true });
    }
}

exports.cloneWorkspace = async function ({ sourceId, userId, name, includeMembers = false, companyId, ipAddress, userAgent }) {
    const source = await identity.workspaces.findById(sourceId);
    if (!source) throw Object.assign(new Error('Source workspace not found'), { status: 404 });

    
    if (source.company && companyId && String(source.company) !== String(companyId)) {
        throw Object.assign(new Error('Access denied to source workspace'), { status: 403 });
    }

    const user = await identity.users.findById(userId);
    const resolvedCompanyId = user?.companyId || companyId || null;
    await assertPersonalWorkspaceLimit(resolvedCompanyId, userId);

    const cloneName = name || `${source.name} (Clone)`;

    
    let cloned = await identity.workspaces.create({
        company: resolvedCompanyId,
        type: source.type,
        name: cloneName,
        description: source.description || '',
        icon: source.icon,
        color: source.color,
        rules: source.rules || '',
        createdBy: userId,
        members: includeMembers
            ? source.members.filter(m => m.status !== 'removed').map(m => ({ user: m.user, role: m.role, status: m.status, joinedAt: new Date() }))
            : [{ user: userId, role: 'owner', joinedAt: new Date() }],
        settings: { ...(source.settings || {}) },
        clonedFrom: source._id,
        templateId: source.templateId || null
    });

    
    const sourceChannels = await Channel.find({ workspace: sourceId }).lean();
    const channelIdMap = {}; 

    const creationDate = new Date();
    for (const ch of sourceChannels) {
        const newChannel = await Channel.create({
            workspace: cloned._id,
            company: resolvedCompanyId,
            name: ch.name,
            description: ch.description || '',
            isPrivate: ch.isPrivate,
            isDefault: ch.isDefault,
            isDiscoverable: ch.isDiscoverable !== false,
            postingPolicy: ch.postingPolicy === 'admins' ? 'admins' : 'everyone',
            broadcastMentions: ch.broadcastMentions === 'admins' ? 'admins' : 'everyone',
            createdBy: userId,
            members: [{ user: userId, joinedAt: creationDate }],
            systemEvents: [{ type: 'channel_created', userId, timestamp: creationDate }]
        });
        channelIdMap[ch._id.toString()] = newChannel._id;

        
        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: newChannel._id.toString(),
                conversationType: 'channel',
                workspaceId: cloned._id.toString(),
                members: [userId]
            });
        } catch (keyErr) {
            logger.warn('[WorkspaceOS] Key bootstrap failed for cloned channel (non-fatal):', keyErr.message);
        }
    }

    
    if (source.defaultChannels?.length) {
        cloned = await identity.workspaces.update(cloned._id, {
            defaultChannels: source.defaultChannels.map(id => channelIdMap[id.toString()]).filter(Boolean),
        });
    }

    // Feature toggles and workspace permissions come along; channel rules are remapped.
    const sourcePerms = await identity.workspacePermissions.get(sourceId);
    if (sourcePerms) {
        const { channelPermissions = [] } = sourcePerms;
        await identity.workspacePermissions.upsert(cloned._id, {
            company: resolvedCompanyId,
            featureToggles: sourcePerms.featureToggles || {},
            invitePermission: sourcePerms.invitePermission,
            channelCreationPermission: sourcePerms.channelCreationPermission,
            channelPermissions: channelPermissions
                .filter(cp => channelIdMap[String(cp.channel)])
                .map(({ _id: _cpId, ...cp }) => ({ ...cp, channel: String(channelIdMap[String(cp.channel)]) })),
            updatedBy: userId,
        });
    }

    await logAction({
        userId, companyId: resolvedCompanyId,
        action: 'workspace.cloned',
        category: 'workspace', severity: 'info',
        resourceType: 'Workspace', resourceId: cloned._id, resourceName: cloneName,
        details: { sourceId, cloneName, includeMembers },
        ipAddress, userAgent
    });

    return cloned;
};

exports.exportWorkspace = async function ({ workspaceId, userId, companyId, ipAddress, userAgent }) {
    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) throw Object.assign(new Error('Workspace not found'), { status: 404 });
    await hydrate(workspace, { createdBy: { type: 'user', fields: ['username', 'email'] }, 'members.user': { type: 'user', fields: ['username', 'email'] } });

    const channels = await Channel.find({ workspace: workspaceId })
        .select('name description isPrivate isDefault isDiscoverable postingPolicy broadcastMentions settings')
        .lean();

    const bundle = {
        schemaVersion: '1.0',
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
        workspace: {
            name: workspace.name,
            description: workspace.description,
            icon: workspace.icon,
            color: workspace.color,
            rules: workspace.rules || '',
            type: workspace.type,
            settings: workspace.settings
        },
        channels: channels.map(ch => ({
            name: ch.name,
            description: ch.description || '',
            isPrivate: ch.isPrivate,
            isDefault: ch.isDefault,
            isDiscoverable: ch.isDiscoverable !== false,
            postingPolicy: ch.postingPolicy === 'admins' ? 'admins' : 'everyone',
            broadcastMentions: ch.broadcastMentions === 'admins' ? 'admins' : 'everyone',
        })),
        memberCount: workspace.members?.length || 0,
        templateId: workspace.templateId?.toString() || null,
        featureToggles: (await identity.workspacePermissions.get(workspaceId))?.featureToggles || null
    };

    
    await identity.workspaces.update(workspaceId, { exportedAt: new Date() });

    await logAction({
        userId, companyId: companyId || workspace.company,
        action: 'workspace.exported',
        category: 'data-export', severity: 'info',
        resourceType: 'Workspace', resourceId: workspace._id, resourceName: workspace.name,
        details: { channelCount: channels.length },
        ipAddress, userAgent
    });

    return bundle;
};

exports.importWorkspace = async function ({ bundle, userId, companyId, ipAddress, userAgent }) {
    
    if (!bundle?.schemaVersion || !bundle?.workspace?.name) {
        throw Object.assign(new Error('Invalid workspace bundle — missing required fields'), { status: 400 });
    }

    const user = await identity.users.findById(userId);
    const resolvedCompanyId = user?.companyId || companyId || null;
    await assertPersonalWorkspaceLimit(resolvedCompanyId, userId);

    const { workspace: wsData, channels = [], featureToggles = null } = bundle;

    
    let finalName = wsData.name;
    if (await wsQueries.findByNameForCreator(finalName, userId)) {
        finalName = `${finalName} (Imported)`;
    }

    let imported = await identity.workspaces.create({
        company: resolvedCompanyId,
        type: wsData.type || 'team',
        name: finalName,
        description: wsData.description || '',
        icon: wsData.icon || '📁',
        color: wsData.color || '#2563eb',
        rules: wsData.rules || '',
        createdBy: userId,
        members: [{ user: userId, role: 'owner', joinedAt: new Date() }],
        settings: wsData.settings || {}
    });

    const creationDate = new Date();
    const defaultChannelIds = [];

    for (const ch of channels) {
        const newCh = await Channel.create({
            workspace: imported._id,
            company: resolvedCompanyId,
            name: ch.name,
            description: ch.description || '',
            isPrivate: ch.isPrivate || false,
            isDefault: ch.isDefault || false,
            isDiscoverable: ch.isDiscoverable !== false,
            postingPolicy: ch.postingPolicy === 'admins' ? 'admins' : 'everyone',
            broadcastMentions: ch.broadcastMentions === 'admins' ? 'admins' : 'everyone',
            createdBy: userId,
            members: [{ user: userId, joinedAt: creationDate }],
            systemEvents: [{ type: 'channel_created', userId, timestamp: creationDate }]
        });
        if (ch.isDefault) defaultChannelIds.push(newCh._id);

        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: newCh._id.toString(),
                conversationType: 'channel',
                workspaceId: imported._id.toString(),
                members: [userId]
            });
        } catch (keyErr) {
            logger.warn('[WorkspaceOS] Key bootstrap failed for imported channel (non-fatal):', keyErr.message);
        }
    }

    imported = await identity.workspaces.update(imported._id, { defaultChannels: defaultChannelIds });

    if (featureToggles && typeof featureToggles === 'object') {
        const toggles = {};
        for (const [key, value] of Object.entries(featureToggles)) {
            if (typeof value === 'boolean') toggles[key] = value;
        }
        await identity.workspacePermissions.upsert(imported._id, {
            featureToggles: { $merge: true, ...toggles }, company: resolvedCompanyId || null, updatedBy: userId,
        });
    }

    await logAction({
        userId, companyId: resolvedCompanyId,
        action: 'workspace.imported',
        category: 'data-import', severity: 'info',
        resourceType: 'Workspace', resourceId: imported._id, resourceName: finalName,
        details: { channelCount: channels.length, originalName: wsData.name },
        ipAddress, userAgent
    });

    return imported;
};

exports.getWorkspaceAnalytics = async function ({ workspaceId, companyId, range = 30 }) {
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

    const [
        totalMessages,
        totalTasks,
        memberCount,
        channelCount,
        dailyMessages,
        activeAuthorsSince7d,
        taskStats
    ] = await Promise.all([
        Message.countDocuments({ workspace: workspaceId }),
        Tasks.countDocuments({ workspace: workspaceId }),
        wsQueries.countMembers(workspaceId, { status: null }),
        Channel.countDocuments({ workspace: workspaceId }),
        
        Message.aggregate([
            { $match: { workspace: new mongoose.Types.ObjectId(workspaceId), createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        
        Message.distinct('author', {
            workspace: new mongoose.Types.ObjectId(workspaceId),
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).then(ids => ids.length),
        
        Tasks.totals({ workspace: workspaceId }).then((t) => [t])
    ]);

    const taskCompletionRate = taskStats[0]?.total > 0
        ? Math.round((taskStats[0].completed / taskStats[0].total) * 100)
        : 0;

    
    identity.workspaces.update(workspaceId, {
        analyticsCache: {
            $merge: true,
            totalMessages,
            totalTasks,
            activeMembers7d: activeAuthorsSince7d,
            lastComputedAt: new Date(),
        },
    }).catch(err => logger.warn('[WorkspaceOS] Cache update failed:', err.message));

    return {
        summary: {
            totalMessages,
            totalTasks,
            memberCount,
            channelCount,
            activeMembers7d: activeAuthorsSince7d,
            taskCompletionRate
        },
        charts: {
            dailyMessages, 
        },
        range,
        computedAt: new Date().toISOString()
    };
};

/**
 * Apply a workspace template to a freshly created workspace: its settings, its
 * feature toggles and any channels it defines beyond the ones already present.
 * The template must be public, belong to the user's company, or be the user's own.
 */
exports.applyTemplate = async function ({ workspace, templateId, userId, companyId }) {
    const template = await WorkspaceTemplate.findOne({ _id: templateId, isActive: true }).lean();
    if (!template) throw Object.assign(new Error('Template not found'), { status: 404 });
    const allowed = template.isPublic
        || String(template.createdBy) === String(userId)
        || (template.company && companyId && String(template.company) === String(companyId));
    if (!allowed) throw Object.assign(new Error('Template not available'), { status: 403 });

    const existing = new Set((await Channel.find({ workspace: workspace._id }).select('name').lean()).map(c => c.name));
    const creationDate = new Date();
    for (const ch of template.defaultChannels || []) {
        const name = String(ch.name || '').trim().toLowerCase().replace(/\s+/g, '-');
        if (!name || existing.has(name)) continue;
        existing.add(name);
        const channel = await Channel.create({
            workspace: workspace._id,
            company: workspace.company || null,
            name,
            description: ch.description || '',
            isPrivate: !!ch.isPrivate,
            isDefault: !!ch.isDefault,
            isDiscoverable: !ch.isPrivate,
            createdBy: userId,
            admins: [userId],
            members: [{ user: userId, joinedAt: creationDate }],
            systemEvents: [{ type: 'channel_created', userId, timestamp: creationDate }],
        });
        if (ch.isDefault) {
            const current = await identity.workspaces.findById(workspace._id);
            const ids = new Set((current?.defaultChannels || []).map(String));
            ids.add(String(channel._id));
            await identity.workspaces.update(workspace._id, { defaultChannels: [...ids] });
        }
        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: channel._id.toString(),
                conversationType: 'channel',
                workspaceId: workspace._id.toString(),
                members: [userId],
            });
        } catch (keyErr) {
            logger.warn('[WorkspaceOS] Key bootstrap failed for template channel (non-fatal):', keyErr.message);
        }
    }

    await identity.workspaces.update(workspace._id, {
        settings: { $merge: true, ...(template.settings || {}) },
        templateId: template._id,
    });

    if (template.featureToggles) {
        await identity.workspacePermissions.upsert(workspace._id, {
            featureToggles: { $merge: true, ...template.featureToggles },
            company: workspace.company || null,
            updatedBy: userId,
        });
        invalidateWorkspaceFeatures(workspace._id);
    }

    await WorkspaceTemplate.updateOne({ _id: template._id }, { $inc: { usageCount: 1 } });
    return template;
};
