// server/src/features/tasks/tasks.service.js
/**
 * Tasks Service - Business Logic Layer
 * 
 * Behavior-preserving migration from controllers/taskController.js
 * 
 * This service handles ALL task business logic including:
 * - Task CRUD operations
 * - Multi-assignee workflows
 * - Permission enforcement (via policy layer)
 * - Workflow state machine validation
 * - 3-tier deletion system
 * - Transfer request workflows
 * - Subtask hierarchy
 * - Activity logging
 * - Notifications (socket + DM)
 * 
 * @module features/tasks/tasks.service
 */

// ============================================================================
// DEPENDENCIES
// ============================================================================

const mongoose = require('mongoose');

// Models (SHARED - do not modify)
const Task = require('../../../models/Task');
const TaskActivity = require('../../../models/TaskActivity');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Channel = require('../../../models/Channel');
const Message = require('../../../models/Message');
const DMSession = require('../../../models/DMSession');

// Shared Services (from other modules)
const messagesService = require('../../modules/messages/messages.service');

// Shared Utils (do not modify)
const { logAction } = require('../../../utils/historyLogger');
const { isValidTransition, getAllowedTransitions, validateBlocked } = require('../../../utils/workflowValidator');

// Feature layers (to be created)
// TODO: Import from tasks.policy.js after it's created
// TODO: Import from tasks.notifications.js after it's created  
// TODO: Import from tasks.activity.js after it's created

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Get tasks for a workspace with visibility filtering
 * 
 * Business Rules from Legacy (L17-86):
 * - Requires workspaceId
 * - User must be workspace member
 * - Respects visibility: workspace/channel/private
 * - Excludes soft-deleted tasks (unless includeDeleted=true)
 * - Excludes tasks deleted for specific user (deletedFor array)
 * - Queries user's channel memberships for visibility check
 * 
 * @param {string} userId - Requesting user ID
 * @param {Object} filters - Query filters
 * @param {string} filters.workspaceId - Required workspace ID
 * @param {string} [filters.status] - Optional status filter
 * @param {string} [filters.assignedTo] - Optional assignee filter
 * @param {string} [filters.priority] - Optional priority filter
 * @param {string} [filters.includeDeleted] - Include soft-deleted tasks ("true")
 * @returns {Promise<Object>} { tasks: Task[] }
 */
async function getTasks(userId, filters) {
    const { workspaceId, status, assignedTo, priority, includeDeleted } = filters;

    // Validation
    if (!workspaceId) {
        const error = new Error('Workspace ID required');
        error.statusCode = 400;
        throw error;
    }

    // Get user (for companyId)
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    // Validate workspace membership
    const workspace = await _validateWorkspaceMember(userId, workspaceId);

    // Get user's channel memberships for visibility check
    const userChannels = await _getUserChannels(userId, workspaceId);

    // Build visibility query
    const query = _buildVisibilityQuery(userId, workspaceId, userChannels, includeDeleted);

    // Add companyId filter
    query.company = user.companyId;

    // Optional filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    // Note: assignedTo filter removed to avoid conflict with visibility check (legacy L70)

    // Execute query
    const tasks = await Task.find(query)
        .populate("createdBy", "username profilePicture")
        .populate("assignedTo", "username profilePicture")
        .populate("transferRequest.requestedTo", "username profilePicture")
        .populate("transferRequest.requestedBy", "username profilePicture")
        .sort({ dueDate: 1, priority: -1, createdAt: -1 })
        .lean();

    return { tasks };
}

/**
 * Create a new task with multi-assignee support
 * 
 * Business Rules from Legacy (L92-322):
 * - 3 assignment types: self, individual (split/shared), channel
 * - Individual split mode: Creates N separate tasks (1 per assignee)
 * - Individual shared mode: Creates 1 task with multiple assignees
 * - Channel mode: Creates 1 task for all channel members
 * - Validates workspace membership for all assignees
 * - Creates TaskActivity audit record
 * - Logs action via historyLogger
 * - Sends notifications: channel messages OR DM (via E2EE service)
 * - Emits socket events: task-created
 * 
 * @param {string} userId - Creator user ID
 * @param {Object} taskData - Task creation data
 * @param {string} taskData.workspaceId - Required workspace ID
 * @param {string} taskData.title - Required task title
 * @param {string} [taskData.description] - Task description
 * @param {string} [taskData.assignmentType] - "self", "individual", "channel"
 * @param {string[]} [taskData.assignedToIds] - User IDs for individual assignment
 * @param {string} [taskData.channelId] - Channel ID for channel assignment
 * @param {string} [taskData.taskMode] - "split" or "shared" for individual type
 * @param {string} [taskData.status] - Initial status (default: "todo")
 * @param {string} [taskData.priority] - Priority (default: "medium")
 * @param {Date} [taskData.dueDate] - Optional due date
 * @param {string} [taskData.linkedMessage] - Optional linked message ID
 * @param {string[]} [taskData.tags] - Optional tags
 * @param {Object} io - Socket.io instance for real-time events
 * @param {Object} req - Express request object (for IP/user-agent)
 * @returns {Promise<Object>} { message: string, tasks: Task[] }
 */
async function createTask(userId, taskData, io, req) {
    const {
        workspaceId,
        title,
        description,
        assignmentType = "self",
        assignedToIds = [],
        channelId = null,
        taskMode = 'split',
        status = "todo",
        priority = "medium",
        dueDate,
        linkedMessage,
        tags,
        source,
        type
    } = taskData;

    // Validation
    if (!title || !workspaceId) {
        const error = new Error('Title and workspace ID required');
        error.statusCode = 400;
        throw error;
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    // Validate workspace membership
    const workspace = await _validateWorkspaceMember(userId, workspaceId);

    // ============================================================================
    // PHASE 1: DETERMINE TASK DEFINITIONS (Assignment Type Logic)
    // ============================================================================
    const taskDefinitions = [];

    if (assignmentType === "self") {
        // Self Assignment: 1 task for creator only
        taskDefinitions.push({
            assignedTo: [userId],
            visibility: "private",
            channel: null
        });
    }
    else if (assignmentType === "individual") {
        // Individual Assignment
        if (!assignedToIds || assignedToIds.length === 0) {
            const error = new Error('Please select at least one assignee');
            error.statusCode = 400;
            throw error;
        }

        // Validate all assignees are workspace members
        for (const assigneeId of assignedToIds) {
            if (!workspace.isMember(assigneeId)) {
                const error = new Error(`User ${assigneeId} is not a workspace member`);
                error.statusCode = 400;
                throw error;
            }
        }

        if (taskMode === 'split' && assignedToIds.length > 1) {
            // SPLIT MODE: Create separate task for each assignee
            for (const assigneeId of assignedToIds) {
                taskDefinitions.push({
                    assignedTo: [assigneeId],
                    visibility: "private",
                    channel: null
                });
            }
        } else {
            // SHARED MODE: One task for all assignees
            taskDefinitions.push({
                assignedTo: assignedToIds,
                visibility: "private",
                channel: null
            });
        }
    }
    else if (assignmentType === "channel") {
        // Channel Assignment
        if (!channelId) {
            const error = new Error('Channel ID required');
            error.statusCode = 400;
            throw error;
        }

        const channel = await Channel.findById(channelId);
        if (!channel || channel.workspace.toString() !== workspaceId) {
            const error = new Error('Invalid channel');
            error.statusCode = 400;
            throw error;
        }

        // All channel members share ONE task
        const memberIds = channel.members.map(m => m.user ? m.user.toString() : m.toString());
        taskDefinitions.push({
            assignedTo: memberIds,
            visibility: "channel",
            channel: channelId
        });
    } else {
        const error = new Error('Invalid assignment type');
        error.statusCode = 400;
        throw error;
    }

    // ============================================================================
    // PHASE 2: CREATE TASKS
    // ============================================================================
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
            tags: tags || [],
            source: source || 'manual',
            type: type || 'task'
        });

        await task.save();
        createdTasks.push(task);

        // =========================================================================
        // STUB: Activity Logging (STEP 3)
        // =========================================================================
        // TODO: Move to tasks.activity.js in STEP 3
        await TaskActivity.create({
            task: task._id,
            user: userId,
            action: 'created',
            metadata: {
                assignmentType,
                visibility: def.visibility,
                source: task.source
            },
            ipAddress: req?.ip,
            userAgent: req?.get('user-agent')
        });

        await logAction({
            userId,
            action: "task_created",
            description: `Created task: ${title}`,
            resourceType: "task",
            resourceId: task._id,
            companyId: user.companyId,
            req
        });

        // =========================================================================
        // STUB: Notifications (STEP 3)
        // =========================================================================
        // TODO: Move to tasks.notifications.js in STEP 3
        try {
            if (task.channel) {
                // Channel Notification
                const msg = new Message({
                    company: task.company,
                    workspace: task.workspace,
                    channel: task.channel,
                    sender: userId,
                    text: `🆕 **New Task:** ${task.title}\nAssigned to Team`
                });
                await msg.save();
                await msg.populate("sender", "username profilePicture");
                if (io) io.to(`channel_${task.channel}`).emit("new-message", msg);
            }
            else if (task.assignedTo.length === 1 && task.assignedTo[0].toString() !== userId) {
                // Individual DM Notification (E2EE)
                const assigneeId = task.assignedTo[0];
                const session = await messagesService.findOrCreateDMSession(
                    userId,
                    assigneeId,
                    workspaceId
                );

                const msg = new Message({
                    company: task.company,
                    workspace: task.workspace,
                    dm: session._id,
                    sender: userId,
                    text: `📋 **Assigned Task:** ${task.title} \nDue: ${task.dueDate ? new Date(task.dueDate).toDateString() : "No Date"}`
                });
                await msg.save();
                await msg.populate("sender", "username profilePicture");

                if (io) io.to(`dm_${session._id}`).emit("new-message", msg);
            }
        } catch (noteErr) {
            console.error("Notification Error:", noteErr);
        }
    }

    // ============================================================================
    // PHASE 3: POPULATE AND RETURN
    // ============================================================================
    const populatedTasks = await Promise.all(createdTasks.map(t =>
        Task.findById(t._id)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture")
            .populate("channel", "name")
    ));

    // =========================================================================
    // STUB: Socket Events (STEP 3)
    // =========================================================================
    // TODO: Move to tasks.notifications.js in STEP 3
    if (io) {
        populatedTasks.forEach(task => {
            if (task.visibility === "workspace") {
                io.to(`workspace_${workspaceId}`).emit("task-created", task);
            } else if (task.visibility === "channel" && task.channel) {
                io.to(`channel_${task.channel._id || task.channel}`).emit("task-created", task);
            } else {
                // Private - emit to creator and assignees
                const recipients = new Set([userId, ...task.assignedTo.map(a => a._id.toString())]);
                recipients.forEach(recipientId => {
                    io.to(`user_${recipientId}`).emit("task-created", task);
                });
            }
        });
    }

    return {
        message: "Tasks created successfully",
        tasks: populatedTasks
    };
}

/**
 * Update a task with workflow validation
 * 
 * Business Rules from Legacy (L328-578):
 * - Validates workspace membership
 * - Status changes: Validates workflow transitions + permissions
 * - Blocked state: Requires blockedReason
 * - Completion: Sets completedBy, completedAt, completionNote
 * - Assignee management: Tracks additions/removals
 * - Editable fields: title, description, priority, dueDate, tags, storyPoints, estimatedHours, actualHours, resolution
 * - Creates TaskActivity for each change
 * - Sends channel notification on completion (if channel task)
 * - Emits socket events: task-updated, task-assigned, task-removed
 * 
 * @param {string} userId - User performing update
 * @param {string} taskId - Task ID to update
 * @param {Object} updates - Fields to update
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string, task: Task }
 */
async function updateTask(userId, taskId, updates, io, req) {
    // PLACEHOLDER - Implementation in next step
    throw new Error('Not implemented yet');
}

/**
 * Delete a task (3-tier deletion system)
 * 
 * Business Rules from Legacy (L584-708):
 * 
 * TIER 1 - Creator Soft Delete:
 * - Sets task.deleted = true
 * - Affects ALL users (global soft delete)
 * - Sends channel notification if channel task
 * - Emits task-deleted socket event
 * 
 * TIER 2 - Assignee Soft Delete (Self Only):
 * - Only allowed if task.status === 'done'
 * - Adds userId to task.deletedFor array
 * - Only removes from assignee's view
 * - Other users still see task
 * 
 * TIER 3 - Manager Soft Delete:
 * - Same as creator (global soft delete)
 * 
 * Permission Matrix:
 * - Creator: Always allowed (global)
 * - Assignee: Only if completed (self only)
 * - Manager: Always allowed (global)
 * 
 * @param {string} userId - User performing deletion
 * @param {string} taskId - Task ID to delete
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string }
 */
async function deleteTask(userId, taskId, io, req) {
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    const workspace = await Workspace.findById(task.workspace);
    const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;
    const isAssignee = task.assignedTo.some(id => id.toString() === userId);
    const isCompleted = task.status === 'done';
    const isCreator = task.createdBy.toString() === userId;

    // ============================================================================
    // PERMISSION MATRIX (3-Tier System)
    // ============================================================================
    // TIER 1: Creator - Always allowed (global soft delete)
    // TIER 2: Assignee - Only if completed (self-only soft delete)
    // TIER 3: Manager - Always allowed (global soft delete)
    const canDelete =
        isCreator ||
        (isAssignee && isCompleted) ||
        isWorkspaceAdmin;

    if (!canDelete) {
        const error = new Error(
            isAssignee
                ? "You can only delete tasks after marking them as completed"
                : "Only task creator or workspace admin can delete tasks"
        );
        error.statusCode = 403;
        throw error;
    }

    // ============================================================================
    // DELETION LOGIC
    // ============================================================================
    if (isCreator || isWorkspaceAdmin) {
        // TIER 1 & 3: Creator or Manager - Global soft delete
        task.deleted = true;
        await task.save();

        // STUB: Channel notification (STEP 3)
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

                if (io) {
                    io.to(`channel_${task.channel}`).emit("new-message", msg);
                }
            } catch (msgErr) {
                console.error("Failed to send deletion message:", msgErr);
            }
        }

        // STUB: Audit logging (STEP 3)
        await logAction({
            userId,
            action: "task_deleted",
            description: `Deleted task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            req
        });

        // STUB: Socket events (STEP 3)
        if (io) {
            if (task.visibility === "workspace") {
                io.to(`workspace_${task.workspace}`).emit("task-deleted", { taskId });
            } else if (task.visibility === "channel" && task.channel) {
                io.to(`channel_${task.channel}`).emit("task-deleted", { taskId });
            } else {
                const recipients = new Set([
                    task.createdBy.toString(),
                    ...task.assignedTo.map(id => id.toString())
                ]);
                recipients.forEach(recipientId => {
                    io.to(`user_${recipientId}`).emit("task-deleted", { taskId });
                });
            }
        }

        return { message: "Task deleted successfully" };
    }
    else if (isAssignee && isCompleted) {
        // TIER 2: Assignee - Self-only soft delete
        if (!task.deletedFor) {
            task.deletedFor = [];
        }

        if (!task.deletedFor.includes(userId)) {
            task.deletedFor.push(userId);
        }

        await task.save();

        // STUB: Audit logging (STEP 3)
        await logAction({
            userId,
            action: "task_deleted",
            description: `Removed completed task from view: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            req
        });

        return { message: "Task removed from your view" };
    }
}

/**
 * Get user's assigned tasks
 * 
 * Business Rules from Legacy (L714-744):
 * - Finds tasks where assignedTo includes userId
 * - Filters by user's companyId
 * - Excludes soft-deleted tasks (task.deleted = false)
 * - Excludes tasks deleted from user's view (task.deletedFor != userId)
 * - Optional status and priority filters
 * - Sorted by: dueDate ASC, priority DESC
 * 
 * @param {string} userId - User ID
 * @param {Object} filters - Query filters
 * @param {string} [filters.status] - Optional status filter
 * @param {string} [filters.priority] - Optional priority filter
 * @returns {Promise<Object>} { tasks: Task[] }
 */
async function getMyTasks(userId, filters) {
    const { status, priority } = filters;

    // Get user (for companyId)
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    const query = {
        assignedTo: userId,
        company: user.companyId,
        deleted: false, // Exclude soft-deleted tasks
        deletedFor: { $ne: userId } // Exclude tasks deleted from user's view
    };

    // Optional filters
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query)
        .populate("createdBy", "username profilePicture")
        .populate("workspace", "name icon")
        .populate("transferRequest.requestedTo", "username profilePicture")
        .populate("transferRequest.requestedBy", "username profilePicture")
        .sort({ dueDate: 1, priority: -1 })
        .lean();

    return { tasks };
}

/**
 * Restore a soft-deleted task
 * 
 * Business Rules from Legacy (L750-802):
 * - Only creator or workspace manager can restore
 * - Sets task.deleted = false
 * - Logs restoration action
 * 
 * @param {string} userId - User performing restoration
 * @param {string} taskId - Task ID to restore
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string, task: Task }
 */
async function restoreTask(userId, taskId, req) {
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    const workspace = await Workspace.findById(task.workspace);
    const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;

    // Permission: Only creator or workspace admin
    const canRestore = task.createdBy.toString() === userId || isWorkspaceAdmin;
    if (!canRestore) {
        const error = new Error('Only task creator or workspace admin can restore tasks');
        error.statusCode = 403;
        throw error;
    }

    task.deleted = false;
    await task.save();

    // STUB: Audit logging (STEP 3)
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

    return {
        message: "Task restored successfully",
        task: populatedTask
    };
}

/**
 * Permanently delete a task (hard delete)
 * 
 * Business Rules from Legacy (L808-852):
 * - Only creator or workspace manager allowed
 * - Uses Task.findByIdAndDelete() (permanent removal)
 * - Logs permanent deletion action
 * 
 * @param {string} userId - User performing deletion
 * @param {string} taskId - Task ID to permanently delete
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string }
 */
async function permanentDeleteTask(userId, taskId, req) {
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    const workspace = await Workspace.findById(task.workspace);
    const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;

    // Permission: Only creator or workspace admin
    const canDelete = task.createdBy.toString() === userId || isWorkspaceAdmin;
    if (!canDelete) {
        const error = new Error('Only task creator or workspace admin can permanently delete tasks');
        error.statusCode = 403;
        throw error;
    }

    await Task.findByIdAndDelete(taskId);

    // STUB: Audit logging (STEP 3)
    await logAction({
        userId,
        action: "task_permanently_deleted",
        description: `Permanently deleted task: ${task.title}`,
        resourceType: "task",
        resourceId: taskId,
        companyId: task.company,
        req
    });

    return { message: "Task permanently deleted" };
}

/**
 * Revoke a task (bring back to creator)
 * 
 * Business Rules from Legacy (L858-915):
 * - Only creator can revoke
 * - Sets revokedAt, revokedBy
 * - Clears assignees → reassigns to creator
 * - If status === 'done', resets to 'todo'
 * - Logs action with previousAssignees metadata
 * 
 * @param {string} userId - User revoking task (must be creator)
 * @param {string} taskId - Task ID to revoke
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string, task: Task }
 */
async function revokeTask(userId, taskId, req) {
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    // Permission: Only creator can revoke
    if (task.createdBy.toString() !== userId) {
        const error = new Error('Only the task creator can revoke tasks');
        error.statusCode = 403;
        throw error;
    }

    // Mark as revoked
    task.revokedAt = new Date();
    task.revokedBy = userId;

    // Clear assignees (bring back to creator)
    const previousAssignees = [...task.assignedTo];
    task.assignedTo = [userId];

    // Reset status if completed
    if (task.status === 'done') {
        task.status = 'todo';
    }

    await task.save();

    // STUB: Audit logging (STEP 3)
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

    return {
        message: "Task revoked successfully. You can now edit and reassign it.",
        task: populatedTask
    };
}

/**
 * Request task transfer to another user
 * 
 * Business Rules from Legacy (L921-990):
 * - Only assignee can request transfer
 * - Creates transferRequest object: { requestedBy, requestedTo, requestedAt, status: 'pending', note }
 * - Allows overwriting pending requests (no zombie state)
 * - Notifies creator via socket event
 * 
 * @param {string} userId - Assignee requesting transfer
 * @param {string} taskId - Task ID
 * @param {string} newAssigneeId - Target user for transfer
 * @param {string} [note] - Optional transfer note
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string, transferRequest: Object }
 */
async function requestTransfer(userId, taskId, newAssigneeId, note, io, req) {
    // PLACEHOLDER - Implementation in next step
    throw new Error('Not implemented yet');
}

/**
 * Handle transfer request (approve or reject)
 * 
 * Business Rules from Legacy (L997-1127):
 * - Only creator or workspace manager can approve/reject
 * - Action: "approve" or "reject"
 * 
 * APPROVE:
 * - Updates task.assignedTo = [newAssigneeId]
 * - Sets transferRequest.status = 'approved'
 * - Emits: task-assigned (new assignee), task-removed (old assignee), task-updated (creator)
 * 
 * REJECT:
 * - Sets transferRequest.status = 'rejected'
 * - Emits: task-updated (requester)
 * 
 * @param {string} userId - Creator/manager handling request
 * @param {string} taskId - Task ID
 * @param {string} action - "approve" or "reject"
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string, task?: Task }
 */
async function handleTransferRequest(userId, taskId, action, io, req) {
    // PLACEHOLDER - Implementation in next step
    throw new Error('Not implemented yet');
}

/**
 * Create a subtask
 * 
 * Business Rules from Legacy (L1133-1245):
 * - Cannot create subtask under another subtask (max depth = 1)
 * - Validates parentTask.type !== 'subtask'
 * - Permission: Creator, ANY assignee, or workspace manager
 * - Subtask inherits: workspace, company, project, visibility, channel, epic
 * - Subtask defaults: type='subtask', status='todo', priority from parent
 * - Updates parent.subtasks array
 * - Logs TaskActivity on both parent and subtask
 * - Emits subtask-created to all stakeholders
 * 
 * @param {string} userId - User creating subtask
 * @param {string} parentId - Parent task ID
 * @param {Object} subtaskData - Subtask data
 * @param {string} subtaskData.title - Required subtask title
 * @param {string} [subtaskData.description] - Subtask description
 * @param {string[]} [subtaskData.assignedTo] - Assignee IDs
 * @param {string} [subtaskData.priority] - Priority (defaults to parent's)
 * @param {Date} [subtaskData.dueDate] - Optional due date
 * @param {string[]} [subtaskData.tags] - Optional tags
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} { message: string, subtask: Task }
 */
async function createSubtask(userId, parentId, subtaskData, io, req) {
    // PLACEHOLDER - Implementation in next step
    throw new Error('Not implemented yet');
}

/**
 * Get task activity (audit history)
 * 
 * Business Rules from Legacy (L1251-1305):
 * - Verifies task exists and user has access
 * - Checks if user can view task (via Task.canView())
 * - Requires user's channel memberships for visibility check
 * - Returns TaskActivity records sorted by createdAt DESC
 * - Supports pagination: limit (default 50), offset (default 0)
 * - Returns hasMore flag
 * 
 * @param {string} userId - Requesting user
 * @param {string} taskId - Task ID
 * @param {Object} pagination - Pagination options
 * @param {number} [pagination.limit=50] - Records per page
 * @param {number} [pagination.offset=0] - Offset for pagination
 * @returns {Promise<Object>} { activities: TaskActivity[], pagination: Object }
 */
async function getTaskActivity(userId, taskId, pagination = {}) {
    // PLACEHOLDER - Implementation in next step
    throw new Error('Not implemented yet');
}

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================
// These mirror legacy logic that wasn't in separate utility files

/**
 * Validate workspace membership for user
 * (From legacy L29-39, L114-122)
 */
async function _validateWorkspaceMember(userId, workspaceId) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new Error('Workspace not found');
    }
    if (!workspace.isMember(userId)) {
        throw new Error('Access denied');
    }
    return workspace;
}

/**
 * Get user's channel memberships for visibility checks
 * (From legacy L42-46)
 */
async function _getUserChannels(userId, workspaceId) {
    const userChannels = await Channel.find({
        workspace: new mongoose.Types.ObjectId(workspaceId),
        "members.user": new mongoose.Types.ObjectId(userId)
    }).distinct('_id');

    return userChannels;
}

/**
 * Build task visibility query
 * (From legacy L48-66)
 */
function _buildVisibilityQuery(userId, workspaceId, userChannels, includeDeleted) {
    const query = {
        workspace: workspaceId,
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

    // Exclude tasks that user has deleted from their view
    query.deletedFor = { $ne: userId };

    return query;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    getMyTasks,
    restoreTask,
    permanentDeleteTask,
    revokeTask,
    requestTransfer,
    handleTransferRequest,
    createSubtask,
    getTaskActivity
};
