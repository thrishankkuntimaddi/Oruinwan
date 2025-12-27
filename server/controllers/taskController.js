const mongoose = require("mongoose");
const Message = require("../models/Message");
const DMSession = require("../models/DMSession");
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
        console.log("🔍 GET TASKS REQUEST:", req.query); // Debug log
        const userId = req.user.sub;
        const { workspaceId, status, assignedTo, priority, includeDeleted } = req.query;

        const user = await User.findById(userId);

        if (!workspaceId) {
            console.log("❌ Missing workspaceId");
            return res.status(400).json({ message: "Workspace ID required" });
        }

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            console.log("❌ Workspace not found");
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check access
        if (!workspace.isMember(userId)) {
            console.log("❌ Access denied");
            return res.status(403).json({ message: "Access denied" });
        }

        // Get user's channel memberships for visibility check
        const Channel = require("../models/Channel");
        const userChannels = await Channel.find({
            workspace: new mongoose.Types.ObjectId(workspaceId),
            "members.user": new mongoose.Types.ObjectId(userId)
        }).distinct('_id');

        console.log(`🔍 User ${userId} is in channels:`, userChannels.length);

        // Build query
        const query = {
            workspace: workspaceId,
            company: user.companyId,
            $or: [
                { visibility: "workspace" },
                { createdBy: userId },
                { assignedTo: userId },
                { visibility: "channel", channel: { $in: userChannels } }
            ]
        };

        // Only exclude deleted tasks if includeDeleted is not "true"
        if (includeDeleted !== "true") {
            query.deleted = false;
        }

        if (status) query.status = status;
        if (priority) query.priority = priority;
        // if (assignedTo) query.assignedTo = assignedTo; // Removed to avoid conflict with visibility check


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
            assignmentType = "self", // "self", "individual", "channel"
            assignedToIds = [], // Array of user IDs for individual assignment
            channelId = null, // Channel ID for channel assignment
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

        // DEFINITION PHASE: Determine what tasks to create
        const taskDefinitions = [];

        // 1. Self Assignment
        if (assignmentType === "self") {
            taskDefinitions.push({
                assignedTo: [userId],
                visibility: "private",
                channel: null
            });
        }
        // 2. Individual Assignment (Splitting Logic)
        else if (assignmentType === "individual") {
            if (!assignedToIds || assignedToIds.length === 0) {
                return res.status(400).json({ message: "Please select at least one assignee" });
            }

            // Validate members
            for (const assigneeId of assignedToIds) {
                if (!workspace.isMember(assigneeId)) {
                    return res.status(400).json({ message: `User ${assigneeId} is not a workspace member` });
                }
            }

            // SPLIT: Create separate task for each assignee
            if (assignedToIds.length > 1) {
                for (const assigneeId of assignedToIds) {
                    taskDefinitions.push({
                        assignedTo: [assigneeId],
                        visibility: "private",
                        channel: null
                    });
                }
            } else {
                taskDefinitions.push({
                    assignedTo: assignedToIds,
                    visibility: "private",
                    channel: null
                });
            }
        }
        // 3. Channel Assignment
        else if (assignmentType === "channel") {
            if (!channelId) {
                return res.status(400).json({ message: "Channel ID required" });
            }
            const channel = await Channel.findById(channelId);
            if (!channel || channel.workspace.toString() !== workspaceId) {
                return res.status(400).json({ message: "Invalid channel" });
            }
            // All members
            const memberIds = channel.members.map(m => m.user ? m.user.toString() : m.toString());
            taskDefinitions.push({
                assignedTo: memberIds,
                visibility: "channel",
                channel: channelId
            });
        } else {
            return res.status(400).json({ message: "Invalid assignment type" });
        }

        // EXECUTION PHASE: Create Tasks & Notifications
        const createdTasks = [];

        for (const def of taskDefinitions) {
            const task = new Task({
                company: user.companyId,
                workspace: workspaceId,
                title,
                description,
                createdBy: userId,
                assignedTo: def.assignedTo,
                visibility: def.visibility,
                channel: def.channel || null,
                status,
                priority,
                dueDate: dueDate ? new Date(dueDate) : null,
                linkedMessage,
                tags: tags || []
            });

            await task.save();
            createdTasks.push(task);

            // Log Action
            await logAction({
                userId,
                action: "task_created",
                description: `Created task: ${title}`,
                resourceType: "task",
                resourceId: task._id,
                companyId: user.companyId,
                req
            });

            // NOTIFICATIONS
            try {
                // A. Channel Notification
                if (task.channel) {
                    const msg = new Message({
                        company: task.company,
                        workspace: task.workspace,
                        channel: task.channel,
                        sender: userId,
                        text: `🆕 **New Task:** ${task.title}\nAssigned to Team`
                    });
                    await msg.save();
                    await msg.populate("sender", "username profilePicture");
                    if (req.io) req.io.to(`channel_${task.channel}`).emit("new-message", msg);
                }
                // B. Individual DM Notification
                else if (task.assignedTo.length === 1 && task.assignedTo[0].toString() !== userId) {
                    const assigneeId = task.assignedTo[0];

                    // Find or Create DM Session
                    let session = await DMSession.findOne({
                        workspace: workspaceId,
                        participants: { $all: [userId, assigneeId], $size: 2 }
                    });

                    if (!session) {
                        session = new DMSession({
                            workspace: workspaceId,
                            company: user.companyId,
                            participants: [userId, assigneeId],
                            lastMessageAt: new Date()
                        });
                        await session.save();
                        // Notify workspace about new session? (Optional)
                        if (req.io) req.io.to(`workspace_${workspaceId}`).emit("dm-session-created", session);
                    }

                    // Send Message
                    const msg = new Message({
                        company: task.company,
                        workspace: task.workspace,
                        dm: session._id,
                        sender: userId,
                        text: `📋 **Assigned Task:** ${task.title} \nDue: ${task.dueDate ? new Date(task.dueDate).toDateString() : "No Date"}`
                    });
                    await msg.save();
                    await msg.populate("sender", "username profilePicture");

                    if (req.io) req.io.to(`dm_${session._id}`).emit("new-message", msg);
                }
            } catch (noteErr) {
                console.error("Notification Error:", noteErr);
            }
        }

        // Return all created tasks
        const populatedTasks = await Promise.all(createdTasks.map(t =>
            Task.findById(t._id)
                .populate("createdBy", "username profilePicture")
                .populate("assignedTo", "username profilePicture")
                .populate("channel", "name")
        ));

        return res.status(201).json({
            message: "Tasks created successfully",
            tasks: populatedTasks
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
            "tags",
            "completionNote" // Add support for completion notes
        ];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                task[field] = updates[field];
            }
        });

        // Track completion
        // Track completion and notify
        if (updates.status === "done" && task.status !== "done") {
            task.completedAt = new Date();
            task.completedBy = userId;

            // 1. Notify Channel (System Message)
            if (task.channel) {
                try {
                    const msg = new Message({
                        company: task.company || null,
                        workspace: task.workspace,
                        channel: task.channel,
                        sender: userId,
                        text: `✅ **Completed Task:** ${task.title}`
                    });
                    await msg.save();
                    await msg.populate("sender", "username profilePicture");

                    if (req.io) {
                        req.io.to(`channel_${task.channel}`).emit("new-message", msg);
                    }
                } catch (msgErr) {
                    console.error("Failed to send completion message:", msgErr);
                }
            }
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

        // Soft delete the task
        task.deleted = true;
        await task.save();

        // Notify Channel about deletion
        if (task.channel) {
            try {
                const msg = new Message({
                    company: task.company || null,
                    workspace: task.workspace,
                    channel: task.channel,
                    sender: userId,
                    text: `🗑️ **Deleted Task:** ${task.title}`
                });
                await msg.save();
                await msg.populate("sender", "username profilePicture");

                if (req.io) {
                    req.io.to(`channel_${task.channel}`).emit("new-message", msg);
                }
            } catch (msgErr) {
                console.error("Failed to send deletion message:", msgErr);
            }
        }

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
            company: user.companyId,
            deleted: false // Exclude soft-deleted tasks
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

/**
 * Restore a deleted task
 * PUT /api/tasks/:id/restore
 */
exports.restoreTask = async (req, res) => {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const workspace = await Workspace.findById(task.workspace);

        // Only creator or workspace admin can restore
        const canRestore =
            task.createdBy.toString() === userId ||
            workspace.isAdminOrOwner(userId);

        if (!canRestore) {
            return res.status(403).json({
                message: "Only task creator or workspace admin can restore tasks"
            });
        }

        task.deleted = false;
        await task.save();

        await logAction({
            userId,
            action: "task_restored",
            description: `Restored task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            req
        });

        const populatedTask = await Task.findById(task._id)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture");

        return res.json({
            message: "Task restored successfully",
            task: populatedTask
        });

    } catch (err) {
        console.error("RESTORE TASK ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Permanently delete a task
 * DELETE /api/tasks/:id/permanent
 */
exports.permanentDeleteTask = async (req, res) => {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const workspace = await Workspace.findById(task.workspace);

        // Only creator or workspace admin can permanently delete
        const canDelete =
            task.createdBy.toString() === userId ||
            workspace.isAdminOrOwner(userId);

        if (!canDelete) {
            return res.status(403).json({
                message: "Only task creator or workspace admin can permanently delete tasks"
            });
        }

        await Task.findByIdAndDelete(taskId);

        await logAction({
            userId,
            action: "task_permanently_deleted",
            description: `Permanently deleted task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            req
        });

        return res.json({ message: "Task permanently deleted" });

    } catch (err) {
        console.error("PERMANENT DELETE TASK ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
