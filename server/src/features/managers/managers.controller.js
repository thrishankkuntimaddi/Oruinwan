const User = require("../../../models/User");
const Workspace = require("../../../models/Workspace");
const Department = require("../../../models/Department");
const Task = require("../../../models/Task");
const Channel = require("../channels/channel.model.js");

exports.getManagerScope = async (req, res) => {
    try {
        const userId = req.user.sub;
        const user = await User.findById(userId)
            .populate('managedDepartments', 'name description members')
            .populate('workspaces.workspace', 'name description members')
            .lean();

        
        const managedDepts = user.managedDepartments || [];

        
        const managedWorkspaces = user.workspaces
            .filter(w => w.role === 'owner' || w.role === 'admin')
            .map(w => w.workspace)
            .filter(Boolean); 

        
        let companyContact = null;
        if (user.companyId) {
            const Company = require('../../../models/Company');
            const company = await Company.findById(user.companyId)
                .populate('admins.user', 'username email profilePicture')
                .lean();

            if (company && company.admins && company.admins.length > 0) {
                
                const admin = company.admins.find(a => a.role === 'owner') || company.admins[0];
                if (admin && admin.user) {
                    companyContact = admin.user;
                }
            }
        }

        
        
        const chatWorkspaceId = user.workspaces?.[0]?.workspace?._id || null;

        res.json({
            departments: managedDepts,
            workspaces: managedWorkspaces,
            companyContact,
            chatWorkspaceId
        });

    } catch (error) {
        console.error("GET MANAGER SCOPE ERROR:", error);
        res.status(500).json({ message: "Server error fetching scope" });
    }
};

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

        
        
        const activeUsers = await User.countDocuments({
            _id: { $in: memberIds },
            $or: [
                { isOnline: true },
                { lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
            ]
        });

        
        const taskQuery = { status: { $in: ['todo', 'in-progress'] } };

        if (scopeType === 'workspace') {
            taskQuery.workspace = scopeId;
        } else {
            
            
            
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

    } catch (error) {
        console.error("GET MANAGER METRICS ERROR:", error);
        res.status(500).json({ message: "Server error fetching metrics" });
    }
};

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
            .sort({ dueDate: 1, priority: -1 }) 
            .limit(50);

        res.json(tasks);

    } catch (error) {
        console.error("GET MANAGER TASKS ERROR:", error);
        res.status(500).json({ message: "Server error fetching tasks" });
    }
};

exports.getActivitySummary = async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;

        if (scopeType !== 'workspace') {
            
            return res.json({ activeChannels: 0, inactiveChannels: 0 });
        }

        const channels = await Channel.find({ workspace: scopeId });

        
        
        

        res.json({
            activeChannels: channels.length, 
            totalChannels: channels.length
        });

    } catch (error) {
        console.error("GET ACTIVITY ERROR:", error);
        res.status(500).json({ message: "Server error fetching activity" });
    }
};

exports.getAllocations = async (req, res) => {
    try {
        const userId = req.user.sub;
        const user = await User.findById(userId)
            .populate({
                path: 'managedDepartments',
                populate: { path: 'members', select: 'username email profilePicture isOnline' }
            })
            .populate({
                path: 'workspaces.workspace', 
                select: 'name members'
            });

        
        
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
                            department: dept.name 
                        });
                    }
                });
            }
        });

        
        const managedWorkspaces = user.workspaces
            .filter(w => (w.role === 'owner' || w.role === 'admin') && w.workspace)
            .map(w => w.workspace);

        
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

        
        res.json({
            members: members,
            workspaces: managedWorkspaces.map(w => ({ _id: w._id, name: w.name })),
            allocations: allocationMatrix
        });

    } catch (error) {
        console.error("GET ALLOCATIONS ERROR:", error);
        res.status(500).json({ message: "Server error fetching allocations" });
    }
};

exports.updateWorkspaceAllocation = async (req, res) => {
    try {
        const { userId, workspaceId, action } = req.body;
        const managerId = req.user.sub;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        
        
        const manager = await User.findById(managerId);
        const hasAccess = manager.workspaces.some(w =>
            w.workspace.toString() === workspaceId &&
            (w.role === 'owner' || w.role === 'admin')
        );

        if (!hasAccess) {
            return res.status(403).json({ message: "You don't have permission to manage this workspace" });
        }

        
        if (action === 'add') {
            
            if (workspace.isMember(userId)) {
                return res.json({ message: "Already a member" });
            }
            workspace.members.push({ user: userId, role: 'member', joinedAt: new Date() });

            
            await User.findByIdAndUpdate(userId, {
                $push: { workspaces: { workspace: workspaceId, role: 'member' } }
            });

        } else if (action === 'remove') {
            workspace.members = workspace.members.filter(m => m.user.toString() !== userId);

            
            await User.findByIdAndUpdate(userId, {
                $pull: { workspaces: { workspace: workspaceId } }
            });
        }

        await workspace.save();
        res.json({ success: true, message: `User ${action}ed successfully` });

    } catch (error) {
        console.error("UPDATE ALLOCATION ERROR:", error);
        res.status(500).json({ message: "Server error updating allocation" });
    }
};

exports.addMemberToDepartment = async (req, res) => {
    try {
        const { email, departmentId } = req.body;
        const managerId = req.user.sub;

        
        const manager = await User.findById(managerId);
        if (!manager.managedDepartments.includes(departmentId)) {
            return res.status(403).json({ message: "You don't manage this department" });
        }

        
        const userToAdd = await User.findOne({ email });
        if (!userToAdd) return res.status(404).json({ message: "User not found with that email" });

        
        await Department.findByIdAndUpdate(departmentId, {
            $addToSet: { members: userToAdd._id }
        });

        
        userToAdd.departments.addToSet(departmentId);
        await userToAdd.save();

        res.json({ success: true, user: userToAdd });

    } catch (error) {
        console.error("ADD TO DEPT ERROR:", error);
        res.status(500).json({ message: "Server error addding to department" });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, priority, dueDate, assignedTo, workspaceId } = req.body;
        const managerId = req.user.sub;

        
        const manager = await User.findById(managerId);
        const hasAccess = manager.workspaces.some(w =>
            w.workspace.toString() === workspaceId &&
            (w.role === 'owner' || w.role === 'admin')
        );

        if (!hasAccess) {
            return res.status(403).json({ message: "You don't have permission to create tasks in this workspace" });
        }

        
        const task = new Task({
            title,
            description,
            priority,
            dueDate,
            assignedTo, 
            workspace: workspaceId,
            createdBy: managerId,
            visibility: 'workspace', 
            status: 'todo'
        });

        await task.save();

        
        await task.populate('assignedTo', 'username profilePicture');

        res.status(201).json(task);

    } catch (error) {
        console.error("CREATE MANAGER TASK ERROR:", error);
        res.status(500).json({ message: "Server error creating task" });
    }
};
