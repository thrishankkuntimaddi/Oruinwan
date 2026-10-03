const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');
const Message = require("../../modules/messages/message.model.js");
const Tasks = require('../tasks/tasks.query');
const requireAuth = require('../../shared/middleware/auth');
const { requireManager } = require('../../shared/middleware/permissionMiddleware');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(String(id));
// Ids from PostgreSQL are strings; Mongo aggregation $match does not cast, so convert there.
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const USER_CARD = { type: 'user', fields: ['username', 'email', 'profilePicture'] };
const USER_EMAIL = { type: 'user', fields: ['username', 'email'] };
const DEPT_NAME = { type: 'department', fields: ['name'] };
const plainTask = (t) => (t && typeof t.toJSON === 'function' ? t.toJSON() : t);

/** Names of the company workspaces each user is an active member of: Map(userId → [name]). */
async function workspaceNamesByUser(userIds, companyId) {
    const ws = await org.workspaces.find({ company: companyId });
    const out = new Map(userIds.map((id) => [String(id), []]));
    for (const w of ws) {
        for (const m of w.members) {
            if (m.status === 'active' && out.has(String(m.user))) out.get(String(m.user)).push(w.name);
        }
    }
    return out;
}

router.get('/my-workspaces', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await org.userWithOrg(userId);

        const workspaceIds = (user.workspaces || []).map(w => w.workspace);

        const workspaces = workspaceIds.length
            ? (await org.workspaces.find({ _id: { $in: workspaceIds }, company: user.companyId }))
                .map((w) => ({ ...w, members: w.members.filter((m) => m.status === 'active') }))
            : [];
        await hydrate(workspaces, { 'members.user': USER_CARD });

        
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const workspace of workspaces) {
            const live = { workspace: workspace._id, deleted: { $ne: true } };
            const [messageCount, taskCount, activeTaskCount, completedTaskCount] = await Promise.all([
                Message.countDocuments({
                    workspace: workspace._id,
                    createdAt: { $gte: sevenDaysAgo }
                }),
                Tasks.countDocuments(live),
                Tasks.countDocuments({ ...live, status: { $in: ['todo', 'in_progress', 'review', 'blocked'] } }),
                Tasks.countDocuments({ ...live, status: 'done' })
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
        const user = await org.userWithOrg(userId);
        const companyId = user.companyId;

        const workspaceIds = (user.workspaces || []).map(w => w.workspace);

        const workspaceDocs = workspaceIds.length ? await org.workspaces.find({ _id: { $in: workspaceIds }, company: companyId }) : [];
        const teamMemberIds = new Set();
        workspaceDocs.forEach(ws => {
            ws.members.forEach(m => { if (m.status === 'active') teamMemberIds.add(String(m.user)); });
        });

        const teamMembers = teamMemberIds.size ? await org.users.find({
            _id: { $in: Array.from(teamMemberIds) },
            companyId,
            accountStatus: { $ne: 'removed' },
        }, { select: 'username email profilePicture companyRole jobTitle isOnline' }) : [];

        const wsNames = await workspaceNamesByUser(teamMembers.map((m) => m._id), companyId);
        for (const member of teamMembers) {
            const [workspaces, activeTasks] = await Promise.all([
                (wsNames.get(String(member._id)) || []).map((name) => ({ name })),
                Tasks.countDocuments({
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
        const user = await org.userWithOrg(userId);

        const managedDepts = user.managedDepartments || [];

        const managerWorkspaces = await org.workspaces.find({
            company: user.companyId,
            $or: [
                { members: { $elemMatch: { user: String(userId), role: 'owner', status: 'active' } } },
                { members: { $elemMatch: { user: String(userId), role: 'admin', status: 'active' } } }
            ]
        });

        const workspaceMemberIds = new Set();
        managerWorkspaces.forEach(ws => {
            ws.members.forEach(m => { if (m.status === 'active') workspaceMemberIds.add(String(m.user)); });
        });

        const unassigned = managedDepts.length ? await org.users.find({
            companyId: user.companyId,
            departments: { $in: managedDepts },
            _id: { $nin: Array.from(workspaceMemberIds) },
            accountStatus: 'active'
        }, { org: true, select: 'username email profilePicture departments createdAt' }) : [];
        await hydrate(unassigned, { departments: DEPT_NAME });

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

        const dept = await identity.departments.findById(departmentId);
        await hydrate(dept, { head: USER_EMAIL });
        const inDept = { departments: departmentId, companyId };

        const [totalMembers, activeMembers, pendingMembers, managers] = await Promise.all([
            org.users.count(inDept),
            org.users.count({ ...inDept, accountStatus: 'active' }),
            org.users.count({ ...inDept, accountStatus: { $in: ['pending', 'invited'] } }),
            org.users.count({ ...inDept, companyRole: 'manager' })
        ]);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const memberIds = await org.users.ids(inDept);

        const [messagesThisWeek, tasksCompletedThisWeek, openTasks, overdueTasks] = await Promise.all([
            Message.countDocuments({ sender: { $in: memberIds }, createdAt: { $gte: sevenDaysAgo } }),
            Tasks.countDocuments({ assignedTo: { $in: memberIds }, status: 'done', deleted: { $ne: true }, updatedAt: { $gte: sevenDaysAgo } }),
            Tasks.countDocuments({ assignedTo: { $in: memberIds }, status: { $in: OPEN_STATUSES }, deleted: { $ne: true } }),
            Tasks.countDocuments({ assignedTo: { $in: memberIds }, status: { $in: OPEN_STATUSES }, deleted: { $ne: true }, dueDate: { $lt: new Date() } }),
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

        const teamMembers = await org.users.find({ departments: departmentId, companyId, accountStatus: 'active' },
            { select: 'username email profilePicture jobTitle' });

        const wsNames = await workspaceNamesByUser(teamMembers.map((m) => m._id), companyId);
        for (const member of teamMembers) {
            const [workspaces, activeTasks] = await Promise.all([
                (wsNames.get(String(member._id)) || []).map((name) => ({ name })),
                Tasks.countDocuments({ assignedTo: member._id, status: { $in: OPEN_STATUSES }, deleted: { $ne: true } })
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
        const workspaces = await org.workspaces.find({ company: companyId });
        const workspaceMemberIds = new Set();
        workspaces.forEach(ws => (ws.members || []).forEach(m => { if (m.status === 'active') workspaceMemberIds.add(String(m.user)); }));

        const unassigned = await org.users.find({
            departments: departmentId,
            companyId,
            _id: { $nin: Array.from(workspaceMemberIds) },
            accountStatus: 'active'
        }, { org: true, select: 'username email profilePicture departments createdAt' });
        await hydrate(unassigned, { departments: DEPT_NAME });

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

        const members = await org.users.find({ departments: departmentId, companyId }, { select: '_id username' });
        const memberIds = members.map(m => oid(m._id));
        const base = { assignedTo: { $in: memberIds }, deleted: { $ne: true } };

        const [totalTasks, completedTasks, inProgressTasks, doneWithTimes, perMember] = await Promise.all([
            Tasks.countDocuments(base),
            Tasks.countDocuments({ ...base, status: 'done' }),
            Tasks.countDocuments({ ...base, status: 'in_progress' }),
            Tasks.find({ ...base, status: 'done', completedAt: { $ne: null } }, { select: 'createdAt completedAt', limit: 500 }),
            Tasks.groupCount({ assignedTo: { $in: memberIds }, deleted: { $ne: true } }, 'assignee', { onlyAssignees: memberIds })
                .then((rows) => rows.map((r) => ({ _id: r._id, total: r.count, done: r.done }))),
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
    const manager = await org.userWithOrg(userId);
    if (!manager) return null;
    const companyWide = COMPANY_WIDE_ROLES.includes(manager.companyRole) ||
        (manager.coOwnerOf && manager.companyId && String(manager.coOwnerOf) === String(manager.companyId));
    return { userId, manager, companyWide };
}

async function _managesDepartment(ctx, departmentId) {
    const dept = await identity.departments.findById(departmentId);
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
    return org.departments.ids(query);
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

        const memberIds = (await org.users.ids({
            departments: departmentId,
            accountStatus: { $ne: 'removed' }
        })).map(oid);
        memberIds.push(new mongoose.Types.ObjectId(ctx.userId));

        const allTasks = await Tasks.find(_taskScopeFilter(memberIds, ctx.userId), { sort: { createdAt: -1 } });
        await hydrate(allTasks, { assignedTo: USER_CARD, createdBy: USER_EMAIL });

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
            const inDept = await org.users.count({ _id: { $in: others }, departments: departmentId, accountStatus: { $ne: 'removed' } });
            if (inDept !== others.length) {
                return res.status(400).json({ message: 'Assignees must be members of this department' });
            }
        }

        const user = ctx.manager;

        const task = await Tasks.create({
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

        const out = plainTask(task);
        await hydrate(out, { assignedTo: USER_CARD, createdBy: USER_EMAIL });

        res.status(201).json({ task: out, message: 'Task created successfully' });
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

        let task = await Tasks.findById(taskId);
        if (!task || task.deleted) return res.status(404).json({ message: 'Task not found' });

        // Scope: the manager is party to the task, or it is a non-private task
        // created by / assigned to a member of a department they manage.
        const isParty = String(task.createdBy) === ctx.userId || (task.assignedTo || []).some(a => String(a) === ctx.userId);
        let inScope = isParty;
        if (!inScope && task.visibility !== 'private') {
            const deptIds = await _managedDepartmentIds(ctx);
            if (deptIds.length) {
                const people = [task.createdBy, ...(task.assignedTo || [])];
                inScope = (await org.users.count({ _id: { $in: people }, departments: { $in: deptIds } })) > 0;
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

            const patch = { previousStatus, status: normalizedStatus };
            if (normalizedStatus === 'blocked') {
                Object.assign(patch, { blockedReason: reason, blockedBy: ctx.userId, blockedAt: new Date() });
            } else {
                Object.assign(patch, { blockedReason: null, blockedBy: null, blockedAt: null });
            }
            if (normalizedStatus === 'done') {
                Object.assign(patch, {
                    completedAt: new Date(),
                    completedBy: ctx.userId,
                    completionNote: typeof completionNote === 'string' ? completionNote.slice(0, 2000) : '',
                });
            } else if (previousStatus === 'done') {
                Object.assign(patch, { completedAt: null, completedBy: null, completionNote: '' });
            }
            task = await Tasks.updateById(task._id, patch);

            try {
                await Tasks.logActivity({
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

        const out = plainTask(task);
        await hydrate(out, { assignedTo: USER_CARD });
        res.json({ task: out, message: 'Task status updated' });
    } catch (error) {
        logger.error('Manager Tasks PATCH Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
