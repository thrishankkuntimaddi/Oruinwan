const logger = require('../../../utils/logger');
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');
const Channel = require('../channels/channel.model.js');

const USER_BASIC = { type: 'user', fields: ['username', 'email', 'profilePicture'] };
const USER_ROLE = { type: 'user', fields: ['username', 'email', 'profilePicture', 'companyRole'] };
const WS_LIST = { type: 'workspace', fields: ['name', 'description', 'type'] };
const WS_REF = { type: 'workspace', fields: ['name', 'type'] };

function notFound() {
    const err = new Error('Department not found.');
    err.status = 404;
    return err;
}

/** Department members that are not removed, with the requested fields (and the user's departments if asked). */
async function liveMembers(memberIds, fields, { withDepartments = false } = {}) {
    if (!memberIds.length) return [];
    const list = await org.users.find({ _id: { $in: memberIds }, accountStatus: { $ne: 'removed' } }, { org: withDepartments });
    const byId = new Map(list.map((u) => [String(u._id), u]));
    return memberIds.map((id) => byId.get(String(id))).filter(Boolean).map((u) => org.project(u, fields.join(' ')));
}

async function present(dept, { memberFields, managerSelector = USER_BASIC, withDepartments = false } = {}) {
    const memberIds = dept.members || [];
    await hydrate(dept, { head: USER_BASIC, managers: managerSelector, workspaces: WS_LIST });
    dept.members = await liveMembers(memberIds, memberFields, { withDepartments });
    return dept;
}

async function getDepartments(companyId) {
    const depts = await org.departments.find({ company: companyId, isActive: true }, { sort: { name: 1 } });
    return Promise.all(depts.map((d) => present(d, { memberFields: ['username', 'email', 'profilePicture', 'companyRole', 'accountStatus'] })));
}

async function getDepartmentById(departmentId, companyId) {
    const dept = await org.departments.findOne({ _id: departmentId, company: companyId, isActive: true });
    if (!dept) throw notFound();
    return present(dept, {
        memberFields: ['username', 'email', 'profilePicture', 'companyRole', 'departments', 'accountStatus'],
        managerSelector: USER_ROLE,
        withDepartments: true,
    });
}

async function loadForResponse(departmentId, { memberSelector = USER_BASIC } = {}) {
    const dept = await identity.departments.findById(departmentId);
    if (!dept) return null;
    await hydrate(dept, { head: USER_BASIC, members: memberSelector, defaultWorkspaceId: WS_REF });
    return dept;
}

async function createDepartment({ companyId, name, description, head, parentDepartment, creatorId }) {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await org.departments.findOne({ company: companyId, name: new RegExp(`^${escaped}$`, 'i'), isActive: true }, { members: false });
    if (existing) {
        const err = new Error(`A department named "${name}" already exists.`);
        err.status = 409;
        throw err;
    }

    const department = await identity.departments.create({
        company: String(companyId),
        name: name.trim(),
        description: description || '',
        head: head ? String(head) : null,
        parentDepartment: parentDepartment ? String(parentDepartment) : null,
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

    const workspace = await identity.workspaces.create({
        company: String(companyId),
        name,
        description: `${name} Team Workspace`,
        type: 'department',
        department: department._id,
        createdBy: String(head || creatorId),
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

    await identity.workspaces.update(workspace._id, { defaultChannels: createdChannelIds.map(String) });

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
            logger.error(`[DEPT SERVICE] Failed to bootstrap key for channel ${chanId}:`, keyError.message);
            throw new Error('Failed to initialize channel encryption.');
        }
    }

    await org.addDepartmentWorkspace(department._id, workspace._id, { setDefault: true });

    return loadForResponse(department._id);
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

    const current = await org.departments.findOne({ _id: departmentId, company: companyId });
    if (!current) throw notFound();

    // Head changes keep the department's managers in step with the head.
    let newHead = null;
    if (sanitized.head !== undefined) {
        if (sanitized.head) {
            newHead = await org.users.findOne({ _id: sanitized.head, companyId });
            if (!newHead) {
                const err = new Error('The department head must be a member of this company.');
                err.status = 400;
                throw err;
            }
        } else {
            sanitized.head = null;
        }
    }

    const headIsManager = newHead && newHead.companyRole === 'manager';
    if (headIsManager && Array.isArray(sanitized.managers) && !sanitized.managers.map(String).includes(String(newHead._id))) {
        sanitized.managers = [...sanitized.managers, newHead._id];
    }
    const addHead = headIsManager && !Array.isArray(sanitized.managers);

    const { managers, ...columns } = sanitized;
    if (columns.head !== undefined) columns.head = columns.head ? String(columns.head) : null;
    if (columns.parentDepartment !== undefined) columns.parentDepartment = columns.parentDepartment ? String(columns.parentDepartment) : null;
    if (Object.keys(columns).length) await identity.departments.update(departmentId, columns);
    if (Array.isArray(managers)) await org.setDepartmentManagers(departmentId, managers);
    if (addHead) await org.addDepartmentMembers(departmentId, [newHead._id], 'manager');

    // A previous head keeps the manager role only while listed in managers: an explicit
    // managers list above already replaced the set; otherwise nothing changes for them.

    const dept = await identity.departments.findById(departmentId);
    await hydrate(dept, { head: USER_BASIC, managers: USER_BASIC });
    return dept;
}

async function deleteDepartment(departmentId, companyId) {
    const dept = await org.departments.findOne({ _id: departmentId, company: companyId }, { members: false });
    if (!dept) throw notFound();

    await identity.departments.update(departmentId, { isActive: false });
    // Members and managers leave the department with it.
    await org.removeDepartmentMembers(departmentId, await org.departmentMemberIds(departmentId));

    return { deleted: true, departmentId };
}

async function assignMembers(departmentId, companyId, userIds, action) {
    const dept = await org.departments.findOne({ _id: departmentId, company: companyId, isActive: true }, { members: false });
    if (!dept) throw notFound();

    const count = await org.users.count({ _id: { $in: userIds }, companyId });
    if (count !== new Set(userIds.map(String)).size) {
        const err = new Error('One or more users not found or do not belong to this company.');
        err.status = 400;
        throw err;
    }

    if (action === 'add') {
        await org.addDepartmentMembers(departmentId, userIds, 'member');
        // New members join the department's default workspace (existing memberships are left as they are).
        if (dept.defaultWorkspaceId) {
            const ws = await identity.workspaces.findById(dept.defaultWorkspaceId);
            const already = new Set((ws?.members || []).filter((m) => m.status === 'active').map((m) => m.user));
            for (const uid of userIds) {
                if (!already.has(String(uid))) await identity.workspaces.addMember(dept.defaultWorkspaceId, uid, { role: 'member' });
            }
        }
    } else {
        await org.removeDepartmentMembers(departmentId, userIds);
    }

    return loadForResponse(departmentId, { memberSelector: USER_ROLE });
}

async function setDefaultWorkspace(departmentId, companyId, workspaceId) {
    const dept = await org.departments.findOne({ _id: departmentId, company: companyId, isActive: true }, { members: false });
    if (!dept) throw notFound();

    if (workspaceId) {
        const ws = await org.workspaces.findOne({ _id: workspaceId, company: companyId, isActive: true }, { members: false });
        if (!ws) {
            const err = new Error('Workspace not found or does not belong to this company.');
            err.status = 404;
            throw err;
        }
        await org.addDepartmentWorkspace(departmentId, workspaceId, { setDefault: true });
    } else {
        await identity.departments.update(departmentId, { defaultWorkspaceId: null });
    }

    const out = await identity.departments.findById(departmentId);
    await hydrate(out, { defaultWorkspaceId: WS_REF });
    return out;
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
