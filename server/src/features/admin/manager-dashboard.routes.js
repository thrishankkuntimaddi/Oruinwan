const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../../models/User');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const Message = require("../messages/message.model.js");
const Task = require('../../../models/Task');
const requireAuth = require('../../../middleware/auth');
const { requireManager } = require('../../../middleware/permissionMiddleware');

/**
 * Reusable ObjectId validation helper.
 * Returns true if `id` is a valid 24-char hex MongoDB ObjectId.
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(String(id));

/**
 * GET /api/manager-dashboard/my-workspaces
 * Workspaces managed by the current user
 */
router.get('/my-workspaces', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId).select('workspaces companyId').lean();

        // Get all workspace IDs the user is a member of
        const workspaceIds = (user.workspaces || []).map(w => w.workspace);

        const workspaces = await Workspace.find({ _id: { $in: workspaceIds } })
            .populate('members.user', 'username email profilePicture')
            .lean();

        // Enhance with activity metrics
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const workspace of workspaces) {
            const [messageCount, taskCount, activeTaskCount] = await Promise.all([
                Message.countDocuments({
                    workspace: workspace._id,
                    createdAt: { $gte: sevenDaysAgo }
                }),
                Task.countDocuments({ workspace: workspace._id }),
                Task.countDocuments({
                    workspace: workspace._id,
                    status: { $in: ['todo', 'in_progress', 'review'] }
                })
            ]);

            workspace.memberCount = workspace.members.length;
            workspace.status = workspace.isArchived ? 'archived' : 'active';
            workspace.activity = {
                messages: messageCount,
                tasksTotal: taskCount,
                tasksActive: activeTaskCount,
                tasksCompleted: taskCount - activeTaskCount
            };
        }

        res.json({ workspaces });
    } catch (error) {
        console.error('Manager Dashboard My Workspaces Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/manager-dashboard/team-load
 * Team member workload distribution
 */
router.get('/team-load', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId).select('companyId workspaces').lean();
        const companyId = user.companyId;

        // Collect all workspaceIds the manager is in
        const workspaceIds = (user.workspaces || []).map(w => w.workspace);

        // Collect all team member IDs from those workspaces (company-isolated)
        const workspaceDocs = await Workspace.find({ _id: { $in: workspaceIds } }).select('members');
        const teamMemberIds = new Set();
        workspaceDocs.forEach(ws => {
            ws.members.forEach(m => teamMemberIds.add(m.user.toString()));
        });

        // Only include users from same company
        const teamMembers = await User.find({
            _id: { $in: Array.from(teamMemberIds) },
            companyId,
            accountStatus: { $ne: 'removed' },
        })
            .select('username email profilePicture companyRole jobTitle isOnline')
            .lean();

        // Get task load for each member
        for (const member of teamMembers) {
            const [workspaces, activeTasks] = await Promise.all([
                Workspace.find({ 'members.user': member._id }).select('name'),
                Task.countDocuments({
                    assignedTo: member._id,
                    status: { $in: ['todo', 'in_progress', 'review'] }
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
        console.error('Manager Dashboard Team Load Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/manager-dashboard/unassigned-employees
 * Department members not in manager's workspaces
 */
router.get('/unassigned-employees', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const user = await User.findById(userId);

        // Get manager's departments
        const managedDepts = user.managedDepartments || [];

        // Get manager's workspaces
        const managerWorkspaces = await Workspace.find({
            $or: [
                { 'members': { $elemMatch: { user: userId, role: 'owner' } } },
                { 'members': { $elemMatch: { user: userId, role: 'admin' } } }
            ]
        });

        const workspaceMemberIds = new Set();
        managerWorkspaces.forEach(ws => {
            ws.members.forEach(m => workspaceMemberIds.add(m.user.toString()));
        });

        // Find users in manager's departments but NOT in any of their workspaces
        const unassigned = await User.find({
            departments: { $in: managedDepts },
            _id: { $nin: Array.from(workspaceMemberIds) },
            accountStatus: 'active'
        })
            .populate('departments', 'name')
            .select('username email profilePicture departments createdAt')
            .lean();

        res.json({ unassigned });
    } catch (error) {
        console.error('Manager Dashboard Unassigned Employees Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * NEW ENDPOINTS - Department-based manager dashboard
 * Pattern: /api/manager/dashboard/*
 */

/**
 * GET /api/manager/dashboard/metrics/:departmentId
 * Overview metrics for a specific department
 */
router.get('/dashboard/metrics/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const { departmentId } = req.params;

        // ✅ Validate ObjectId before any Mongoose query
        if (!isValidObjectId(departmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }

        // Verify manager has access: either in managedDepartments[] or in Department.managers[]
        const [manager, dept] = await Promise.all([
            User.findById(userId),
            Department.findById(departmentId).populate('head', 'username email').lean()
        ]);

        if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

        const inManagedDepts = (manager.managedDepartments || []).map(d => d.toString()).includes(departmentId);
        const inDeptManagers = (dept.managers || []).map(d => d.toString()).includes(userId.toString());
        const isHead = dept.head && dept.head._id && dept.head._id.toString() === userId.toString();

        if (!inManagedDepts && !inDeptManagers && !isHead) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not manage this department' });
        }

        // Get team metrics
        const [totalMembers, activeMembers, pendingMembers, managers] = await Promise.all([
            User.countDocuments({ departments: departmentId }),
            User.countDocuments({ departments: departmentId, accountStatus: 'active' }),
            User.countDocuments({ departments: departmentId, accountStatus: 'pending' }),
            User.countDocuments({ departments: departmentId, companyRole: 'manager' })
        ]);

        // Get activity metrics (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get department member IDs
        const departmentMembers = await User.find({ departments: departmentId }).select('_id');
        const memberIds = departmentMembers.map(m => m._id);

        const [messagesThisWeek, tasksCompletedThisWeek] = await Promise.all([
            Message.countDocuments({
                user: { $in: memberIds },
                createdAt: { $gte: sevenDaysAgo }
            }),
            Task.countDocuments({
                assignedTo: { $in: memberIds },
                status: 'completed',
                updatedAt: { $gte: sevenDaysAgo }
            })
        ]);

        res.json({
            team: {
                total: totalMembers,
                active: activeMembers,
                pending: pendingMembers,
                managers
            },
            activity: {
                messagesThisWeek,
                tasksThisWeek: tasksCompletedThisWeek,
                meetingsThisWeek: 0
            },
            department: {
                name: dept.name,
                description: dept.description,
                head: dept.head,
                createdAt: dept.createdAt
            }
        });
    } catch (error) {
        console.error('Manager Dashboard Metrics Error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/manager/dashboard/team-load/:departmentId
 * Team workload for department members
 */
router.get('/dashboard/team-load/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const { departmentId } = req.params;

        // ✅ Validate ObjectId before any Mongoose query
        if (!isValidObjectId(departmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }

        // Verify manager has access to this department
        const manager = await User.findById(userId);
        if (!manager.managedDepartments || !manager.managedDepartments.map(d => d.toString()).includes(departmentId)) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not manage this department' });
        }

        // Get department members
        const teamMembers = await User.find({
            departments: departmentId,
            accountStatus: 'active'
        })
            .select('username email profilePicture')
            .lean();

        // Get task load for each member
        for (const member of teamMembers) {
            const [workspaces, activeTasks] = await Promise.all([
                Workspace.find({
                    'members.user': member._id
                }).select('name'),
                Task.countDocuments({
                    assignedTo: member._id,
                    status: { $in: ['todo', 'in_progress', 'review'] }
                })
            ]);

            member.workspaces = workspaces.map(ws => ws.name);
            member.activeTasks = activeTasks;
            member.workload = activeTasks > 10 ? 'high' : activeTasks > 5 ? 'medium' : 'low';
        }

        // Categorize
        const overloaded = teamMembers.filter(m => m.workload === 'high');
        const idle = teamMembers.filter(m => m.activeTasks === 0);

        res.json({
            teamMembers,
            overloaded,
            idle
        });
    } catch (error) {
        console.error('Manager Dashboard Team Load Error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/manager/dashboard/unassigned/:departmentId
 * Department members not in any workspace
 */
router.get('/dashboard/unassigned/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const { departmentId } = req.params;

        // ✅ Validate ObjectId before any Mongoose query
        if (!isValidObjectId(departmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }

        // Verify manager has access to this department
        const manager = await User.findById(userId);
        if (!manager.managedDepartments || !manager.managedDepartments.map(d => d.toString()).includes(departmentId)) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not manage this department' });
        }

        // Get all workspace members
        const workspaces = await Workspace.find().select('members');
        const workspaceMemberIds = new Set();
        workspaces.forEach(ws => {
            ws.members.forEach(m => workspaceMemberIds.add(m.user.toString()));
        });

        // Find users in department but NOT in any workspace
        const unassigned = await User.find({
            departments: departmentId,
            _id: { $nin: Array.from(workspaceMemberIds) },
            accountStatus: 'active'
        })
            .populate('departments', 'name')
            .select('username email profilePicture departments createdAt')
            .lean();

        res.json({ unassigned });
    } catch (error) {
        console.error('Manager Dashboard Unassigned Error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/manager/dashboard/reports/:departmentId
 * Analytics and reports for department
 */
router.get('/dashboard/reports/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const { departmentId } = req.params;

        // ✅ Validate ObjectId before any Mongoose query
        if (!isValidObjectId(departmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }

        // Verify manager has access to this department
        const manager = await User.findById(userId);
        if (!manager.managedDepartments || !manager.managedDepartments.map(d => d.toString()).includes(departmentId)) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not manage this department' });
        }

        // Get department member IDs
        const departmentMembers = await User.find({ departments: departmentId }).select('_id');
        const memberIds = departmentMembers.map(m => m._id);

        // Get task metrics
        const [totalTasks, completedTasks, inProgressTasks] = await Promise.all([
            Task.countDocuments({ assignedTo: { $in: memberIds } }),
            Task.countDocuments({ assignedTo: { $in: memberIds }, status: 'completed' }),
            Task.countDocuments({ assignedTo: { $in: memberIds }, status: 'in_progress' })
        ]);

        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Calculate average time (placeholder - would need task completion dates)
        const avgTime = 3.5; // days - placeholder

        res.json({
            completionRate,
            completed: completedTasks,
            inProgress: inProgressTasks,
            total: totalTasks,
            avgTime,
            // Placeholders for chart data - would need time-series queries
            taskVolumeOverTime: [],
            teamWorkload: []
        });
    } catch (error) {
        console.error('Manager Dashboard Reports Error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

/**
 * GET /api/manager/tasks/:departmentId
 * Get all tasks assigned to members of a department, grouped by status
 */
router.get('/tasks/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const { departmentId } = req.params;
        const userId = req.user.sub || req.user._id;

        // ✅ Validate ObjectId before any Mongoose query
        if (!isValidObjectId(departmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }

        // Get all department member IDs
        const members = await User.find({
            departments: departmentId,
            accountStatus: { $ne: 'removed' }
        }).select('_id');
        const memberIds = members.map(m => m._id);

        // Also include tasks created by the manager themselves
        memberIds.push(userId);

        // Fetch all tasks for these users (non-deleted)
        const allTasks = await Task.find({
            $or: [
                { assignedTo: { $in: memberIds } },
                { createdBy: { $in: memberIds } }
            ],
            deleted: { $ne: true }
        })
            .populate('assignedTo', 'username email profilePicture')
            .populate('createdBy', 'username email')
            .sort({ createdAt: -1 })
            .lean();

        // Group by status
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
        console.error('Manager Tasks GET Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * POST /api/manager/tasks/:departmentId
 * Create a new task for a department
 */
router.post('/tasks/:departmentId', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        const { title, description, priority, dueDate, assignedTo } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }

        const user = await User.findById(userId).select('companyId').lean();

        const task = new Task({
            title: title.trim(),
            description: description || '',
            priority: priority || 'medium',
            dueDate: dueDate || null,
            assignedTo: assignedTo || [],
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
        console.error('Manager Tasks POST Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * PATCH /api/manager/tasks/:taskId/status
 * Update the status of a task
 */
router.patch('/tasks/:taskId/status', requireAuth, requireManager, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;

        const validStatuses = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];

        // Map frontend status names to schema values
        const statusMap = { 'in-progress': 'in_progress', 'done': 'done', 'open': 'todo' };
        const normalizedStatus = statusMap[status] || status;

        if (!validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ message: `Invalid status: ${status}` });
        }

        const task = await Task.findByIdAndUpdate(
            taskId,
            {
                status: normalizedStatus,
                ...(normalizedStatus === 'done' ? { completedAt: new Date() } : {})
            },
            { new: true }
        ).populate('assignedTo', 'username email profilePicture');

        if (!task) return res.status(404).json({ message: 'Task not found' });

        res.json({ task, message: 'Task status updated' });
    } catch (error) {
        console.error('Manager Tasks PATCH Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;

