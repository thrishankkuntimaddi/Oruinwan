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

        // Get user's channel memberships for visibility check
        const Channel = require("../models/Channel");
        const userChannels = await Channel.find({
            workspace: new mongoose.Types.ObjectId(workspaceId),
            "members.user": new mongoose.Types.ObjectId(userId)
        }).distinct('_id');

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

        // Exclude tasks that user has deleted from their view (assignee-specific deletion)
        query.deletedFor = { $ne: userId };

        if (status) query.status = status;
        if (priority) query.priority = priority;
        // if (assignedTo) query.assignedTo = assignedTo; // Removed to avoid conflict with visibility check

        const tasks = await Task.find(query)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture")
            .populate("transferRequest.requestedTo", "username profilePicture")
            .populate("transferRequest.requestedBy", "username profilePicture")
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
        // 2. Individual Assignment with Split/Shared choice
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

            // Get taskMode from request (default to 'split' for backward compatibility)
            const { taskMode = 'split' } = req.body;
            console.log('🔍 TASK MODE:', taskMode, '| Request body:', req.body);

            // SPLIT MODE: Create separate task for each assignee
            if (taskMode === 'split' && assignedToIds.length > 1) {
                for (const assigneeId of assignedToIds) {
                    taskDefinitions.push({
                        assignedTo: [assigneeId],
                        visibility: "private",
                        channel: null
                    });
                }
            }
            // SHARED MODE: One task for all assignees (collaborative)
            else {
                taskDefinitions.push({
                    assignedTo: assignedToIds,
                    visibility: "private",
                    channel: null
                });
            }
        }
        // 3. Channel Assignment - Shared task for all channel members
        else if (assignmentType === "channel") {
            if (!channelId) {
                return res.status(400).json({ message: "Channel ID required" });
            }
            const Channel = require("../models/Channel"); // Re-require Channel here to avoid circular dependency issues if Channel also requires Task
            const channel = await Channel.findById(channelId);
            if (!channel || channel.workspace.toString() !== workspaceId) {
                return res.status(400).json({ message: "Invalid channel" });
            }
            // All members share ONE task
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

        // ✅ REAL-TIME SOCKET EMISSION
        if (req.io) {
            populatedTasks.forEach(task => {
                if (task.visibility === "workspace") {
                    req.io.to(`workspace_${workspaceId}`).emit("task-created", task);
                } else if (task.visibility === "channel" && task.channel) {
                    req.io.to(`channel_${task.channel._id || task.channel}`).emit("task-created", task);
                } else {
                    // Private/Specific - emit to creator and assignees
                    const recipients = new Set([userId, ...task.assignedTo.map(a => a._id.toString())]);
                    recipients.forEach(recipientId => {
                        req.io.to(`user_${recipientId}`).emit("task-created", task);
                    });
                }
            });
        }

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

        // Handle orphaned tasks (workspace deleted)
        if (!workspace) {
            // If workspace is gone, only allow updates if user is creator? 
            // Or maybe block updates entirely since context is lost.
            // For now, let's block updates unless creator, but better to just say workspace not found
            return res.status(404).json({ message: "Workspace for this task not found" });
        }

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

        // Track original assignees before update for notification
        const originalAssignees = task.assignedTo.map(id => id.toString());

        await task.save();

        // Detect assignee changes and notify affected users
        if (updates.assignedTo !== undefined) {
            const newAssignees = Array.isArray(updates.assignedTo)
                ? updates.assignedTo.map(id => id.toString())
                : [updates.assignedTo.toString()];

            // Find removed assignees (old - new)
            const removedAssignees = originalAssignees.filter(id => !newAssignees.includes(id));

            // Find added assignees (new - old)
            const addedAssignees = newAssignees.filter(id => !originalAssignees.includes(id));

            // Notify removed assignees via WebSocket
            if (req.io && removedAssignees.length > 0) {
                removedAssignees.forEach(assigneeId => {
                    req.io.to(`user_${assigneeId}`).emit("task-removed", {
                        taskId: task._id,
                        reason: "reassigned"
                    });
                });
            }

            // Notify new assignees via WebSocket
            if (req.io && addedAssignees.length > 0) {
                const populatedTask = await Task.findById(task._id)
                    .populate("createdBy", "username profilePicture")
                    .populate("assignedTo", "username profilePicture")
                    .populate("channel", "name");

                addedAssignees.forEach(assigneeId => {
                    req.io.to(`user_${assigneeId}`).emit("task-assigned", populatedTask);
                });
            }
        }

        // Broadcast task update to all current assignees (for shared tasks)
        if (req.io) {
            const updatedTask = await Task.findById(task._id)
                .populate("createdBy", "username profilePicture")
                .populate("assignedTo", "username profilePicture")
                .populate("channel", "name");

            // Notify all assignees (including the updater - they'll see it too)
            task.assignedTo.forEach(assigneeId => {
                req.io.to(`user_${assigneeId.toString()}`).emit("task-updated", updatedTask);
            });
        }

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
            .populate("assignedTo", "username profilePicture")
            .populate("channel", "name");

        // ✅ REAL-TIME SOCKET EMISSION (General Update)
        if (req.io) {
            if (task.visibility === "workspace") {
                req.io.to(`workspace_${task.workspace}`).emit("task-updated", populatedTask);
            } else if (task.visibility === "channel" && task.channel) {
                req.io.to(`channel_${task.channel}`).emit("task-updated", populatedTask);
            } else {
                // Private - emit to participants
                const recipients = new Set([
                    task.createdBy.toString(),
                    ...task.assignedTo.map(id => id.toString())
                ]);
                recipients.forEach(recipientId => {
                    req.io.to(`user_${recipientId}`).emit("task-updated", populatedTask);
                });
            }
        }

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

        // Handle orphaned tasks or check admin permissions
        const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;

        // Check if user is assignee
        const isAssignee = task.assignedTo.some(id => id.toString() === userId);
        const isCompleted = task.status === 'done';

        // Permission rules:
        // 1. Creator can always delete (removes for both)
        // 2. Assignee can ONLY delete if task is completed (removes from their view only)
        // 3. Workspace admin can always delete
        const canDelete =
            task.createdBy.toString() === userId ||
            (isAssignee && isCompleted) ||
            isWorkspaceAdmin;

        if (!canDelete) {
            return res.status(403).json({
                message: isAssignee
                    ? "You can only delete tasks after marking them as completed"
                    : "Only task creator or workspace admin can delete tasks"
            });
        }

        // Determine deletion behavior based on who is deleting
        const isCreator = task.createdBy.toString() === userId;

        if (isCreator) {
            // Creator deletes: soft delete for BOTH assigner and assignee
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

            // ✅ REAL-TIME SOCKET EMISSION
            if (req.io) {
                if (task.visibility === "workspace") {
                    req.io.to(`workspace_${task.workspace}`).emit("task-deleted", { taskId });
                } else if (task.visibility === "channel" && task.channel) {
                    req.io.to(`channel_${task.channel}`).emit("task-deleted", { taskId });
                } else {
                    const recipients = new Set([
                        task.createdBy.toString(),
                        ...task.assignedTo.map(id => id.toString())
                    ]);
                    recipients.forEach(recipientId => {
                        req.io.to(`user_${recipientId}`).emit("task-deleted", { taskId });
                    });
                }
            }

            return res.json({ message: "Task deleted successfully" });

        } else if (isAssignee && isCompleted) {
            // Assignee deletes completed task: remove from their view only
            // Initialize deletedFor array if it doesn't exist
            if (!task.deletedFor) {
                task.deletedFor = [];
            }

            // Add user to deletedFor array
            if (!task.deletedFor.includes(userId)) {
                task.deletedFor.push(userId);
            }

            await task.save();

            await logAction({
                userId,
                action: "task_deleted",
                description: `Removed completed task from view: ${task.title}`,
                resourceType: "task",
                resourceId: taskId,
                companyId: task.company,
                req
            });

            return res.json({ message: "Task removed from your view" });
        }
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
            .populate("transferRequest.requestedTo", "username profilePicture")
            .populate("transferRequest.requestedBy", "username profilePicture")
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

        // Handle orphaned tasks or check admin permissions
        const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;

        // Only creator or workspace admin can restore
        const canRestore =
            task.createdBy.toString() === userId ||
            isWorkspaceAdmin;

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

        // Handle orphaned tasks or check admin permissions
        const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;

        // Only creator or workspace admin can permanently delete
        const canDelete =
            task.createdBy.toString() === userId ||
            isWorkspaceAdmin;

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

/**
 * Revoke Task (Assigner Only)
 * POST /api/tasks/:id/revoke
 */
exports.revokeTask = async (req, res) => {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Only creator can revoke
        if (task.createdBy.toString() !== userId) {
            return res.status(403).json({
                message: "Only the task creator can revoke tasks"
            });
        }

        // Mark as revoked
        task.revokedAt = new Date();
        task.revokedBy = userId;

        // Clear assignees (bring back to creator)
        const previousAssignees = [...task.assignedTo];
        task.assignedTo = [userId];

        // Reset status to allow editing
        if (task.status === 'done') {
            task.status = 'todo';
        }

        await task.save();

        // Log action
        await logAction({
            userId,
            action: "task_updated",
            description: `Revoked task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            metadata: { previousAssignees },
            req
        });

        const populatedTask = await Task.findById(task._id)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture");

        return res.json({
            message: "Task revoked successfully. You can now edit and reassign it.",
            task: populatedTask
        });

    } catch (err) {
        console.error("REVOKE TASK ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Request Transfer (Assignee Only)
 * POST /api/tasks/:id/transfer-request
 */
exports.requestTransfer = async (req, res) => {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const { newAssigneeId, note } = req.body;

        if (!newAssigneeId) {
            return res.status(400).json({ message: "New assignee ID is required" });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Only assignee can request transfer
        const isAssignee = task.assignedTo.some(id => id.toString() === userId);
        if (!isAssignee) {
            return res.status(403).json({
                message: "Only the task assignee can request a transfer"
            });
        }

        // Allow overwriting pending requests (fix for zombie states)
        // if (task.transferRequest && task.transferRequest.status === 'pending') { ... }

        // Create transfer request
        task.transferRequest = {
            requestedBy: userId,
            requestedTo: newAssigneeId,
            requestedAt: new Date(),
            status: 'pending',
            note: note || ''
        };

        await task.save();

        // Log action
        await logAction({
            userId,
            action: "task_updated",
            description: `Requested transfer for task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            metadata: { newAssigneeId, note },
            req
        });

        // Notify task creator about transfer request
        if (req.io) {
            const updatedTask = await Task.findById(taskId)
                .populate("createdBy", "username profilePicture")
                .populate("assignedTo", "username profilePicture")
                .populate("transferRequest.requestedTo", "username profilePicture")
                .populate("transferRequest.requestedBy", "username profilePicture");

            req.io.to(`user_${task.createdBy}`).emit("task-updated", updatedTask);
        }

        return res.json({
            message: "Transfer request submitted. Waiting for creator's approval.",
            transferRequest: task.transferRequest
        });

    } catch (err) {
        console.error("REQUEST TRANSFER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Handle Transfer Request (Assigner Only)
 * POST /api/tasks/:id/transfer-request/:action
 * Action: approve | reject
 */
exports.handleTransferRequest = async (req, res) => {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const action = req.params.action; // 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: "Invalid action. Use 'approve' or 'reject'" });
        }

        const task = await Task.findById(taskId)
            .populate("transferRequest.requestedBy", "username")
            .populate("transferRequest.requestedTo", "username");

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Only creator can approve/reject
        if (task.createdBy.toString() !== userId) {
            return res.status(403).json({
                message: "Only the task creator can approve or reject transfer requests"
            });
        }

        // Check if transfer request exists
        if (!task.transferRequest || task.transferRequest.status !== 'pending') {
            return res.status(400).json({
                message: "No pending transfer request found for this task"
            });
        }

        if (action === 'approve') {
            // Check if requestedTo is valid
            const requestedTo = task.transferRequest.requestedTo;
            if (!requestedTo) {
                return res.status(400).json({
                    message: "Cannot approve request: Target user not found or deleted"
                });
            }

            // Update assignee
            const newAssigneeId = requestedTo._id || requestedTo;
            task.assignedTo = [newAssigneeId];
            task.transferRequest.status = 'approved';

            await task.save();

            await logAction({
                userId,
                action: "task_updated",
                description: `Approved transfer request for task: ${task.title}`,
                resourceType: "task",
                resourceId: taskId,
                companyId: task.company,
                req
            });

            // Notify new assignee and old assignee
            if (req.io) {
                const populatedTask = await Task.findById(task._id)
                    .populate("createdBy", "username profilePicture")
                    .populate("assignedTo", "username profilePicture")
                    .populate("transferRequest.requestedTo", "username profilePicture")
                    .populate("transferRequest.requestedBy", "username profilePicture");

                // Notify New Assignee (task-assigned)
                if (newAssigneeId) {
                    req.io.to(`user_${newAssigneeId}`).emit("task-assigned", populatedTask);
                }

                // Notify Old Assignee / Requester (task-removed)
                const requester = task.transferRequest.requestedBy;
                if (requester) {
                    const requesterId = requester._id || requester;
                    req.io.to(`user_${requesterId}`).emit("task-removed", {
                        taskId: task._id,
                        reason: "reassigned"
                    });
                }

                // Notify Creator (task-updated)
                req.io.to(`user_${userId}`).emit("task-updated", populatedTask);
            }

            return res.json({
                message: "Transfer request approved. Task has been reassigned.",
                task: await Task.findById(task._id)
                    .populate("createdBy", "username profilePicture")
                    .populate("assignedTo", "username profilePicture")
            });

        } else if (action === 'reject') {
            task.transferRequest.status = 'rejected';
            await task.save();

            await logAction({
                userId,
                action: "task_updated",
                description: `Rejected transfer request for task: ${task.title}`,
                resourceType: "task",
                resourceId: taskId,
                companyId: task.company,
                req
            });

            // Notify requester
            if (req.io) {
                const populatedTask = await Task.findById(task._id)
                    .populate("createdBy", "username profilePicture")
                    .populate("assignedTo", "username profilePicture")
                    .populate("transferRequest.requestedTo", "username profilePicture")
                    .populate("transferRequest.requestedBy", "username profilePicture");

                const requester = task.transferRequest.requestedBy;
                if (requester) {
                    const requesterId = requester._id || requester;
                    req.io.to(`user_${requesterId}`).emit("task-updated", populatedTask);
                }
            }

            return res.json({
                message: "Transfer request rejected. Task remains with current assignee."
            });
        }

    } catch (err) {
        console.error("HANDLE TRANSFER REQUEST ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
