const express = require('express');
const router = express.Router();
const User = require('../../../models/User');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');
const Message = require('../../../models/Message');
const Task = require('../../../models/Task');
const requireAuth = require('../../../middleware/auth');
const { requireManager } = require('../../../middleware/permissionMiddleware');

/**
 * GET /api/manager-dashboard/my-workspaces
 * Workspaces managed by the current user
 */
router.get('/my-workspaces', requireAuth, requireManager, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;

        // Find workspaces where user is manager or owner
        const workspaces = await Workspace.find({
            $or: [
                { 'members': { $elemMatch: { user: userId, role: 'owner' } } },
                { 'members': { $elemMatch: { user: userId, role: 'admin' } } }
            ]
        })
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
            workspace.projectCount = 0; // Placeholder for future project model
            workspace.status = 'active';
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

        // Get manager's workspaces
        const managerWorkspaces = await Workspace.find({
            $or: [
                { 'members': { $elemMatch: { user: userId, role: 'owner' } } },
                { 'members': { $elemMatch: { user: userId, role: 'admin' } } }
            ]
        });

        // Collect all team member IDs
        const teamMemberIds = new Set();
        managerWorkspaces.forEach(ws => {
            ws.members.forEach(m => teamMemberIds.add(m.user.toString()));
        });

        const teamMembers = await User.find({
            _id: { $in: Array.from(teamMemberIds) }
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

        // Verify manager has access to this department
        const manager = await User.findById(userId);
        if (!manager.managedDepartments || !manager.managedDepartments.map(d => d.toString()).includes(departmentId)) {
            return res.status(403).json({ message: 'Access denied: You do not manage this department' });
        }

        // Get department details
        const department = await Department.findById(departmentId).populate('head', 'username email').lean();
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
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

        const response = {
            team: {
                total: totalMembers,
                active: activeMembers,
                pending: pendingMembers,
                managers: managers
            },
            activity: {
                messagesThisWeek,
                tasksThisWeek: tasksCompletedThisWeek,
                meetingsThisWeek: 0 // Placeholder - add when meetings model exists
            },
            department: {
                name: department.name,
                description: department.description,
                head: department.head,
                createdAt: department.createdAt
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Manager Dashboard Metrics Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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

        // Verify manager has access to this department
        const manager = await User.findById(userId);
        if (!manager.managedDepartments || !manager.managedDepartments.map(d => d.toString()).includes(departmentId)) {
            return res.status(403).json({ message: 'Access denied: You do not manage this department' });
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
        res.status(500).json({ message: 'Server error', error: error.message });
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

        // Verify manager has access to this department
        const manager = await User.findById(userId);
        if (!manager.managedDepartments || !manager.managedDepartments.map(d => d.toString()).includes(departmentId)) {
            return res.status(403).json({ message: 'Access denied: You do not manage this department' });
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
        res.status(500).json({ message: 'Server error', error: error.message });
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

        // Verify manager has access to this department
        const manager = await User.findById(userId);
        if (!manager.managedDepartments || !manager.managedDepartments.map(d => d.toString()).includes(departmentId)) {
            return res.status(403).json({ message: 'Access denied: You do not manage this department' });
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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;

