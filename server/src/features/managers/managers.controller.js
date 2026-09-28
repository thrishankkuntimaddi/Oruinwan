const logger = require('../../../utils/logger');
const mongoose = require('mongoose');
const User = require("../../../models/User");
const Workspace = require("../../../models/Workspace");
const Department = require("../../../models/Department");
const Task = require("../../../models/Task");
const Channel = require("../channels/channel.model.js");

/*
 * Every handler runs after requireAuth + requireCompanyMember + a manager-or-
 * above gate (see managers.routes.js), so req.companyId / req.companyRole are
 * set from the database. Plain managers are limited to the departments they
 * manage (and workspaces they administer); owners, admins and co-owners see
 * their whole company. Nothing ever crosses into another company.
 */

const isValidId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);
const isCompanyAdmin = (req) => req.companyRole === 'owner' || req.companyRole === 'admin';
const managedIds = (req) => ((req.user && req.user._dbUser && req.user._dbUser.managedDepartments) || []).map(String);

const deny = (status, message) => Object.assign(new Error(message), { status });

/** Department in the caller's company that the caller may manage. */
async function scopedDepartment(req, departmentId) {
    if (!isValidId(String(departmentId || ''))) throw deny(400, 'Invalid department id');
    const dept = await Department.findOne({ _id: departmentId, company: req.companyId });
    if (!dept) throw deny(404, 'Department not found');
    if (!isCompanyAdmin(req) && !managedIds(req).includes(String(dept._id))) {
        throw deny(403, "You don't manage this department");
    }
    return dept;
}

/** Workspace in the caller's company that the caller may manage. */
async function scopedWorkspace(req, workspaceId) {
    if (!isValidId(String(workspaceId || ''))) throw deny(400, 'Invalid workspace id');
    const ws = await Workspace.findOne({ _id: workspaceId, company: req.companyId });
    if (!ws) throw deny(404, 'Workspace not found');
    if (isCompanyAdmin(req)) return ws;
    const me = String(req.user.sub);
    const isWsAdmin = (ws.members || []).some((m) => String(m.user) === me && (m.role === 'owner' || m.role === 'admin'));
    const inManagedDept = ws.department && managedIds(req).includes(String(ws.department));
    if (!isWsAdmin && !inManagedDept) throw deny(403, "You don't manage this workspace");
    return ws;
}

/** Keeps only user ids that belong to the caller's company. */
async function companyUserIds(req, ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String);
    if (list.some((id) => !isValidId(id))) throw deny(400, 'Invalid user id');
    if (list.length === 0) return [];
    const found = await User.find({ _id: { $in: list }, companyId: req.companyId }).select('_id').lean();
    if (found.length !== new Set(list).size) throw deny(403, 'One or more users are not in your company');
    return found.map((u) => u._id);
}

function fail(res, error, label) {
    if (error.status && error.status < 500) return res.status(error.status).json({ message: error.message });
    logger.error(label, error);
    return res.status(500).json({ message: 'Server error' });
}

exports.getManagerScope = async (req, res) => {
    try {
        const user = await User.findById(req.user.sub)
            .populate({ path: 'managedDepartments', select: 'name description members company', match: { company: req.companyId } })
            .populate('workspaces.workspace', 'name description members company')
            .lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const managedDepts = (user.managedDepartments || []).filter(Boolean);

        const managedWorkspaces = (user.workspaces || [])
            .filter(w => (w.role === 'owner' || w.role === 'admin') && w.workspace && String(w.workspace.company) === String(req.companyId))
            .map(w => w.workspace);

        let companyContact = null;
        const Company = require('../../../models/Company');
        const company = await Company.findById(req.companyId)
            .populate('admins.user', 'username email profilePicture')
            .lean();
        if (company && company.admins && company.admins.length > 0) {
            const admin = company.admins.find(a => a.role === 'owner') || company.admins[0];
            if (admin && admin.user) companyContact = admin.user;
        }

        const chatWorkspaceId = user.workspaces?.[0]?.workspace?._id || null;

        res.json({
            departments: managedDepts,
            workspaces: managedWorkspaces,
            companyContact,
            chatWorkspaceId
        });
    } catch (error) {
        return fail(res, error, 'GET MANAGER SCOPE ERROR:');
    }
};

/** Member ids for a department or workspace scope, after the access checks. */
async function scopeMembers(req, scopeType, scopeId) {
    if (scopeType === 'department') {
        const dept = await scopedDepartment(req, scopeId);
        return { memberIds: dept.members || [], workspaceId: null };
    }
    if (scopeType === 'workspace') {
        const ws = await scopedWorkspace(req, scopeId);
        return { memberIds: (ws.members || []).map(m => m.user), workspaceId: ws._id };
    }
    throw deny(400, 'Invalid scope: scopeType must be "department" or "workspace"');
}

exports.getManagerMetrics = async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;
        const { memberIds, workspaceId } = await scopeMembers(req, scopeType, scopeId);

        const activeUsers = await User.countDocuments({
            _id: { $in: memberIds },
            companyId: req.companyId,
            $or: [
                { isOnline: true },
                { lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
            ]
        });

        const taskQuery = { status: { $in: ['todo', 'in_progress', 'review', 'blocked'] }, deleted: { $ne: true }, visibility: { $ne: 'private' } };
        if (workspaceId) taskQuery.workspace = workspaceId;
        else taskQuery.assignedTo = { $in: memberIds };

        const [openTasks, overdueTasks] = await Promise.all([
            Task.countDocuments(taskQuery),
            Task.countDocuments({ ...taskQuery, dueDate: { $lt: new Date() } }),
        ]);

        res.json({ teamSize: memberIds.length, activeUsers, openTasks, overdueTasks });
    } catch (error) {
        return fail(res, error, 'GET MANAGER METRICS ERROR:');
    }
};

exports.getManagerTasks = async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;
        // Never an unscoped query: a scope is required.
        const { memberIds, workspaceId } = await scopeMembers(req, scopeType, scopeId);
        const query = { deleted: { $ne: true }, visibility: { $ne: 'private' } };
        if (workspaceId) query.workspace = workspaceId;
        else query.assignedTo = { $in: memberIds };

        const tasks = await Task.find(query)
            .populate('assignedTo', 'username profilePicture')
            .populate('createdBy', 'username')
            .sort({ dueDate: 1, priority: -1 })
            .limit(50);

        res.json(tasks);
    } catch (error) {
        return fail(res, error, 'GET MANAGER TASKS ERROR:');
    }
};

exports.getActivitySummary = async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;
        if (scopeType !== 'workspace') {
            if (scopeType === 'department') await scopedDepartment(req, scopeId);
            return res.json({ activeChannels: 0, inactiveChannels: 0 });
        }
        const ws = await scopedWorkspace(req, scopeId);
        const channels = await Channel.find({ workspace: ws._id }).select('_id').lean();
        res.json({ activeChannels: channels.length, totalChannels: channels.length });
    } catch (error) {
        return fail(res, error, 'GET ACTIVITY ERROR:');
    }
};

exports.getAllocations = async (req, res) => {
    try {
        const user = await User.findById(req.user.sub)
            .populate({
                path: 'managedDepartments',
                match: { company: req.companyId },
                populate: { path: 'members', select: 'username email profilePicture isOnline companyId' }
            })
            .populate({ path: 'workspaces.workspace', select: 'name members company' });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const members = [];
        const seen = new Set();
        (user.managedDepartments || []).filter(Boolean).forEach(dept => {
            (dept.members || []).forEach(m => {
                if (!m || String(m.companyId) !== String(req.companyId) || seen.has(String(m._id))) return;
                seen.add(String(m._id));
                members.push({ _id: m._id, username: m.username, email: m.email, profilePicture: m.profilePicture, isOnline: m.isOnline, department: dept.name });
            });
        });

        const managedWorkspaces = (user.workspaces || [])
            .filter(w => (w.role === 'owner' || w.role === 'admin') && w.workspace && String(w.workspace.company) === String(req.companyId))
            .map(w => w.workspace);

        const allocationMatrix = {};
        members.forEach(m => {
            allocationMatrix[m._id] = managedWorkspaces
                .filter(ws => (ws.members || []).some(wm => String(wm.user) === String(m._id)))
                .map(ws => ws._id);
        });

        res.json({
            members,
            workspaces: managedWorkspaces.map(w => ({ _id: w._id, name: w.name })),
            allocations: allocationMatrix
        });
    } catch (error) {
        return fail(res, error, 'GET ALLOCATIONS ERROR:');
    }
};

exports.updateWorkspaceAllocation = async (req, res) => {
    try {
        const { userId, workspaceId, action } = req.body;
        if (!['add', 'remove'].includes(action)) return res.status(400).json({ message: 'action must be "add" or "remove"' });

        const workspace = await scopedWorkspace(req, workspaceId);
        const [targetId] = await companyUserIds(req, [userId]);

        if (action === 'add') {
            if (workspace.members.some(m => String(m.user) === String(targetId))) {
                return res.json({ message: "Already a member" });
            }
            workspace.members.push({ user: targetId, role: 'member', joinedAt: new Date() });
            await User.findByIdAndUpdate(targetId, { $push: { workspaces: { workspace: workspace._id, role: 'member' } } });
        } else {
            workspace.members = workspace.members.filter(m => String(m.user) !== String(targetId));
            await User.findByIdAndUpdate(targetId, { $pull: { workspaces: { workspace: workspace._id } } });
        }

        await workspace.save();
        res.json({ success: true, message: `User ${action === 'add' ? 'added' : 'removed'} successfully` });
    } catch (error) {
        return fail(res, error, 'UPDATE ALLOCATION ERROR:');
    }
};

exports.addMemberToDepartment = async (req, res) => {
    try {
        const { email, departmentId } = req.body;
        if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Email is required' });
        const dept = await scopedDepartment(req, departmentId);

        // Only people already in this company can be added.
        const userToAdd = await User.findOne({ email: email.toLowerCase().trim(), companyId: req.companyId });
        if (!userToAdd) return res.status(404).json({ message: "No one in your company has that email" });

        await Department.findByIdAndUpdate(dept._id, { $addToSet: { members: userToAdd._id } });
        userToAdd.departments.addToSet(dept._id);
        await userToAdd.save();

        res.json({
            success: true,
            user: { _id: userToAdd._id, username: userToAdd.username, email: userToAdd.email, profilePicture: userToAdd.profilePicture },
        });
    } catch (error) {
        return fail(res, error, 'ADD TO DEPT ERROR:');
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, priority, dueDate, assignedTo, workspaceId } = req.body;
        if (!title || typeof title !== 'string') return res.status(400).json({ message: 'Title is required' });

        const workspace = await scopedWorkspace(req, workspaceId);
        const assignees = await companyUserIds(req, assignedTo || []);

        const task = new Task({
            title,
            description,
            priority,
            dueDate,
            assignedTo: assignees,
            workspace: workspace._id,
            createdBy: req.user.sub,
            visibility: 'workspace',
            status: 'todo'
        });

        await task.save();
        await task.populate('assignedTo', 'username profilePicture');

        res.status(201).json(task);
    } catch (error) {
        return fail(res, error, 'CREATE MANAGER TASK ERROR:');
    }
};

// Exposed for tests.
exports._scopedDepartment = scopedDepartment;
exports._scopedWorkspace = scopedWorkspace;
