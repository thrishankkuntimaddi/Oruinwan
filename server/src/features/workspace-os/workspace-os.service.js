// server/src/features/workspace-os/workspace-os.service.js
// Workspace OS Core — service layer for clone, export, import, and analytics.
// All handlers here are orchestration-layer wrappers that call existing model logic.
'use strict';

const mongoose = require('mongoose');
const Workspace = require('../../../models/Workspace');
const Channel = require('../channels/channel.model');
const Message = require('../messages/message.model');
const Task = require('../../../models/Task');
const User = require('../../../models/User');
const WorkspaceTemplate = require('../../models/WorkspaceTemplate');
const AuditLog = require('../../../models/AuditLog');
const ComplianceLog = require('../../../models/ComplianceLog');
const conversationKeysService = require('../../modules/conversations/conversationKeys.service');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Write audit + compliance log in parallel (non-blocking on failure)
// ─────────────────────────────────────────────────────────────────────────────
async function logAction(opts) {
    const { userId, companyId, action, category, severity = 'info', resourceType, resourceId, resourceName, details, ipAddress, userAgent } = opts;
    try {
        const actor = await User.findById(userId).select('email companyRole').lean();
        await Promise.all([
            AuditLog.create({
                companyId: companyId || null,
                userId,
                action,
                resource: resourceType,
                resourceId,
                details,
                ipAddress,
                userAgent,
                severity,
                category,
                status: 'success'
            }),
            companyId ? ComplianceLog.create({
                companyId,
                actorId: userId,
                actorEmail: actor?.email,
                actorRole: actor?.companyRole,
                action,
                category,
                severity,
                resourceType,
                resourceId,
                resourceName,
                details,
                ipAddress,
                userAgent,
                createdAt: new Date()
            }) : Promise.resolve()
        ]);
    } catch (err) {
        // Non-fatal — logging must never block business operations
        console.error('[WorkspaceOS] audit log write failed (non-fatal):', err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// cloneWorkspace
// Deep-copies workspace structure + optionally members.
// Messages and content are NOT copied.
// ─────────────────────────────────────────────────────────────────────────────
exports.cloneWorkspace = async function ({ sourceId, userId, name, includeMembers = false, companyId, ipAddress, userAgent }) {
    const source = await Workspace.findById(sourceId).lean();
    if (!source) throw Object.assign(new Error('Source workspace not found'), { status: 404 });

    // Tenant safety
    if (source.company && companyId && String(source.company) !== String(companyId)) {
        throw Object.assign(new Error('Access denied to source workspace'), { status: 403 });
    }

    const user = await User.findById(userId).select('companyId companyRole').lean();
    const resolvedCompanyId = user?.companyId || companyId || null;

    const cloneName = name || `${source.name} (Clone)`;

    // Create the new workspace
    const cloned = await Workspace.create({
        company: resolvedCompanyId,
        type: source.type,
        name: cloneName,
        description: source.description || '',
        icon: source.icon,
        color: source.color,
        rules: source.rules || '',
        createdBy: userId,
        members: includeMembers
            ? source.members.map(m => ({ ...m, joinedAt: new Date(), suspendedAt: null, removedAt: null }))
            : [{ user: userId, role: 'owner', joinedAt: new Date() }],
        settings: { ...source.settings },
        clonedFrom: source._id,
        templateId: source.templateId || null
    });

    // Clone channels (structure only, no messages)
    const sourceChannels = await Channel.find({ workspace: sourceId }).lean();
    const channelIdMap = {}; // old → new

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
            createdBy: userId,
            members: [{ user: userId, joinedAt: creationDate }],
            systemEvents: [{ type: 'channel_created', userId, timestamp: creationDate }]
        });
        channelIdMap[ch._id.toString()] = newChannel._id;

        // Bootstrap E2EE conversation key for the new channel
        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: newChannel._id.toString(),
                conversationType: 'channel',
                workspaceId: cloned._id.toString(),
                members: [userId]
            });
        } catch (keyErr) {
            console.warn('[WorkspaceOS] Key bootstrap failed for cloned channel (non-fatal):', keyErr.message);
        }
    }

    // Update defaultChannels references on the cloned workspace
    if (source.defaultChannels?.length) {
        cloned.defaultChannels = source.defaultChannels
            .map(id => channelIdMap[id.toString()])
            .filter(Boolean);
        await cloned.save();
    }

    // Add cloned workspace to creator's workspace list
    await User.findByIdAndUpdate(userId, {
        $push: { workspaces: { workspace: cloned._id, role: 'owner' } }
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// exportWorkspace
// Produces a JSON bundle snapshot of the workspace structure.
// ─────────────────────────────────────────────────────────────────────────────
exports.exportWorkspace = async function ({ workspaceId, userId, companyId, ipAddress, userAgent }) {
    const workspace = await Workspace.findById(workspaceId)
        .populate('createdBy', 'username email')
        .populate('members.user', 'username email')
        .lean();
    if (!workspace) throw Object.assign(new Error('Workspace not found'), { status: 404 });

    const channels = await Channel.find({ workspace: workspaceId })
        .select('name description isPrivate isDefault isDiscoverable settings')
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
        })),
        memberCount: workspace.members?.length || 0,
        templateId: workspace.templateId?.toString() || null
    };

    // Stamp exportedAt on the workspace record
    await Workspace.findByIdAndUpdate(workspaceId, { exportedAt: new Date() });

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

// ─────────────────────────────────────────────────────────────────────────────
// importWorkspace
// Reconstructs a workspace from an export bundle.
// ─────────────────────────────────────────────────────────────────────────────
exports.importWorkspace = async function ({ bundle, userId, companyId, ipAddress, userAgent }) {
    // Schema validation
    if (!bundle?.schemaVersion || !bundle?.workspace?.name) {
        throw Object.assign(new Error('Invalid workspace bundle — missing required fields'), { status: 400 });
    }

    const user = await User.findById(userId).select('companyId companyRole').lean();
    const resolvedCompanyId = user?.companyId || companyId || null;

    const { workspace: wsData, channels = [] } = bundle;

    // Deduplicate name
    const existingNames = await Workspace.distinct('name', { createdBy: userId });
    let finalName = wsData.name;
    if (existingNames.includes(finalName)) {
        finalName = `${finalName} (Imported)`;
    }

    const imported = await Workspace.create({
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
            console.warn('[WorkspaceOS] Key bootstrap failed for imported channel (non-fatal):', keyErr.message);
        }
    }

    imported.defaultChannels = defaultChannelIds;
    await imported.save();

    await User.findByIdAndUpdate(userId, {
        $push: { workspaces: { workspace: imported._id, role: 'owner' } }
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// getWorkspaceAnalytics
// Computes real-time usage stats for a workspace.
// ─────────────────────────────────────────────────────────────────────────────
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
        Task.countDocuments({ workspace: workspaceId }),
        Workspace.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(workspaceId) } },
            { $project: { count: { $size: '$members' } } }
        ]).then(r => r[0]?.count || 0),
        Channel.countDocuments({ workspace: workspaceId }),
        // Daily message counts for sparkline chart
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
        // Active members (unique authors) in last 7 days
        Message.distinct('author', {
            workspace: new mongoose.Types.ObjectId(workspaceId),
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).then(ids => ids.length),
        // Task completion rate
        Task.aggregate([
            { $match: { workspace: new mongoose.Types.ObjectId(workspaceId) } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }
                }
            }
        ])
    ]);

    const taskCompletionRate = taskStats[0]?.total > 0
        ? Math.round((taskStats[0].completed / taskStats[0].total) * 100)
        : 0;

    // Update analyticsCache on the workspace doc (non-blocking)
    Workspace.findByIdAndUpdate(workspaceId, {
        '$set': {
            'analyticsCache.totalMessages': totalMessages,
            'analyticsCache.totalTasks': totalTasks,
            'analyticsCache.activeMembers7d': activeAuthorsSince7d,
            'analyticsCache.lastComputedAt': new Date()
        }
    }).catch(err => console.warn('[WorkspaceOS] Cache update failed:', err.message));

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
            dailyMessages, // [{ _id: '2024-01-01', count: 5 }, ...]
        },
        range,
        computedAt: new Date().toISOString()
    };
};
