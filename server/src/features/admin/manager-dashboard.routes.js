const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../../models/User');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const Message = require("../../modules/messages/message.model.js");
const Task = require('../../../models/Task');
const requireAuth = require('../../shared/middleware/auth');
const { requireManager } = require('../../shared/middleware/permissionMiddleware');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(String(id));

router.get('/my-workspaces', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId).select('workspaces companyId').lean();

        
        const workspaceIds = (user.workspaces || []).map(w => w.workspace);

        const workspaces = await Workspace.find({ _id: { $in: workspaceIds }, company: user.companyId })
            .populate('members.user', 'username email profilePicture')
            .lean();

        
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const workspace of workspaces) {
            const live = { workspace: workspace._id, deleted: { $ne: true } };
            const [messageCount, taskCount, activeTaskCount, completedTaskCount] = await Promise.all([
                Message.countDocuments({
                    workspace: workspace._id,
                    createdAt: { $gte: sevenDaysAgo }
                }),
                Task.countDocuments(live),
                Task.countDocuments({ ...live, status: { $in: ['todo', 'in_progress', 'review', 'blocked'] } }),
                Task.countDocuments({ ...live, status: 'done' })
            ]);

            workspace.memberCount = workspace.members.length;
            workspace.status = workspace.isArchived ? 'archived' : 'active';
            workspace.activity = {
                messages: messageCount,
                tasksTotal: taskCount,
                tasksActive: activeTaskCount,
                tasksCompleted: completedTaskCount
            };
        }

        res.json({ workspaces });
    } catch (error) {
        logger.error('Manager Dashboard My Workspaces Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/team-load', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId).select('companyId workspaces').lean();
        const companyId = user.companyId;

        
        const workspaceIds = (user.workspaces || []).map(w => w.workspace);

        
        const workspaceDocs = await Workspace.find({ _id: { $in: workspaceIds }, company: companyId }).select('members');
        const teamMemberIds = new Set();
        workspaceDocs.forEach(ws => {
            ws.members.forEach(m => teamMemberIds.add(m.user.toString()));
        });

        
        const teamMembers = await User.find({
            _id: { $in: Array.from(teamMemberIds) },
            companyId,
            accountStatus: { $ne: 'removed' },
        })
            .select('username email profilePicture companyRole jobTitle isOnline')
            .lean();

        
        for (const member of teamMembers) {
            const [workspaces, activeTasks] = await Promise.all([
                Workspace.find({ 'members.user': member._id, company: companyId }).select('name'),
                Task.countDocuments({
                    assignedTo: member._id,
                    status: { $in: ['todo', 'in_progress', 'review', 'blocked'] },
                    deleted: { $ne: true }
                })
            ]);

            member.workspaces = workspaces.map(ws => ws.name);
            member.activeTasks = activeTasks;
            member.workload = activeTasks > 10 ? 'high' : activeTasks > 5 ? 'medium' : 'low';
        }

        const overloaded = teamMembers.filter(m => m.workload === 'high');
        const idle = teamMembers.filter(m => m.activeTasks === 0);

        res.json({ teamMembers, overloaded, idle });
    } catch (error) {
        logger.error('Manager Dashboard Team Load Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/unassigned-employees', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);

        
        const managedDepts = user.managedDepartments || [];

        
        const managerWorkspaces = await Workspace.find({
            company: user.companyId,
            $or: [
                { 'members': { $elemMatch: { user: userId, role: 'owner' } } },
                { 'members': { $elemMatch: { user: userId, role: 'admin' } } }
            ]
        });

        const workspaceMemberIds = new Set();
        managerWorkspaces.forEach(ws => {
            ws.members.forEach(m => workspaceMemberIds.add(m.user.toString()));
        });

        
        const unassigned = await User.find({
            companyId: user.companyId,
            departments: { $in: managedDepts },
            _id: { $nin: Array.from(workspaceMemberIds) },
            accountStatus: 'active'
        })
            .populate('departments', 'name')
            .select('username email profilePicture departments createdAt')
            .lean();

        res.json({ unassigned });
    } catch (error) {
        logger.error('Manager Dashboard Unassigned Employees Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Department guard for the /dashboard/* routes: the department must be in the
 * caller's company; plain managers must manage it (managedDepartments, the
 * department's managers list or its head). Sends 400/403/404 and returns null
 * when refused, else { ctx, dept }.
 */
async function _departmentGuard(req, res) {
    const { departmentId } = req.params;
    if (!isValidObjectId(departmentId)) {
        res.status(400).json({ success: false, message: 'Invalid department ID' });
        return null;
    }
    const ctx = await _managerContext(req);
    if (!ctx) {
        res.status(401).json({ success: false, message: 'User not found' });
        return null;
    }
    const { dept, allowed } = await _managesDepartment(ctx, departmentId);
    if (!dept || (ctx.manager.companyId && String(dept.company) !== String(ctx.manager.companyId))) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return null;
    }
    if (!allowed) {
        res.status(403).json({ success: false, message: 'Access denied: You do not manage this department' });
        return null;
    }
    return { ctx, dept };
}

const OPEN_STATUSES = ['todo', 'in_progress', 'review', 'blocked'];

router.get('/dashboard/metrics/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const guard = await _departmentGuard(req, res);
        if (!guard) return;
        const { departmentId } = req.params;
        const companyId = guard.ctx.manager.companyId;

        const dept = await Department.findById(departmentId).populate('head', 'username email').lean();
        const inDept = { departments: departmentId, companyId };

        const [totalMembers, activeMembers, pendingMembers, managers] = await Promise.all([
            User.countDocuments(inDept),
            User.countDocuments({ ...inDept, accountStatus: 'active' }),
            User.countDocuments({ ...inDept, accountStatus: { $in: ['pending', 'invited'] } }),
            User.countDocuments({ ...inDept, companyRole: 'manager' })
        ]);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const memberIds = (await User.find(inDept).select('_id').lean()).map(m => m._id);

        const [messagesThisWeek, tasksCompletedThisWeek, openTasks, overdueTasks] = await Promise.all([
            Message.countDocuments({ sender: { $in: memberIds }, createdAt: { $gte: sevenDaysAgo } }),
            Task.countDocuments({ assignedTo: { $in: memberIds }, status: 'done', deleted: { $ne: true }, updatedAt: { $gte: sevenDaysAgo } }),
            Task.countDocuments({ assignedTo: { $in: memberIds }, status: { $in: OPEN_STATUSES }, deleted: { $ne: true } }),
            Task.countDocuments({ assignedTo: { $in: memberIds }, status: { $in: OPEN_STATUSES }, deleted: { $ne: true }, dueDate: { $lt: new Date() } }),
        ]);

        res.json({
            team: { total: totalMembers, active: activeMembers, pending: pendingMembers, managers },
            activity: { messagesThisWeek, tasksThisWeek: tasksCompletedThisWeek, openTasks, overdueTasks },
            department: { _id: dept._id, name: dept.name, description: dept.description, head: dept.head, createdAt: dept.createdAt }
        });
    } catch (error) {
        logger.error('Manager Dashboard Metrics Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/dashboard/team-load/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const guard = await _departmentGuard(req, res);
        if (!guard) return;
        const { departmentId } = req.params;
        const companyId = guard.ctx.manager.companyId;

        const teamMembers = await User.find({ departments: departmentId, companyId, accountStatus: 'active' })
            .select('username email profilePicture jobTitle')
            .lean();

        for (const member of teamMembers) {
            const [workspaces, activeTasks] = await Promise.all([
                Workspace.find({ 'members.user': member._id, company: companyId }).select('name'),
                Task.countDocuments({ assignedTo: member._id, status: { $in: OPEN_STATUSES }, deleted: { $ne: true } })
            ]);
            member.workspaces = workspaces.map(ws => ws.name);
            member.activeTasks = activeTasks;
            member.workload = activeTasks > 10 ? 'high' : activeTasks > 5 ? 'medium' : 'low';
        }

        res.json({
            teamMembers,
            overloaded: teamMembers.filter(m => m.workload === 'high'),
            idle: teamMembers.filter(m => m.activeTasks === 0)
        });
    } catch (error) {
        logger.error('Manager Dashboard Team Load Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/dashboard/unassigned/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const guard = await _departmentGuard(req, res);
        if (!guard) return;
        const { departmentId } = req.params;
        const companyId = guard.ctx.manager.companyId;

        // "Unassigned" = in the department but in none of the company's workspaces.
        const workspaces = await Workspace.find({ company: companyId }).select('members').lean();
        const workspaceMemberIds = new Set();
        workspaces.forEach(ws => (ws.members || []).forEach(m => workspaceMemberIds.add(String(m.user))));

        const unassigned = await User.find({
            departments: departmentId,
            companyId,
            _id: { $nin: Array.from(workspaceMemberIds) },
            accountStatus: 'active'
        })
            .populate('departments', 'name')
            .select('username email profilePicture departments createdAt')
            .lean();

        res.json({ unassigned });
    } catch (error) {
        logger.error('Manager Dashboard Unassigned Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/dashboard/reports/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const guard = await _departmentGuard(req, res);
        if (!guard) return;
        const { departmentId } = req.params;
        const companyId = guard.ctx.manager.companyId;

        const members = await User.find({ departments: departmentId, companyId }).select('_id username').lean();
        const memberIds = members.map(m => m._id);
        const base = { assignedTo: { $in: memberIds }, deleted: { $ne: true } };

        const [totalTasks, completedTasks, inProgressTasks, doneWithTimes, perMember] = await Promise.all([
            Task.countDocuments(base),
            Task.countDocuments({ ...base, status: 'done' }),
            Task.countDocuments({ ...base, status: 'in_progress' }),
            Task.find({ ...base, status: 'done', completedAt: { $ne: null } }).select('createdAt completedAt').limit(500).lean(),
            Task.aggregate([
                { $match: { assignedTo: { $in: memberIds }, deleted: { $ne: true } } },
                { $unwind: '$assignedTo' },
                { $match: { assignedTo: { $in: memberIds } } },
                { $group: { _id: '$assignedTo', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
            ]),
        ]);

        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        // Average days from creation to completion; null when nothing has completed.
        const avgTime = doneWithTimes.length
            ? Math.round((doneWithTimes.reduce((sum, t) => sum + (new Date(t.completedAt) - new Date(t.createdAt)), 0) / doneWithTimes.length / 86400000) * 10) / 10
            : null;

        const names = new Map(members.map(m => [String(m._id), m.username]));
        const teamWorkload = perMember.map(r => ({ userId: r._id, username: names.get(String(r._id)) || 'Unknown', total: r.total, done: r.done }));

        res.json({
            completionRate,
            completed: completedTasks,
            inProgress: inProgressTasks,
            total: totalTasks,
            avgTime,
            taskVolumeOverTime: [],
            teamWorkload
        });
    } catch (error) {
        logger.error('Manager Dashboard Reports Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Manager task scope ──────────────────────────────────────────────────────
// A manager sees tasks created by or assigned to members of the departments
// they manage (company owners/admins: any department of their company), minus
// private tasks they are not party to.
const COMPANY_WIDE_ROLES = ['owner', 'admin'];

async function _managerContext(req) {
    const userId = String(req.user.sub || req.user._id);
    const manager = await User.findById(userId).select('companyId companyRole managedDepartments coOwnerOf').lean();
    if (!manager) return null;
    const companyWide = COMPANY_WIDE_ROLES.includes(manager.companyRole) ||
        (manager.coOwnerOf && manager.companyId && String(manager.coOwnerOf) === String(manager.companyId));
    return { userId, manager, companyWide };
}

async function _managesDepartment(ctx, departmentId) {
    const dept = await Department.findById(departmentId).select('company head managers').lean();
    if (!dept) return { dept: null, allowed: false };
    if (!ctx.manager.companyId || String(dept.company) !== String(ctx.manager.companyId)) return { dept, allowed: false };
    if (ctx.companyWide) return { dept, allowed: true };
    const allowed = (ctx.manager.managedDepartments || []).map(String).includes(String(departmentId)) ||
        (dept.managers || []).map(String).includes(ctx.userId) ||
        (dept.head && String(dept.head) === ctx.userId);
    return { dept, allowed };
}

async function _managedDepartmentIds(ctx) {
    if (!ctx.manager.companyId) return [];
    const query = ctx.companyWide
        ? { company: ctx.manager.companyId }
        : {
            company: ctx.manager.companyId,
            $or: [
                { _id: { $in: ctx.manager.managedDepartments || [] } },
                { managers: ctx.userId },
                { head: ctx.userId },
            ],
        };
    return (await Department.find(query).select('_id').lean()).map(d => d._id);
}

function _taskScopeFilter(memberIds, managerId) {
    const mid = new mongoose.Types.ObjectId(String(managerId));
    return {
        deleted: { $ne: true },
        $and: [
            { $or: [{ assignedTo: { $in: memberIds } }, { createdBy: { $in: memberIds } }] },
            { $or: [{ visibility: { $ne: 'private' } }, { createdBy: mid }, { assignedTo: mid }] },
        ],
    };
}

router.get('/tasks/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const { departmentId } = req.params;

        if (!isValidObjectId(departmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }

        const ctx = await _managerContext(req);
        if (!ctx) return res.status(401).json({ message: 'User not found' });
        const { dept, allowed } = await _managesDepartment(ctx, departmentId);
        if (!dept) return res.status(404).json({ message: 'Department not found' });
        if (!allowed) return res.status(403).json({ message: 'Access denied: You do not manage this department' });

        const members = await User.find({
            departments: departmentId,
            accountStatus: { $ne: 'removed' }
        }).select('_id');
        const memberIds = members.map(m => m._id);
        memberIds.push(new mongoose.Types.ObjectId(ctx.userId));

        const allTasks = await Task.find(_taskScopeFilter(memberIds, ctx.userId))
            .populate('assignedTo', 'username email profilePicture')
            .populate('createdBy', 'username email')
            .sort({ createdAt: -1 })
            .lean();

        const now = new Date();
        const tasks = {
            open: allTasks.filter(t => ['backlog', 'todo'].includes(t.status)),
            inProgress: allTasks.filter(t => ['in_progress', 'review', 'blocked'].includes(t.status)),
            completed: allTasks.filter(t => t.status === 'done'),
            overdue: allTasks.filter(t =>
                t.dueDate && new Date(t.dueDate) < now && !['done', 'cancelled'].includes(t.status)
            )
        };

        res.json({ tasks, total: allTasks.length });
    } catch (error) {
        logger.error('Manager Tasks GET Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/tasks/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const { title, description, priority, dueDate, assignedTo } = req.body || {};

        if (!title?.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }

        const { departmentId } = req.params;
        if (!isValidObjectId(departmentId)) {
            return res.status(400).json({ message: 'Invalid department ID' });
        }
        const ctx = await _managerContext(req);
        if (!ctx) return res.status(401).json({ message: 'User not found' });
        const { dept, allowed } = await _managesDepartment(ctx, departmentId);
        if (!dept) return res.status(404).json({ message: 'Department not found' });
        if (!allowed) return res.status(403).json({ message: 'Access denied: You do not manage this department' });

        // Assignees must be the manager or members of this department.
        const assignees = [...new Set((Array.isArray(assignedTo) ? assignedTo : assignedTo ? [assignedTo] : []).map(String))];
        if (assignees.some(id => !isValidObjectId(id))) {
            return res.status(400).json({ message: 'Invalid assignee id' });
        }
        const others = assignees.filter(id => id !== String(userId));
        if (others.length) {
            const inDept = await User.countDocuments({ _id: { $in: others }, departments: departmentId, accountStatus: { $ne: 'removed' } });
            if (inDept !== others.length) {
                return res.status(400).json({ message: 'Assignees must be members of this department' });
            }
        }

        const user = ctx.manager;

        const task = new Task({
            title: title.trim(),
            description: description || '',
            priority: ['lowest', 'low', 'medium', 'high', 'highest'].includes(priority) ? priority : 'medium',
            dueDate: dueDate || null,
            assignedTo: assignees,
            createdBy: userId,
            company: user?.companyId || null,
            status: 'todo',
            taskType: 'personal',
            visibility: 'private',
            deleted: false
        });

        await task.save();
        await task.populate('assignedTo', 'username email profilePicture');
        await task.populate('createdBy', 'username email');

        res.status(201).json({ task, message: 'Task created successfully' });
    } catch (error) {
        logger.error('Manager Tasks POST Error:', error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/tasks/:taskId/status', requireAuth, requireManager, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, blockedReason, completionNote } = req.body || {};

        if (!isValidObjectId(taskId)) return res.status(404).json({ message: 'Task not found' });

        const validStatuses = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
        const statusMap = { 'in-progress': 'in_progress', 'done': 'done', 'open': 'todo' };
        const normalizedStatus = statusMap[status] || status;

        if (!validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ message: `Invalid status: ${status}` });
        }

        const ctx = await _managerContext(req);
        if (!ctx) return res.status(401).json({ message: 'User not found' });

        const task = await Task.findById(taskId);
        if (!task || task.deleted) return res.status(404).json({ message: 'Task not found' });

        // Scope: the manager is party to the task, or it is a non-private task
        // created by / assigned to a member of a department they manage.
        const isParty = String(task.createdBy) === ctx.userId || (task.assignedTo || []).some(a => String(a) === ctx.userId);
        let inScope = isParty;
        if (!inScope && task.visibility !== 'private') {
            const deptIds = await _managedDepartmentIds(ctx);
            if (deptIds.length) {
                const people = [task.createdBy, ...(task.assignedTo || [])];
                inScope = (await User.countDocuments({ _id: { $in: people }, departments: { $in: deptIds } })) > 0;
            }
        }
        if (!inScope) return res.status(403).json({ message: 'Access denied: this task is outside your team' });

        const { isValidTransition, getAllowedTransitions, validateBlocked } = require('../../../utils/workflowValidator');
        const previousStatus = task.status;
        if (normalizedStatus !== previousStatus) {
            if (!isValidTransition(previousStatus, normalizedStatus)) {
                return res.status(400).json({
                    message: `Invalid status transition from "${previousStatus}" to "${normalizedStatus}"`,
                    allowedTransitions: getAllowedTransitions(previousStatus),
                });
            }
            const reason = typeof blockedReason === 'string' ? blockedReason.trim() : '';
            const blocked = validateBlocked(normalizedStatus, reason);
            if (!blocked.valid) return res.status(400).json({ message: blocked.error });

            task.previousStatus = previousStatus;
            task.status = normalizedStatus;
            if (normalizedStatus === 'blocked') {
                task.blockedReason = reason;
                task.blockedBy = ctx.userId;
                task.blockedAt = new Date();
            } else {
                task.blockedReason = null;
                task.blockedBy = null;
                task.blockedAt = null;
            }
            if (normalizedStatus === 'done') {
                task.completedAt = new Date();
                task.completedBy = ctx.userId;
                task.completionNote = typeof completionNote === 'string' ? completionNote.slice(0, 2000) : '';
            } else if (previousStatus === 'done') {
                task.completedAt = null;
                task.completedBy = null;
                task.completionNote = '';
            }
            await task.save();

            try {
                const TaskActivity = require('../../../models/TaskActivity');
                await TaskActivity.create({
                    task: task._id, user: ctx.userId, action: 'status_changed', field: 'status',
                    from: previousStatus, to: normalizedStatus, metadata: { via: 'manager_dashboard' },
                });
            } catch (err) {
                logger.warn({ err }, '[manager tasks] activity not recorded');
            }

            const shared = require('../tasks/tasks.shared');
            const payload = await shared.loadTaskForClient(task._id);
            await shared.emitToTaskAudience(req.io || req.app?.get('io'), task, 'task-updated', payload);
        }

        await task.populate('assignedTo', 'username email profilePicture');
        res.json({ task, message: 'Task status updated' });
    } catch (error) {
        logger.error('Manager Tasks PATCH Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
