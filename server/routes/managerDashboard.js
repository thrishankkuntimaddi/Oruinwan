const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Message = require('../models/Message');
const Task = require('../models/Task');
const requireAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/permissionMiddleware');

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

module.exports = router;
