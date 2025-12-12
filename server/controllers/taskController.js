// server/controllers/taskController.js

const Task = require("../models/Task");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { logAction } = require("../utils/historyLogger");

/**
 * Get tasks for a workspace
 * GET /api/tasks?workspaceId=...&status=...&assignedTo=...
 */
exports.getTasks = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, status, assignedTo, priority } = req.query;

        const user = await User.findById(userId);

        if (!workspaceId) {
            return res.status(400).json({ message: "Workspace ID required" });
        }

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check access
        if (!workspace.isMember(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Build query
        const query = {
            workspace: workspaceId,
            company: user.companyId
        };

        if (status) query.status = status;
        if (assignedTo) query.assignedTo = assignedTo;
        if (priority) query.priority = priority;

        const tasks = await Task.find(query)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture")
            .sort({ dueDate: 1, priority: -1, createdAt: -1 })
            .lean();

        return res.json({ tasks });

    } catch (err) {
        console.error("GET TASKS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Create a new task
 * POST /api/tasks
 */
exports.createTask = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            workspaceId,
            title,
            description,
            assignedTo,
            status = "todo",
            priority = "medium",
            dueDate,
            linkedMessage,
            tags
        } = req.body;

        if (!title || !workspaceId) {
            return res.status(400).json({ message: "Title and workspace ID required" });
        }

        const user = await User.findById(userId);
        const workspace = await Workspace.findById(workspaceId);

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        if (!workspace.isMember(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Validate assignee is workspace member
        if (assignedTo && !workspace.isMember(assignedTo)) {
            return res.status(400).json({ message: "Assignee must be a workspace member" });
        }

        const task = new Task({
            company: user.companyId,
            workspace: workspaceId,
            title,
            description,
            createdBy: userId,
            assignedTo: assignedTo || null,
            status,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null,
            linkedMessage,
            tags: tags || []
        });

        await task.save();

        await logAction({
            userId,
            action: "task_created",
            description: `Created task: ${title}`,
            resourceType: "task",
            resourceId: task._id,
            companyId: user.companyId,
            metadata: { workspaceId, assignedTo },
            req
        });

        const populatedTask = await Task.findById(task._id)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture");

        return res.status(201).json({
            message: "Task created successfully",
            task: populatedTask
        });

    } catch (err) {
        console.error("CREATE TASK ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update a task
 * PUT /api/tasks/:id
 */
exports.updateTask = async (req, res) => {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const updates = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const workspace = await Workspace.findById(task.workspace);
        if (!workspace.isMember(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Update fields
        const allowedFields = [
            "title",
            "description",
            "status",
            "priority",
            "dueDate",
            "assignedTo",
            "tags"
        ];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                task[field] = updates[field];
            }
        });

        // Track completion
        if (updates.status === "done" && task.status !== "done") {
            task.completedAt = new Date();
            task.completedBy = userId;
        }

        await task.save();

        await logAction({
            userId,
            action: "task_updated",
            description: `Updated task: ${task.title}`,
            resourceType: "task",
            resourceId: task._id,
            companyId: task.company,
            metadata: updates,
            req
        });

        const populatedTask = await Task.findById(task._id)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture");

        return res.json({
            message: "Task updated successfully",
            task: populatedTask
        });

    } catch (err) {
        console.error("UPDATE TASK ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
exports.deleteTask = async (req, res) => {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const workspace = await Workspace.findById(task.workspace);

        // Only creator or workspace admin can delete
        const canDelete =
            task.createdBy.toString() === userId ||
            workspace.isAdminOrOwner(userId);

        if (!canDelete) {
            return res.status(403).json({
                message: "Only task creator or workspace admin can delete tasks"
            });
        }

        await Task.findByIdAndDelete(taskId);

        await logAction({
            userId,
            action: "task_deleted",
            description: `Deleted task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            req
        });

        return res.json({ message: "Task deleted successfully" });

    } catch (err) {
        console.error("DELETE TASK ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get user's assigned tasks
 * GET /api/tasks/my-tasks
 */
exports.getMyTasks = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { status, priority } = req.query;

        const user = await User.findById(userId);

        const query = {
            assignedTo: userId,
            company: user.companyId
        };

        if (status) query.status = status;
        if (priority) query.priority = priority;

        const tasks = await Task.find(query)
            .populate("createdBy", "username profilePicture")
            .populate("workspace", "name icon")
            .sort({ dueDate: 1, priority: -1 })
            .lean();

        return res.json({ tasks });

    } catch (err) {
        console.error("GET MY TASKS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
