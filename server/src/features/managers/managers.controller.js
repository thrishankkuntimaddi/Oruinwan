const User = require("../../../models/User");
const Workspace = require("../../../models/Workspace");
const Department = require("../../../models/Department");
const Task = require("../../../models/Task");
const Channel = require("../channels/channel.model.js");

/**
 * Get Manager Scope (Departments & Workspaces they manage)
 * GET /api/managers/scope
 */
exports.getManagerScope = async (req, res) => {
    try {
        const userId = req.user.sub;
        const user = await User.findById(userId)
            .populate('managedDepartments', 'name description members')
            .populate('workspaces.workspace', 'name description members')
            .lean();

        // 1. Get Managed Departments
        const managedDepts = user.managedDepartments || [];

        // 2. Get Workspaces where they are Owner or Admin (Execution Owners)
        const managedWorkspaces = user.workspaces
            .filter(w => w.role === 'owner' || w.role === 'admin')
            .map(w => w.workspace)
            .filter(Boolean); // Filter out nulls if workspace was deleted

        // 3. Get Company Admin Contact (For "Contact Admin" feature)
        let companyContact = null;
        if (user.companyId) {
            const Company = require('../../../models/Company');
            const company = await Company.findById(user.companyId)
                .populate('admins.user', 'username email profilePicture')
                .lean();

            if (company && company.admins && company.admins.length > 0) {
                // Prefer owner, otherwise first admin
                const admin = company.admins.find(a => a.role === 'owner') || company.admins[0];
                if (admin && admin.user) {
                    companyContact = admin.user;
                }
            }
        }

        // 4. Get a valid workspace ID for chat context (User must be in at least one workspace to chat)
        // Prefer default workspace, or first available
        const chatWorkspaceId = user.workspaces?.[0]?.workspace?._id || null;

        res.json({
            departments: managedDepts,
            workspaces: managedWorkspaces,
            companyContact,
            chatWorkspaceId
        });

    } catch (_error) {
        console.error("GET MANAGER SCOPE ERROR:", error);
        res.status(500).json({ message: "Server error fetching scope" });
    }
};

/**
 * Get Manager Metrics (Snapshot for Scope)
 * GET /api/managers/metrics?scopeType=department&scopeId=...
 */
exports.getManagerMetrics = async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;
        let memberIds = [];

        if (scopeType === 'department') {
            const dept = await Department.findById(scopeId);
            if (dept) memberIds = dept.members;
        } else if (scopeType === 'workspace') {
            const ws = await Workspace.findById(scopeId);
            if (ws) memberIds = ws.members.map(m => m.user);
        } else {
            return res.status(400).json({ message: "Invalid scope" });
        }

        // 1. Active Members (last 7 days)
        // Note: Using a simple online/lastLogin check for now
        const activeUsers = await User.countDocuments({
            _id: { $in: memberIds },
            $or: [
                { isOnline: true },
                { lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
            ]
        });

        // 2. Open Tasks (in this scope)
        const taskQuery = { status: { $in: ['todo', 'in-progress'] } };

        if (scopeType === 'workspace') {
            taskQuery.workspace = scopeId;
        } else {
            // For department, finding tasks is trickier as tasks are workspace-bound.
            // We'll find all workspaces linked to this department or just count tasks assigned to members
            // Simpler approach: Tasks where assignee is in memberIds
            taskQuery.assignedTo = { $in: memberIds };
        }

        const openTasks = await Task.countDocuments(taskQuery);
        const overdueTasks = await Task.countDocuments({
            ...taskQuery,
            dueDate: { $lt: new Date() }
        });

        res.json({
            teamSize: memberIds.length,
            activeUsers,
            openTasks,
            overdueTasks
        });

    } catch (_error) {
        console.error("GET MANAGER METRICS ERROR:", error);
        res.status(500).json({ message: "Server error fetching metrics" });
    }
};

/**
 * Get Team Tasks (Execution Panel)
 * GET /api/managers/tasks?scopeType=...&scopeId=...
 */
exports.getManagerTasks = async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;
        let query = {};

        if (scopeType === 'workspace') {
            query.workspace = scopeId;
        } else if (scopeType === 'department') {
            const dept = await Department.findById(scopeId);
            if (!dept) return res.json([]);
            query.assignedTo = { $in: dept.members };
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'username profilePicture')
            .populate('createdBy', 'username')
            .sort({ dueDate: 1, priority: -1 }) // Urgency first
            .limit(50);

        res.json(tasks);

    } catch (_error) {
        console.error("GET MANAGER TASKS ERROR:", error);
        res.status(500).json({ message: "Server error fetching tasks" });
    }
};

/**
 * Get Activity Summary (Workspace Health)
 * GET /api/managers/activity?scopeType=workspace&scopeId=...
 */
exports.getActivitySummary = async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;

        if (scopeType !== 'workspace') {
            // Activity is mostly workspace-bound (channels)
            return res.json({ activeChannels: 0, inactiveChannels: 0 });
        }

        const channels = await Channel.find({ workspace: scopeId });

        // Simple metric: Channels with recent messages
        // In a real app, we'd query Message model. 
        // For MVP speed, we'll return channel count

        res.json({
            activeChannels: channels.length, // Placeholder for "Active"
            totalChannels: channels.length
        });

    } catch (_error) {
        console.error("GET ACTIVITY ERROR:", error);
        res.status(500).json({ message: "Server error fetching activity" });
    }
};

/**
 * Get Allocations Matrix
 * GET /api/managers/allocations
 */
exports.getAllocations = async (req, res) => {
    try {
        const userId = req.user.sub;
        const user = await User.findById(userId)
            .populate({
                path: 'managedDepartments',
                populate: { path: 'members', select: 'username email profilePicture isOnline' }
            })
            .populate({
                path: 'workspaces.workspace', // Get full workspace details
                select: 'name members'
            });

        // 1. All Department Members (Who I Can Manage)
        // Flatten members from all managed departments
        let members = [];
        const seenMemberIds = new Set();

        user.managedDepartments.forEach(dept => {
            if (dept && dept.members) {
                dept.members.forEach(m => {
                    if (!seenMemberIds.has(m._id.toString())) {
                        seenMemberIds.add(m._id.toString());
                        members.push({
                            _id: m._id,
                            username: m.username,
                            email: m.email,
                            profilePicture: m.profilePicture,
                            isOnline: m.isOnline,
                            department: dept.name // Primary dept tag
                        });
                    }
                });
            }
        });

        // 2. All Managed Workspaces (Where I Can Put Them)
        const managedWorkspaces = user.workspaces
            .filter(w => (w.role === 'owner' || w.role === 'admin') && w.workspace)
            .map(w => w.workspace);

        // 3. The Matrix (Member ID -> [Workspace IDs they are in])
        const allocationMatrix = {};

        members.forEach(m => {
            const memberWorkspaces = [];
            managedWorkspaces.forEach(ws => {
                if (ws && ws.members) {
                    const isMember = ws.members.some(wm => wm.user.toString() === m._id.toString());
                    if (isMember) memberWorkspaces.push(ws._id);
                }
            });
            allocationMatrix[m._id] = memberWorkspaces;
        });

        // 4. Return simplified data
        res.json({
            members: members,
            workspaces: managedWorkspaces.map(w => ({ _id: w._id, name: w.name })),
            allocations: allocationMatrix
        });

    } catch (_error) {
        console.error("GET ALLOCATIONS ERROR:", error);
        res.status(500).json({ message: "Server error fetching allocations" });
    }
};

/**
 * Update Workspace Allocation (Add/Remove User)
 * POST /api/managers/allocations/update
 * Body: { userId, workspaceId, action: 'add' | 'remove' }
 */
exports.updateWorkspaceAllocation = async (req, res) => {
    try {
        const { userId, workspaceId, action } = req.body;
        const managerId = req.user.sub;

        // 1. Verify Manager Access to Workspace
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        // Check if user is owner/admin of this workspace in User model (or Workspace model)
        // We'll trust the User model cache for speed, or verify strict from Workspace
        const manager = await User.findById(managerId);
        const hasAccess = manager.workspaces.some(w =>
            w.workspace.toString() === workspaceId &&
            (w.role === 'owner' || w.role === 'admin')
        );

        if (!hasAccess) {
            return res.status(403).json({ message: "You don't have permission to manage this workspace" });
        }

        // 2. Perform Action
        if (action === 'add') {
            // Check if already member
            if (workspace.isMember(userId)) {
                return res.json({ message: "Already a member" });
            }
            workspace.members.push({ user: userId, role: 'member', joinedAt: new Date() });

            // Update User's workspace list too
            await User.findByIdAndUpdate(userId, {
                $push: { workspaces: { workspace: workspaceId, role: 'member' } }
            });

        } else if (action === 'remove') {
            workspace.members = workspace.members.filter(m => m.user.toString() !== userId);

            // Remove from User's list
            await User.findByIdAndUpdate(userId, {
                $pull: { workspaces: { workspace: workspaceId } }
            });
        }

        await workspace.save();
        res.json({ success: true, message: `User ${action}ed successfully` });

    } catch (_error) {
        console.error("UPDATE ALLOCATION ERROR:", error);
        res.status(500).json({ message: "Server error updating allocation" });
    }
};

/**
 * Add Member to Department (Onboarding)
 * POST /api/managers/allocations/department/add
 * Body: { email, departmentId }
 */
exports.addMemberToDepartment = async (req, res) => {
    try {
        const { email, departmentId } = req.body;
        const managerId = req.user.sub;

        // Verify Manager owns this department
        const manager = await User.findById(managerId);
        if (!manager.managedDepartments.includes(departmentId)) {
            return res.status(403).json({ message: "You don't manage this department" });
        }

        // Find Target User
        const userToAdd = await User.findOne({ email });
        if (!userToAdd) return res.status(404).json({ message: "User not found with that email" });

        // Add to Department schema
        await Department.findByIdAndUpdate(departmentId, {
            $addToSet: { members: userToAdd._id }
        });

        // Add to User schema
        userToAdd.departments.addToSet(departmentId);
        await userToAdd.save();

        res.json({ success: true, user: userToAdd });

    } catch (_error) {
        console.error("ADD TO DEPT ERROR:", error);
        res.status(500).json({ message: "Server error addding to department" });
    }
};
/**
 * Create Task (Manager Override)
 * POST /api/managers/tasks
 * Body: { title, description, priority, dueDate, assignedTo, workspaceId }
 */
exports.createTask = async (req, res) => {
    try {
        const { title, description, priority, dueDate, assignedTo, workspaceId } = req.body;
        const managerId = req.user.sub;

        // 1. Verify Access
        const manager = await User.findById(managerId);
        const hasAccess = manager.workspaces.some(w =>
            w.workspace.toString() === workspaceId &&
            (w.role === 'owner' || w.role === 'admin')
        );

        if (!hasAccess) {
            return res.status(403).json({ message: "You don't have permission to create tasks in this workspace" });
        }

        // 2. Create Task
        const task = new Task({
            title,
            description,
            priority,
            dueDate,
            assignedTo, // Array of User IDs
            workspace: workspaceId,
            createdBy: managerId,
            visibility: 'workspace', // Managers generally create open tasks, or 'private' if specific
            status: 'todo'
        });

        await task.save();

        // 3. Populate return data
        await task.populate('assignedTo', 'username profilePicture');

        res.status(201).json(task);

    } catch (_error) {
        console.error("CREATE MANAGER TASK ERROR:", error);
        res.status(500).json({ message: "Server error creating task" });
    }
};
