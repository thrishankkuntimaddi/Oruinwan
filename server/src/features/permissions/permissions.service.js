// server/src/features/permissions/permissions.service.js
// Role Permission Matrix — read/write granular role→module permissions.
'use strict';

const Permission = require('../../../models/Permission');

const DEFAULT_MATRIX = {
    owner: {
        manageCompany: true, viewAnalytics: true, manageBilling: true,
        inviteUsers: true, removeUsers: true, manageRoles: true,
        createWorkspace: true, deleteWorkspace: true, manageWorkspaceMembers: true,
        createChannel: true, deleteChannel: true, manageChannelMembers: true,
        sendMessages: true, deleteMessages: true, pinMessages: true,
        createTasks: true, assignTasks: true, deleteTasks: true,
        createNotes: true, shareNotes: true,
        postUpdates: true, deleteUpdates: true
    },
    admin: {
        manageCompany: false, viewAnalytics: true, manageBilling: false,
        inviteUsers: true, removeUsers: true, manageRoles: true,
        createWorkspace: true, deleteWorkspace: false, manageWorkspaceMembers: true,
        createChannel: true, deleteChannel: true, manageChannelMembers: true,
        sendMessages: true, deleteMessages: true, pinMessages: true,
        createTasks: true, assignTasks: true, deleteTasks: true,
        createNotes: true, shareNotes: true,
        postUpdates: true, deleteUpdates: true
    },
    manager: {
        manageCompany: false, viewAnalytics: true, manageBilling: false,
        inviteUsers: true, removeUsers: false, manageRoles: false,
        createWorkspace: true, deleteWorkspace: false, manageWorkspaceMembers: true,
        createChannel: true, deleteChannel: false, manageChannelMembers: true,
        sendMessages: true, deleteMessages: false, pinMessages: true,
        createTasks: true, assignTasks: true, deleteTasks: false,
        createNotes: true, shareNotes: true,
        postUpdates: true, deleteUpdates: false
    },
    member: {
        manageCompany: false, viewAnalytics: false, manageBilling: false,
        inviteUsers: false, removeUsers: false, manageRoles: false,
        createWorkspace: false, deleteWorkspace: false, manageWorkspaceMembers: false,
        createChannel: false, deleteChannel: false, manageChannelMembers: false,
        sendMessages: true, deleteMessages: false, pinMessages: false,
        createTasks: true, assignTasks: false, deleteTasks: false,
        createNotes: true, shareNotes: true,
        postUpdates: false, deleteUpdates: false
    },
    guest: {
        manageCompany: false, viewAnalytics: false, manageBilling: false,
        inviteUsers: false, removeUsers: false, manageRoles: false,
        createWorkspace: false, deleteWorkspace: false, manageWorkspaceMembers: false,
        createChannel: false, deleteChannel: false, manageChannelMembers: false,
        sendMessages: true, deleteMessages: false, pinMessages: false,
        createTasks: false, assignTasks: false, deleteTasks: false,
        createNotes: true, shareNotes: false,
        postUpdates: false, deleteUpdates: false
    }
};

const ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];

/**
 * getMatrix(companyId)
 * Returns the full role × permission matrix for a company.
 * If no custom records exist, seeds defaults and returns them.
 */
exports.getMatrix = async function (companyId) {
    const existing = await Permission.find({ company: companyId }).lean();
    const matrix = {};

    for (const role of ROLES) {
        const record = existing.find(r => r.role === role);
        matrix[role] = record ? record.permissions : DEFAULT_MATRIX[role];
    }

    return matrix;
};

/**
 * updateMatrix(companyId, updates, updatedBy)
 * Bulk-upsert permissions for one or more roles.
 * @param updates - { owner: { sendMessages: true, ... }, member: { ... }, ... }
 */
exports.updateMatrix = async function (companyId, updates, updatedBy) {
    const ops = [];

    for (const [role, perms] of Object.entries(updates)) {
        if (!ROLES.includes(role)) continue;

        ops.push(
            Permission.findOneAndUpdate(
                { company: companyId, role },
                {
                    $set: {
                        permissions: perms,
                        updatedBy,
                        updatedAt: new Date()
                    },
                    $setOnInsert: { company: companyId, role }
                },
                { upsert: true, new: true, runValidators: true }
            )
        );
    }

    await Promise.all(ops);
    return exports.getMatrix(companyId);
};

/**
 * seedDefaults(companyId, createdBy)
 * Seeds all 5 roles with default permissions (idempotent).
 */
exports.seedDefaults = async function (companyId, createdBy) {
    for (const role of ROLES) {
        const exists = await Permission.exists({ company: companyId, role });
        if (!exists) {
            await Permission.create({
                company: companyId,
                role,
                permissions: DEFAULT_MATRIX[role]
            });
        }
    }
};
