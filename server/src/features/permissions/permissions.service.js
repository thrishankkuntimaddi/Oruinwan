'use strict';

const { rolePermissions } = require('../../identity');

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

exports.getMatrix = async function (companyId) {
    const existing = await rolePermissions.listForCompany(companyId);
    const matrix = {};

    for (const role of ROLES) {
        const record = existing.find(r => r.role === role);
        matrix[role] = record ? record.permissions : DEFAULT_MATRIX[role];
    }

    return matrix;
};

exports.updateMatrix = async function (companyId, updates, updatedBy) {
    const ops = [];

    for (const [role, perms] of Object.entries(updates)) {
        if (!ROLES.includes(role)) continue;

        // Upsert per role; who changed it is in the audit log (recordAdminAction).
        void updatedBy;
        ops.push(rolePermissions.set(companyId, role, { permissions: perms }));
    }

    await Promise.all(ops);
    return exports.getMatrix(companyId);
};

exports.seedDefaults = async function (companyId, _createdBy) {
    const existing = new Set((await rolePermissions.listForCompany(companyId)).map((r) => r.role));
    for (const role of ROLES) {
        if (!existing.has(role)) await rolePermissions.set(companyId, role, { permissions: DEFAULT_MATRIX[role] });
    }
};
