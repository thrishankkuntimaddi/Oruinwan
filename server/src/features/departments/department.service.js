// server/src/features/departments/department.service.js
//
// Phase 2 + Phase 4 — Department Management System
// Business logic layer — no HTTP references.
// Channels, Tasks, Messages, Notes, Huddles are NOT touched.

const Department = require('../../../models/Department');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Channel = require('../channels/channel.model.js');

// ============================================================================
// READ
// ============================================================================

/**
 * Get all active departments for a company.
 */
async function getDepartments(companyId) {
    return Department.find({ company: companyId, isActive: true })
        .populate('head', 'username email profilePicture')
        .populate('managers', 'username email profilePicture')
        .populate('members', 'username email profilePicture companyRole')
        .populate('workspaces', 'name description type')
        .sort({ name: 1 })
        .lean();
}

/**
 * Get a single department — enforces company isolation.
 */
async function getDepartmentById(departmentId, companyId) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId, isActive: true })
        .populate('head', 'username email profilePicture')
        .populate('managers', 'username email profilePicture companyRole')
        .populate('members', 'username email profilePicture companyRole departments')
        .populate('workspaces', 'name description type')
        .lean();

    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }
    return dept;
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a department and bootstrap its default Workspace, Channels, and
 * encryption keys (exact logic preserved from original departments.routes.js).
 */
async function createDepartment({ companyId, name, description, head, parentDepartment, creatorId }) {
    // Guard: unique name within company
    const existing = await Department.findOne({ company: companyId, name: new RegExp(`^${name.trim()}$`, 'i'), isActive: true });
    if (existing) {
        const err = new Error(`A department named "${name}" already exists.`);
        err.status = 409;
        throw err;
    }

    // 1. Create Department
    const department = await Department.create({
        company: companyId,
        name: name.trim(),
        description: description || '',
        head: head || null,
        parentDepartment: parentDepartment || null,
        members: head ? [head] : [],
    });

    // 2. Create Default Workspace for this Department
    const workspaceMembers = [];
    if (head) {
        workspaceMembers.push({ user: head, role: 'owner' });
        // If head !== creatorId, admin is also added as member
        if (String(head) !== String(creatorId)) {
            workspaceMembers.push({ user: creatorId, role: 'admin' });
        }
    } else {
        workspaceMembers.push({ user: creatorId, role: 'owner' });
    }

    const workspace = await Workspace.create({
        company: companyId,
        name,
        description: `${name} Team Workspace`,
        type: 'department',
        department: department._id,
        createdBy: head || creatorId,
        members: workspaceMembers,
        settings: { isPrivate: false, allowMemberInvite: true },
    });

    // 3. Create Default Channels (general + announcements)
    const channelNames = ['general', 'announcements'];
    const createdChannelIds = [];
    const now = new Date();

    for (const chanName of channelNames) {
        const channel = await Channel.create({
            workspace: workspace._id,
            company: companyId,
            name: chanName,
            isDefault: true,
            createdBy: head || creatorId,
            members: workspaceMembers.map(m => ({ user: m.user, joinedAt: now })),
            systemEvents: [{ type: 'channel_created', userId: head || creatorId, timestamp: now }],
        });
        createdChannelIds.push(channel._id);
    }

    // 4. Link channels → workspace
    workspace.defaultChannels = createdChannelIds;
    await workspace.save();

    // 5. Bootstrap encryption keys for default channels
    const conversationKeysService = require('../../modules/conversations/conversationKeys.service');
    const memberIds = workspaceMembers.map(m => m.user.toString());

    for (const chanId of createdChannelIds) {
        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: chanId.toString(),
                conversationType: 'channel',
                workspaceId: workspace._id.toString(),
                members: memberIds,
            });
        } catch (keyError) {
            console.error(`[DEPT SERVICE] Failed to bootstrap key for channel ${chanId}:`, keyError.message);
            throw new Error('Failed to initialize channel encryption.');
        }
    }

    // 6. Link workspace → department + set as defaultWorkspaceId
    department.workspaces.push(workspace._id);
    department.defaultWorkspaceId = workspace._id; // Phase 4: auto-membership hook
    await department.save();

    return Department.findById(department._id)
        .populate('head', 'username email profilePicture')
        .populate('members', 'username email profilePicture')
        .populate('defaultWorkspaceId', 'name type')
        .lean();
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * PATCH department — company-isolated. Only allowed fields updated.
 */
async function updateDepartment(departmentId, companyId, updates) {
    const allowed = ['name', 'description', 'head', 'managers', 'parentDepartment', 'isActive'];
    const sanitized = {};
    for (const key of allowed) {
        if (updates[key] !== undefined) sanitized[key] = updates[key];
    }

    if (Object.keys(sanitized).length === 0) {
        const err = new Error('No valid fields to update.');
        err.status = 400;
        throw err;
    }

    const dept = await Department.findOneAndUpdate(
        { _id: departmentId, company: companyId },
        { $set: sanitized },
        { new: true, runValidators: true }
    )
        .populate('head', 'username email profilePicture')
        .populate('managers', 'username email profilePicture')
        .lean();

    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }

    return dept;
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Soft-delete a department and clean up User.departments[] and
 * User.managedDepartments[] references bidirectionally.
 */
async function deleteDepartment(departmentId, companyId) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId });
    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }

    // Soft delete
    dept.isActive = false;
    await dept.save();

    // Cleanup: remove reference from all users
    await Promise.all([
        User.updateMany({ departments: departmentId }, { $pull: { departments: departmentId } }),
        User.updateMany({ managedDepartments: departmentId }, { $pull: { managedDepartments: departmentId } }),
    ]);

    return { deleted: true, departmentId };
}

// ============================================================================
// MEMBER ASSIGNMENT
// ============================================================================

/**
 * Bulk add or remove members from a department.
 * Bidirectionally syncs User.departments[].
 *
 * @param {string}   departmentId
 * @param {string}   companyId
 * @param {string[]} userIds      - Array of User ObjectId strings
 * @param {'add'|'remove'} action
 */
async function assignMembers(departmentId, companyId, userIds, action) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId, isActive: true });
    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }

    // Verify all users belong to this company
    const users = await User.find({ _id: { $in: userIds }, companyId }).select('_id').lean();
    if (users.length !== userIds.length) {
        const err = new Error('One or more users not found or do not belong to this company.');
        err.status = 400;
        throw err;
    }

    if (action === 'add') {
        // Add to department.members (deduplicated)
        await Department.findByIdAndUpdate(departmentId, {
            $addToSet: { members: { $each: userIds } },
        });
        // Sync: add departmentId to each user's departments[]
        await User.updateMany(
            { _id: { $in: userIds } },
            { $addToSet: { departments: departmentId } }
        );

        // Phase 4 — Hybrid Workspace Assignment:
        // Auto-join each user to the department's defaultWorkspace.
        // Uses $addToSet so existing members are not duplicated.
        if (dept.defaultWorkspaceId) {
            const now = new Date();

            // Add each user to Workspace.members[] if not already present
            for (const uid of userIds) {
                await Workspace.findByIdAndUpdate(
                    dept.defaultWorkspaceId,
                    {
                        $addToSet: {
                            members: { user: uid, role: 'member', status: 'active', joinedAt: now },
                        },
                    }
                );
            }

            // Sync: add workspace entry to each User.workspaces[] if not already present
            for (const uid of userIds) {
                const alreadyMember = await User.exists({
                    _id: uid,
                    'workspaces.workspace': dept.defaultWorkspaceId,
                });
                if (!alreadyMember) {
                    await User.findByIdAndUpdate(uid, {
                        $push: {
                            workspaces: {
                                workspace: dept.defaultWorkspaceId,
                                role: 'member',
                                joinedAt: now,
                            },
                        },
                    });
                }
            }
        }
    } else {
        // Remove from department.members
        await Department.findByIdAndUpdate(departmentId, {
            $pull: { members: { $in: userIds } },
        });
        // Sync: remove departmentId from each user's departments[]
        await User.updateMany(
            { _id: { $in: userIds } },
            { $pull: { departments: departmentId } }
        );
        // Phase 4 NOTE: workspace membership is NOT auto-removed on department removal.
        // Per spec: "Users can still be invited to additional workspaces manually."
        // Workspace membership must be managed explicitly via workspace APIs.
    }

    return Department.findById(departmentId)
        .populate('members', 'username email profilePicture companyRole')
        .populate('defaultWorkspaceId', 'name type')
        .lean();
}

// ============================================================================
// SET DEFAULT WORKSPACE (Phase 4)
// ============================================================================

/**
 * Change or clear the defaultWorkspaceId for a department.
 * The new workspace must belong to the same company.
 * Allows admin to re-point auto-membership to a different workspace.
 *
 * @param {string}      departmentId
 * @param {string}      companyId
 * @param {string|null} workspaceId  - pass null to clear
 */
async function setDefaultWorkspace(departmentId, companyId, workspaceId) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId, isActive: true });
    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }

    if (workspaceId) {
        const ws = await Workspace.findOne({ _id: workspaceId, company: companyId, isActive: true });
        if (!ws) {
            const err = new Error('Workspace not found or does not belong to this company.');
            err.status = 404;
            throw err;
        }
        // Ensure workspace is in the department's workspaces list
        if (!dept.workspaces.map(w => w.toString()).includes(workspaceId.toString())) {
            dept.workspaces.push(workspaceId);
        }
    }

    dept.defaultWorkspaceId = workspaceId || null;
    await dept.save();

    return Department.findById(departmentId)
        .populate('defaultWorkspaceId', 'name type')
        .lean();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    assignMembers,
    setDefaultWorkspace,
};
