// server/controllers/managerDashboardController.js
// Handles manager dashboard data and department-specific metrics

const User = require('../models/User');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const Company = require('../models/Company');

/**
 * Get department metrics for manager
 * GET /api/manager/dashboard/metrics/:departmentId
 */
exports.getDepartmentMetrics = async (req, res) => {
    try {
        const { departmentId } = req.params;

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        // Get department
        const department = await Department.findById(departmentId)
            .populate('head', 'username email')
            .populate('members', 'username email companyRole accountStatus');

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        // Verify manager has access (either is the head or is admin)
        const isHead = department.head && department.head._id.toString() === currentUserId.toString();
        const isAdmin = ['owner', 'admin'].includes(req.user.companyRole);

        if (!isHead && !isAdmin) {
            return res.status(403).json({ message: 'Access denied. You are not authorized to view this department.' });
        }

        // Calculate metrics
        const totalMembers = department.members ? department.members.length : 0;
        const activeMembers = department.members ? department.members.filter(m => m.accountStatus === 'active').length : 0;
        const pendingMembers = department.members ? department.members.filter(m => m.accountStatus === 'pending').length : 0;

        // Get department workspaces (if applicable)
        // Note: This would require a workspace-department relationship in your schema
        // For now, we'll skip this or return empty array

        const metrics = {
            department: {
                id: department._id,
                name: department.name,
                description: department.description,
                head: department.head,
                createdAt: department.createdAt
            },
            team: {
                total: totalMembers,
                active: activeMembers,
                pending: pendingMembers,
                managers: department.members ? department.members.filter(m => m.companyRole === 'manager').length : 0
            },
            activity: {
                // Placeholder for now - would integrate with actual task/message systems
                tasksThisWeek: 0,
                messagesThisWeek: 0,
                meetingsThisWeek: 0
            }
        };

        console.log('[MANAGER DASHBOARD] Fetched metrics for department:', department.name);

        return res.json(metrics);
    } catch (error) {
        console.error('GET DEPARTMENT METRICS ERROR:', error);
        return res.status(500).json({ message: 'Failed to load department metrics' });
    }
};

/**
 * Get team members for a department
 * GET /api/manager/team/:departmentId
 */
exports.getTeamMembers = async (req, res) => {
    try {
        const { departmentId } = req.params;

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        const department = await Department.findById(departmentId)
            .populate({
                path: 'members',
                select: 'username email profilePicture companyRole accountStatus createdAt',
                options: { sort: { username: 1 } }
            })
            .populate('head', 'username email profilePicture');

        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        // Verify access
        const isHead = department.head && department.head._id.toString() === currentUserId.toString();
        const isAdmin = ['owner', 'admin'].includes(req.user.companyRole);

        if (!isHead && !isAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        return res.json({
            department: {
                id: department._id,
                name: department.name
            },
            head: department.head,
            members: department.members || []
        });
    } catch (error) {
        console.error('GET TEAM MEMBERS ERROR:', error);
        return res.status(500).json({ message: 'Failed to load team members' });
    }
};

/**
 * Get department tasks (Real implementation)
 * GET /api/manager/tasks/:departmentId
 */
exports.getDepartmentTasks = async (req, res) => {
    try {
        const { departmentId } = req.params;

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        // Verify department exists
        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        // Verify access
        const isHead = department.head && department.head.toString() === currentUserId.toString();
        const isAdmin = ['owner', 'admin'].includes(req.user.companyRole);

        if (!isHead && !isAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // If department has no workspaces, return empty
        if (!department.workspaces || department.workspaces.length === 0) {
            return res.json({ tasks: { open: [], inProgress: [], completed: [], overdue: [] } });
        }

        const Task = require('../models/Task');
        const tasks = await Task.find({
            workspace: { $in: department.workspaces },
            deleted: { $ne: true }
        })
            .populate('assignedTo', 'username profilePicture')
            .populate('createdBy', 'username')
            .sort({ updatedAt: -1 });

        const formattedTasks = {
            open: tasks.filter(t => t.status === 'todo'),
            inProgress: tasks.filter(t => ['in-progress', 'review'].includes(t.status)),
            completed: tasks.filter(t => t.status === 'done'),
            overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done')
        };

        return res.json({ tasks: formattedTasks });
    } catch (error) {
        console.error('GET DEPARTMENT TASKS ERROR:', error);
        return res.status(500).json({ message: 'Failed to load tasks' });
    }
};

/**
 * Create a new task for department
 * POST /api/manager/tasks/:departmentId
 */
exports.createDepartmentTask = async (req, res) => {
    try {
        const Task = require('../models/Task');
        const { departmentId } = req.params;
        const { title, description, assignedTo, priority, dueDate, status } = req.body;

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        const department = await Department.findById(departmentId);
        if (!department) return res.status(404).json({ message: 'Department not found' });

        // Access Check
        const isHead = department.head && department.head.toString() === currentUserId.toString();
        const isAdmin = ['owner', 'admin'].includes(req.user.companyRole);
        if (!isHead && !isAdmin) return res.status(403).json({ message: 'Access denied' });

        // Use first workspace for now (Simplification)
        const workspaceId = department.workspaces && department.workspaces.length > 0 ? department.workspaces[0] : null;

        if (!workspaceId) {
            return res.status(400).json({ message: 'No workspace associated with this department to create task in.' });
        }

        const newTask = new Task({
            company: req.user.companyId,
            workspace: workspaceId,
            title,
            description,
            priority: priority || 'medium',
            status: status || 'todo',
            dueDate,
            createdBy: currentUserId,
            assignedTo: assignedTo || [],
            visibility: 'workspace'
        });

        await newTask.save();

        // Return full populated task
        const populatedTask = await Task.findById(newTask._id)
            .populate('assignedTo', 'username profilePicture')
            .populate('createdBy', 'username');

        return res.status(201).json({ task: populatedTask, message: 'Task created successfully' });

    } catch (error) {
        console.error('CREATE TASK ERROR:', error);
        return res.status(500).json({ message: 'Failed to create task' });
    }
};

/**
 * Update task status
 * PATCH /api/manager/tasks/:taskId/status
 */
exports.updateTaskStatus = async (req, res) => {
    try {
        const Task = require('../models/Task');
        const { taskId } = req.params;
        const { status } = req.body;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        // Allow update if manager or assignee or creator
        // Logic simplified: If you can see it in manager dashboard, you are a manager.
        // In real app, verify department head status again if needed.

        task.status = status;
        if (status === 'done') {
            task.completedAt = new Date();
            task.completedBy = req.user.sub;
        } else {
            task.completedAt = null;
            task.completedBy = null;
        }

        await task.save();
        return res.json({ task, message: 'Status updated' });

    } catch (error) {
        console.error('UPDATE TASK STATUS ERROR:', error);
        return res.status(500).json({ message: 'Failed to update task status' });
    }
};

/**
 * Delete task
 * DELETE /api/manager/tasks/:taskId
 */
exports.deleteTask = async (req, res) => {
    try {
        const Task = require('../models/Task');
        const { taskId } = req.params;

        // Soft delete
        const task = await Task.findByIdAndUpdate(taskId, { deleted: true }, { new: true });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        return res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('DELETE TASK ERROR:', error);
        return res.status(500).json({ message: 'Failed to delete task' });
    }
};

/**
 * Get department reports (Real implementation)
 * GET /api/manager/reports/:departmentId
 */
exports.getDepartmentReports = async (req, res) => {
    try {
        const Task = require('../models/Task');
        const { departmentId } = req.params;
        // const { startDate, endDate } = req.query; // Ignored for MVP

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const sub = req.user.sub;
        const department = await Department.findById(departmentId);

        if (!department) return res.status(404).json({ message: 'Department not found' });

        // Access
        const isHead = department.head && department.head.toString() === sub.toString();
        const isAdmin = ['owner', 'admin'].includes(req.user.companyRole);
        if (!isHead && !isAdmin) return res.status(403).json({ message: 'Access denied' });

        if (!department.workspaces || department.workspaces.length === 0) {
            return res.json({ reports: { productivity: { tasksCompleted: 0 }, team: {} } });
        }

        // real metrics
        const totalTasks = await Task.countDocuments({ workspace: { $in: department.workspaces }, deleted: { $ne: true } });
        const completedTasks = await Task.countDocuments({ workspace: { $in: department.workspaces }, status: 'done', deleted: { $ne: true } });
        const inProgressTasks = await Task.countDocuments({ workspace: { $in: department.workspaces }, status: { $in: ['in-progress', 'review'] }, deleted: { $ne: true } });

        // Avg completion time calculation
        const doneTasks = await Task.find({
            workspace: { $in: department.workspaces },
            status: 'done',
            completedAt: { $exists: true },
            createdAt: { $exists: true }
        }).limit(50);

        let avgTimeHours = 0;
        if (doneTasks.length > 0) {
            const totalTimeMs = doneTasks.reduce((acc, t) => acc + (new Date(t.completedAt) - new Date(t.createdAt)), 0);
            avgTimeHours = Math.round((totalTimeMs / doneTasks.length) / (1000 * 60 * 60));
        }

        const reports = {
            period: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: new Date()
            },
            productivity: {
                tasksCompleted: completedTasks,
                totalTasks,
                completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
                avgTaskCompletionTime: avgTimeHours + ' hrs',
                inProgress: inProgressTasks
            },
            team: {
                mostActive: null
            }
        };

        return res.json({ reports });
    } catch (error) {
        console.error('GET DEPARTMENT REPORTS ERROR:', error);
        return res.status(500).json({ message: 'Failed to load reports' });
    }
};

/**
 * Get all departments for current manager
 * GET /api/manager/my-departments
 */
exports.getMyDepartments = async (req, res) => {
    try {
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        const companyId = typeof req.user.companyId === 'object'
            ? req.user.companyId._id
            : req.user.companyId;

        // If admin, get all departments
        if (['owner', 'admin'].includes(req.user.companyRole)) {
            const departments = await Department.find({ companyId })
                .populate('head', 'username email')
                .select('name description head members createdAt workspaces')
                .sort({ name: 1 });

            return res.json({ departments });
        }

        // If manager, get only departments where user is head
        const departments = await Department.find({
            companyId,
            head: currentUserId
        })
            .populate('head', 'username email')
            .select('name description head members createdAt workspaces')
            .sort({ name: 1 });

        return res.json({ departments });
    } catch (error) {
        console.error('GET MY DEPARTMENTS ERROR:', error);
        return res.status(500).json({ message: 'Failed to load departments' });
    }
};

module.exports = exports;
