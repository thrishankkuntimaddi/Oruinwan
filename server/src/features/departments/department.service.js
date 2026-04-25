const Department = require('../../../models/Department');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Channel = require('../channels/channel.model.js');

async function getDepartments(companyId) {
    const depts = await Department.find({ company: companyId, isActive: true })
        .populate('head', 'username email profilePicture')
        .populate('managers', 'username email profilePicture')
        .populate({
            path: 'members',
            select: 'username email profilePicture companyRole accountStatus',
            match: { accountStatus: { $ne: 'removed' } },
        })
        .populate('workspaces', 'name description type')
        .sort({ name: 1 })
        .lean();

    
    return depts.map(d => ({
        ...d,
        members: (d.members || []).filter(Boolean),
    }));
}

async function getDepartmentById(departmentId, companyId) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId, isActive: true })
        .populate('head', 'username email profilePicture')
        .populate('managers', 'username email profilePicture companyRole')
        .populate({
            path: 'members',
            select: 'username email profilePicture companyRole departments accountStatus',
            match: { accountStatus: { $ne: 'removed' } },
        })
        .populate('workspaces', 'name description type')
        .lean();

    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }

    
    dept.members = (dept.members || []).filter(Boolean);
    return dept;
}

async function createDepartment({ companyId, name, description, head, parentDepartment, creatorId }) {
    
    const existing = await Department.findOne({ company: companyId, name: new RegExp(`^${name.trim()}$`, 'i'), isActive: true });
    if (existing) {
        const err = new Error(`A department named "${name}" already exists.`);
        err.status = 409;
        throw err;
    }

    
    const department = await Department.create({
        company: companyId,
        name: name.trim(),
        description: description || '',
        head: head || null,
        parentDepartment: parentDepartment || null,
        members: head ? [head] : [],
    });

    
    const workspaceMembers = [];
    if (head) {
        workspaceMembers.push({ user: head, role: 'owner' });
        
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

    
    workspace.defaultChannels = createdChannelIds;
    await workspace.save();

    
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

    
    department.workspaces.push(workspace._id);
    department.defaultWorkspaceId = workspace._id; 
    await department.save();

    return Department.findById(department._id)
        .populate('head', 'username email profilePicture')
        .populate('members', 'username email profilePicture')
        .populate('defaultWorkspaceId', 'name type')
        .lean();
}

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

async function deleteDepartment(departmentId, companyId) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId });
    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }

    
    dept.isActive = false;
    await dept.save();

    
    await Promise.all([
        User.updateMany({ departments: departmentId }, { $pull: { departments: departmentId } }),
        User.updateMany({ managedDepartments: departmentId }, { $pull: { managedDepartments: departmentId } }),
    ]);

    return { deleted: true, departmentId };
}

async function assignMembers(departmentId, companyId, userIds, action) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId, isActive: true });
    if (!dept) {
        const err = new Error('Department not found.');
        err.status = 404;
        throw err;
    }

    
    const users = await User.find({ _id: { $in: userIds }, companyId }).select('_id').lean();
    if (users.length !== userIds.length) {
        const err = new Error('One or more users not found or do not belong to this company.');
        err.status = 400;
        throw err;
    }

    if (action === 'add') {
        
        await Department.findByIdAndUpdate(departmentId, {
            $addToSet: { members: { $each: userIds } },
        });
        
        await User.updateMany(
            { _id: { $in: userIds } },
            { $addToSet: { departments: departmentId } }
        );

        
        
        
        if (dept.defaultWorkspaceId) {
            const now = new Date();

            
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
        
        await Department.findByIdAndUpdate(departmentId, {
            $pull: { members: { $in: userIds } },
        });
        
        await User.updateMany(
            { _id: { $in: userIds } },
            { $pull: { departments: departmentId } }
        );
        
        
        
    }

    return Department.findById(departmentId)
        .populate('members', 'username email profilePicture companyRole')
        .populate('defaultWorkspaceId', 'name type')
        .lean();
}

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

module.exports = {
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    assignMembers,
    setDefaultWorkspace,
};
