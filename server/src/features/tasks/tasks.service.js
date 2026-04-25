const mongoose = require('mongoose');

const Task = require('../../../models/Task');
const TaskActivity = require('../../../models/TaskActivity');
const IssueKeyCounter = require('./issue-key-counter.model');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const Channel = require("../channels/channel.model.js");
const Message = require("../messages/message.model.js");
const _DMSession = require('../../../models/DMSession');

const messagesService = require('../../modules/messages/messages.service');

const { logAction } = require('../../../utils/historyLogger');
const { isValidTransition, getAllowedTransitions, validateBlocked } = require('../../../utils/workflowValidator');

const policy = require('./tasks.policy');
const _validator = require('./tasks.validator');
const notifEmitter = require('../notifications/notificationEventEmitter');

async function getTasks(userId, filters) {
    const { workspaceId, status, _assignedTo, priority, includeDeleted } = filters;

    
    if (!workspaceId) {
        const error = new Error('Workspace ID required');
        error.statusCode = 400;
        throw error;
    }

    
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    
    const _workspace = await _validateWorkspaceMember(userId, workspaceId);

    
    const userChannels = await _getUserChannels(userId, workspaceId);

    
    const query = _buildVisibilityQuery(userId, workspaceId, userChannels, includeDeleted);

    
    query.company = user.companyId;

    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    

    
    const tasks = await Task.find(query)
        .populate("createdBy", "username profilePicture")
        .populate("assignedTo", "username profilePicture")
        .populate("channel", "name")
        .populate("transferRequest.requestedTo", "username profilePicture")
        .populate("transferRequest.requestedBy", "username profilePicture")
        .sort({ dueDate: 1, priority: -1, createdAt: -1 })
        .lean();

    return { tasks };
}

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

    
    if (!title || !workspaceId) {
        const error = new Error('Title and workspace ID required');
        error.statusCode = 400;
        throw error;
    }

    
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    
    const workspace = await _validateWorkspaceMember(userId, workspaceId);

    
    
    
    const taskDefinitions = [];

    if (assignmentType === "self") {
        
        taskDefinitions.push({
            assignedTo: [userId],
            visibility: "private",
            channel: null
        });
    }
    else if (assignmentType === "individual") {
        
        if (!assignedToIds || assignedToIds.length === 0) {
            const error = new Error('Please select at least one assignee');
            error.statusCode = 400;
            throw error;
        }

        
        for (const assigneeId of assignedToIds) {
            if (!workspace.isMember(assigneeId)) {
                const error = new Error(`User ${assigneeId} is not a workspace member`);
                error.statusCode = 400;
                throw error;
            }
        }

        if (taskMode === 'split' && assignedToIds.length > 1) {
            
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
    else if (assignmentType === "channel") {
        
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

        
        
        const memberIds = (assignedToIds && assignedToIds.length > 0)
            ? assignedToIds
            : channel.members.map(m => m.user ? m.user.toString() : m.toString());

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

    
    
    
    const createdTasks = [];

    for (const def of taskDefinitions) {
        
        let issueKey = null;
        try {
            const ws = await Workspace.findById(workspaceId).lean();
            issueKey = await IssueKeyCounter.nextKey(workspaceId, ws?.name || 'TSK');
        } catch (keyErr) {
            console.warn('[ISSUE_KEY] Failed to generate key:', keyErr.message);
        }

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
            labels: Array.isArray(taskData.labels) ? taskData.labels : [],
            source: source || 'manual',
            type: type || 'task',
            issueKey
        });

        await task.save();
        createdTasks.push(task);

        
        
        
        
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

        
        
        
        try {
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
                if (io) io.to(`channel:${task.channel}`).emit("new-message", msg);
            } else {
                
                const creator = await User.findById(userId).select('username email').lean();
                const assignerUsername = creator?.username || 'Someone';

                for (const assigneeId of task.assignedTo) {
                    if (assigneeId.toString() === userId.toString()) continue;
                    const assignee = await User.findById(assigneeId).select('email').lean();
                    notifEmitter.emit('task.assigned', {
                        io,
                        assigneeId: assigneeId.toString(),
                        assignerUsername,
                        workspaceId: task.workspace?.toString(),
                        taskTitle: task.title,
                        taskId: task._id?.toString(),
                        assigneeEmail: assignee?.email || null,
                    });
                }
            }
        } catch (noteErr) {
            console.error("Notification Error:", noteErr);
        }
    }

    
    
    
    const populatedTasks = await Promise.all(createdTasks.map(t =>
        Task.findById(t._id)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture")
            .populate("channel", "name")
    ));

    
    
    
    
    if (io) {
        populatedTasks.forEach(task => {
            if (task.visibility === "workspace") {
                io.to(`workspace_${workspaceId}`).emit("task-created", task);
            } else if (task.visibility === "channel" && task.channel) {
                io.to(`channel:${task.channel._id || task.channel}`).emit("task-created", task);
            } else {
                
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

async function updateTask(userId, taskId, updates, io, req) {
    const task = await Task.findById(taskId);
    if (!task || task.deleted) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    const workspace = await Workspace.findById(task.workspace);
    if (!workspace) {
        const error = new Error('Workspace for this task not found');
        error.statusCode = 404;
        throw error;
    }

    if (!workspace.isMember(userId)) {
        const error = new Error('Access denied');
        error.statusCode = 403;
        throw error;
    }

    
    const isManager = await policy.isWorkspaceManager(userId, task.workspace);

    const changes = []; 

    
    
    
    if (updates.status && updates.status !== task.status) {
        
        if (!policy.canChangeStatus(task, userId, isManager)) {
            const error = new Error('Only assignees or workspace managers can change task status');
            error.statusCode = 403;
            throw error;
        }

        
        if (!isValidTransition(task.status, updates.status)) {
            const error = new Error(`Invalid status transition from "${task.status}" to "${updates.status}"`);
            error.statusCode = 400;
            error.allowedTransitions = getAllowedTransitions(task.status);
            throw error;
        }

        
        if (updates.status === 'blocked') {
            const validation = validateBlocked(updates.status, updates.blockedReason);
            if (!validation.valid) {
                const error = new Error(validation.error);
                error.statusCode = 400;
                throw error;
            }
        }

        
        changes.push({
            action: 'status_changed',
            field: 'status',
            from: task.status,
            to: updates.status,
            metadata: updates.blockedReason ? { reason: updates.blockedReason } : {}
        });

        task.previousStatus = task.status;
        task.status = updates.status;

        
        if (updates.status === 'blocked') {
            task.blockedBy = userId;
            task.blockedAt = new Date();
            task.blockedReason = updates.blockedReason;
        } else if (task.blockedReason && updates.status !== 'blocked') {
            
            changes.push({
                action: 'unblocked',
                field: 'status',
                from: task.status,
                to: updates.status
            });
            task.blockedBy = null;
            task.blockedAt = null;
            task.blockedReason = null;
        }

        
        if (updates.status === 'done' && task.status !== 'done') {
            task.completedBy = userId;
            task.completedAt = new Date();
            if (updates.completionNote) {
                task.completionNote = updates.completionNote;
            }

            
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
                    if (io) {
                        io.to(`channel:${task.channel}`).emit("new-message", msg);
                    }
                } catch (msgErr) {
                    console.error("Failed to send completion message:", msgErr);
                }
            }
        }
    }

    
    
    
    if (updates.assignedTo !== undefined) {
        if (!policy.canManageAssignees(task, userId, isManager)) {
            const error = new Error('Only task creator or workspace managers can manage assignees');
            error.statusCode = 403;
            throw error;
        }

        const oldAssignees = task.assignedTo.map(id => id.toString());
        const newAssignees = Array.isArray(updates.assignedTo)
            ? updates.assignedTo.map(id => id.toString())
            : [updates.assignedTo.toString()];

        
        const added = newAssignees.filter(id => !oldAssignees.includes(id));
        const removed = oldAssignees.filter(id => !newAssignees.includes(id));

        
        added.forEach(assigneeId => {
            changes.push({
                action: 'assignee_added',
                field: 'assignedTo',
                to: assigneeId
            });
        });

        removed.forEach(assigneeId => {
            changes.push({
                action: 'assignee_removed',
                field: 'assignedTo',
                from: assigneeId
            });
        });

        task.assignedTo = newAssignees;

        
        if (io && removed.length > 0) {
            removed.forEach(assigneeId => {
                io.to(`user_${assigneeId}`).emit("task-removed", {
                    taskId: task._id,
                    reason: "reassigned"
                });
            });
        }

        if (io && added.length > 0) {
            const populatedTask = await Task.findById(task._id)
                .populate("createdBy", "username profilePicture")
                .populate("assignedTo", "username profilePicture")
                .populate("channel", "name");

            added.forEach(assigneeId => {
                io.to(`user_${assigneeId}`).emit("task-assigned", populatedTask);
            });
        }
    }

    
    
    
    const editableFields = ['title', 'description', 'priority', 'dueDate', 'tags',
        'storyPoints', 'estimatedHours', 'actualHours', 'resolution'];

    for (const field of editableFields) {
        if (updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(task[field])) {
            if (!policy.canEditTask(task, userId, isManager)) {
                const error = new Error('Only task creator or workspace managers can edit task details');
                error.statusCode = 403;
                throw error;
            }

            changes.push({
                action: 'updated',
                field,
                from: task[field],
                to: updates[field]
            });

            task[field] = updates[field];
        }
    }

    
    await task.save();

    
    
    
    
    for (const change of changes) {
        await TaskActivity.create({
            task: task._id,
            user: userId,
            action: change.action,
            field: change.field,
            from: change.from,
            to: change.to,
            metadata: change.metadata || {},
            ipAddress: req?.ip,
            userAgent: req?.get('user-agent')
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

    
    
    
    
    if (io) {
        task.assignedTo.forEach(assigneeId => {
            io.to(`user_${assigneeId.toString()}`).emit("task-updated", populatedTask);
        });

        if (task.visibility === "workspace") {
            io.to(`workspace_${task.workspace}`).emit("task-updated", populatedTask);
        } else if (task.visibility === "channel" && task.channel) {
            io.to(`channel:${task.channel}`).emit("task-updated", populatedTask);
        }
    }

    return {
        message: "Task updated successfully",
        task: populatedTask
    };
}

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

    
    
    
    if (isCreator || isWorkspaceAdmin) {
        
        task.deleted = true;
        await task.save();

        
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
                    io.to(`channel:${task.channel}`).emit("new-message", msg);
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

        
        if (io) {
            if (task.visibility === "workspace") {
                io.to(`workspace_${task.workspace}`).emit("task-deleted", { taskId });
            } else if (task.visibility === "channel" && task.channel) {
                io.to(`channel:${task.channel}`).emit("task-deleted", { taskId });
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
        
        if (!task.deletedFor) {
            task.deletedFor = [];
        }

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

        return { message: "Task removed from your view" };
    }
}

async function getMyTasks(userId, filters) {
    const { status, priority } = filters;

    
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    const query = {
        assignedTo: userId,
        company: user.companyId,
        deleted: false, 
        deletedFor: { $ne: userId } 
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

    return { tasks };
}

async function restoreTask(userId, taskId, req) {
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    const workspace = await Workspace.findById(task.workspace);
    const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;

    
    const canRestore = task.createdBy.toString() === userId || isWorkspaceAdmin;
    if (!canRestore) {
        const error = new Error('Only task creator or workspace admin can restore tasks');
        error.statusCode = 403;
        throw error;
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

    return {
        message: "Task restored successfully",
        task: populatedTask
    };
}

async function permanentDeleteTask(userId, taskId, req) {
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    const workspace = await Workspace.findById(task.workspace);
    const isWorkspaceAdmin = workspace ? workspace.isAdminOrOwner(userId) : false;

    
    const canDelete = task.createdBy.toString() === userId || isWorkspaceAdmin;
    if (!canDelete) {
        const error = new Error('Only task creator or workspace admin can permanently delete tasks');
        error.statusCode = 403;
        throw error;
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

    return { message: "Task permanently deleted" };
}

async function revokeTask(userId, taskId, req) {
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    
    if (task.createdBy.toString() !== userId) {
        const error = new Error('Only the task creator can revoke tasks');
        error.statusCode = 403;
        throw error;
    }

    
    task.revokedAt = new Date();
    task.revokedBy = userId;

    
    const previousAssignees = [...task.assignedTo];
    task.assignedTo = [userId];

    
    if (task.status === 'done') {
        task.status = 'todo';
    }

    await task.save();

    
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

async function requestTransfer(userId, taskId, newAssigneeId, note, io, req) {
    if (!newAssigneeId) {
        const error = new Error('New assignee ID is required');
        error.statusCode = 400;
        throw error;
    }

    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    
    const isAssignee = task.assignedTo.some(id => id.toString() === userId);
    if (!isAssignee) {
        const error = new Error('Only the task assignee can request a transfer');
        error.statusCode = 403;
        throw error;
    }

    
    task.transferRequest = {
        requestedBy: userId,
        requestedTo: newAssigneeId,
        requestedAt: new Date(),
        status: 'pending',
        note: note || ''
    };

    await task.save();

    
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

    
    if (io) {
        const updatedTask = await Task.findById(taskId)
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture")
            .populate("transferRequest.requestedTo", "username profilePicture")
            .populate("transferRequest.requestedBy", "username profilePicture");

        io.to(`user_${task.createdBy}`).emit("task-updated", updatedTask);
    }

    return {
        message: "Transfer request submitted. Waiting for creator's approval.",
        transferRequest: task.transferRequest
    };
}

async function handleTransferRequest(userId, taskId, action, io, req) {
    if (!['approve', 'reject'].includes(action)) {
        const error = new Error("Invalid action. Use 'approve' or 'reject'");
        error.statusCode = 400;
        throw error;
    }

    const task = await Task.findById(taskId)
        .populate("transferRequest.requestedBy", "username")
        .populate("transferRequest.requestedTo", "username");

    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    
    if (task.createdBy.toString() !== userId) {
        const error = new Error('Only the task creator can approve or reject transfer requests');
        error.statusCode = 403;
        throw error;
    }

    
    if (!task.transferRequest || task.transferRequest.status !== 'pending') {
        const error = new Error('No pending transfer request found for this task');
        error.statusCode = 400;
        throw error;
    }

    if (action === 'approve') {
        
        const requestedTo = task.transferRequest.requestedTo;
        if (!requestedTo) {
            const error = new Error('Cannot approve request: Target user not found or deleted');
            error.statusCode = 400;
            throw error;
        }

        
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

        
        if (io) {
            const populatedTask = await Task.findById(task._id)
                .populate("createdBy", "username profilePicture")
                .populate("assignedTo", "username profilePicture")
                .populate("transferRequest.requestedTo", "username profilePicture")
                .populate("transferRequest.requestedBy", "username profilePicture");

            
            if (newAssigneeId) {
                io.to(`user_${newAssigneeId}`).emit("task-assigned", populatedTask);
            }

            
            const requester = task.transferRequest.requestedBy;
            if (requester) {
                const requesterId = requester._id || requester;
                io.to(`user_${requesterId}`).emit("task-removed", {
                    taskId: task._id,
                    reason: "reassigned"
                });
            }

            
            io.to(`user_${userId}`).emit("task-updated", populatedTask);
        }

        return {
            message: "Transfer request approved. Task has been reassigned.",
            task: await Task.findById(task._id)
                .populate("createdBy", "username profilePicture")
                .populate("assignedTo", "username profilePicture")
        };
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

        
        if (io) {
            const populatedTask = await Task.findById(task._id)
                .populate("createdBy", "username profilePicture")
                .populate("assignedTo", "username profilePicture")
                .populate("transferRequest.requestedTo", "username profilePicture")
                .populate("transferRequest.requestedBy", "username profilePicture");

            const requester = task.transferRequest.requestedBy;
            if (requester) {
                const requesterId = requester._id || requester;
                io.to(`user_${requesterId}`).emit("task-updated", populatedTask);
            }
        }

        return {
            message: "Transfer request rejected. Task remains with current assignee."
        };
    }
}

async function createSubtask(userId, parentId, subtaskData, io, req) {
    const { title, description, assignedTo = [], priority, dueDate, tags } = subtaskData;

    if (!title) {
        const error = new Error('Subtask title is required');
        error.statusCode = 400;
        throw error;
    }

    
    const parentTask = await Task.findById(parentId);
    if (!parentTask || parentTask.deleted) {
        const error = new Error('Parent task not found');
        error.statusCode = 404;
        throw error;
    }

    
    if (parentTask.type === 'subtask') {
        const error = new Error('Cannot create subtask under another subtask. Please create it under the parent task.');
        error.statusCode = 400;
        throw error;
    }

    
    const isManager = await policy.isWorkspaceManager(userId, parentTask.workspace);

    
    if (!policy.canAddSubtask(parentTask, userId, isManager)) {
        const error = new Error('Only task creator, assignees, or workspace managers can add subtasks');
        error.statusCode = 403;
        throw error;
    }

    
    const subtask = new Task({
        type: 'subtask',
        parentTask: parentId,
        workspace: parentTask.workspace,
        company: parentTask.company,
        project: parentTask.project,
        title,
        description: description || '',
        createdBy: userId,
        assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
        status: 'todo',
        priority: priority || parentTask.priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags || [],
        visibility: parentTask.visibility,
        channel: parentTask.channel,
        epic: parentTask.type === 'epic' ? parentId : parentTask.epic,
        source: 'manual'
    });

    await subtask.save();

    
    if (!parentTask.subtasks) parentTask.subtasks = [];
    parentTask.subtasks.push(subtask._id);
    await parentTask.save();

    
    await TaskActivity.create({
        task: parentId,
        user: userId,
        action: 'subtask_added',
        metadata: {
            subtaskId: subtask._id,
            subtaskTitle: title
        },
        ipAddress: req?.ip,
        userAgent: req?.get('user-agent')
    });

    await TaskActivity.create({
        task: subtask._id,
        user: userId,
        action: 'created',
        metadata: { parentTaskId: parentId },
        ipAddress: req?.ip,
        userAgent: req?.get('user-agent')
    });

    
    const populatedSubtask = await Task.findById(subtask._id)
        .populate('createdBy', 'username profilePicture')
        .populate('assignedTo', 'username profilePicture')
        .populate('parentTask', 'title');

    
    if (io) {
        const stakeholders = new Set([
            parentTask.createdBy.toString(),
            ...parentTask.assignedTo.map(id => id.toString()),
            ...subtask.assignedTo.map(id => id.toString())
        ]);
        stakeholders.forEach(stakeholderId => {
            io.to(`user_${stakeholderId}`).emit('subtask-created', {
                subtask: populatedSubtask,
                parentTaskId: parentId
            });
        });
    }

    return {
        message: "Subtask created successfully",
        subtask: populatedSubtask
    };
}

async function getTaskActivity(userId, taskId, pagination = {}) {
    const { limit = 50, offset = 0 } = pagination;

    
    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }

    
    const workspace = await Workspace.findById(task.workspace);
    if (!workspace || !workspace.isMember(userId)) {
        const error = new Error('Access denied');
        error.statusCode = 403;
        throw error;
    }

    
    const userChannels = await _getUserChannels(userId, task.workspace);
    if (!task.canView(userId, userChannels.map(id => id.toString()))) {
        const error = new Error("You don't have permission to view this task");
        error.statusCode = 403;
        throw error;
    }

    
    const activities = await TaskActivity.find({ task: taskId })
        .populate('user', 'username profilePicture')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean();

    
    const total = await TaskActivity.countDocuments({ task: taskId });

    return {
        activities,
        pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + parseInt(limit)) < total
        }
    };
}

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

async function _getUserChannels(userId, workspaceId) {
    const userChannels = await Channel.find({
        workspace: new mongoose.Types.ObjectId(workspaceId),
        "members.user": new mongoose.Types.ObjectId(userId)
    }).distinct('_id');

    return userChannels;
}

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

    
    if (includeDeleted !== "true") {
        query.deleted = false;
    }

    
    query.deletedFor = { $ne: userId };

    return query;
}

async function addLink(userId, taskId, { linkedTaskId, linkType }) {
    const INVERSE = {
        blocks: 'is_blocked_by',
        is_blocked_by: 'blocks',
        duplicates: 'is_duplicated_by',
        is_duplicated_by: 'duplicates',
        relates_to: 'relates_to'
    };

    const [task, linked] = await Promise.all([
        Task.findById(taskId),
        Task.findById(linkedTaskId)
    ]);
    if (!task || !linked) {
        const e = new Error('Task not found'); e.statusCode = 404; throw e;
    }

    
    const alreadyLinked = task.linkedIssues.some(
        l => l.task.toString() === linkedTaskId && l.linkType === linkType
    );
    if (!alreadyLinked) {
        task.linkedIssues.push({ task: linkedTaskId, linkType, createdBy: userId });
        await task.save();
    }

    
    const inverseType = INVERSE[linkType] || 'relates_to';
    const alreadyInverse = linked.linkedIssues.some(
        l => l.task.toString() === taskId && l.linkType === inverseType
    );
    if (!alreadyInverse) {
        linked.linkedIssues.push({ task: taskId, linkType: inverseType, createdBy: userId });
        await linked.save();
    }

    const populated = await Task.findById(taskId)
        .populate('linkedIssues.task', 'title issueKey status priority type')
        .lean();
    return { task: populated };
}

async function removeLink(userId, taskId, linkId) {
    const task = await Task.findById(taskId);
    if (!task) { const e = new Error('Task not found'); e.statusCode = 404; throw e; }

    const link = task.linkedIssues.id(linkId);
    if (!link) { const e = new Error('Link not found'); e.statusCode = 404; throw e; }

    
    const INVERSE = {
        blocks: 'is_blocked_by', is_blocked_by: 'blocks',
        duplicates: 'is_duplicated_by', is_duplicated_by: 'duplicates',
        relates_to: 'relates_to'
    };
    try {
        const other = await Task.findById(link.task);
        if (other) {
            const inverseType = INVERSE[link.linkType] || 'relates_to';
            other.linkedIssues = other.linkedIssues.filter(
                l => !(l.task.toString() === taskId && l.linkType === inverseType)
            );
            await other.save();
        }
    } catch { }

    task.linkedIssues.pull(linkId);
    await task.save();
    return { message: 'Link removed' };
}

async function addWatcher(userId, taskId) {
    const task = await Task.findById(taskId);
    if (!task) { const e = new Error('Task not found'); e.statusCode = 404; throw e; }
    if (!task.watchers.map(id => id.toString()).includes(userId)) {
        task.watchers.push(userId);
        await task.save();
    }
    return { watchers: task.watchers };
}

async function removeWatcher(userId, taskId) {
    const task = await Task.findById(taskId);
    if (!task) { const e = new Error('Task not found'); e.statusCode = 404; throw e; }
    task.watchers = task.watchers.filter(id => id.toString() !== userId);
    await task.save();
    return { watchers: task.watchers };
}

async function addDependency(userId, taskId, dependencyTaskId) {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(dependencyTaskId)) {
        const e = new Error('Invalid dependencyTaskId'); e.statusCode = 400; throw e;
    }
    if (taskId === dependencyTaskId) {
        const e = new Error('A task cannot depend on itself'); e.statusCode = 400; throw e;
    }

    const [task, depTask] = await Promise.all([
        Task.findById(taskId),
        Task.findById(dependencyTaskId)
    ]);
    if (!task) { const e = new Error('Task not found'); e.statusCode = 404; throw e; }
    if (!depTask) { const e = new Error('Dependency task not found'); e.statusCode = 404; throw e; }

    
    const isAllowed = task.createdBy.toString() === userId ||
        task.assignedTo.some(id => id.toString() === userId);
    if (!isAllowed) { const e = new Error('Access denied'); e.statusCode = 403; throw e; }

    const depStr = dependencyTaskId.toString();
    if (!task.dependencies.map(id => id.toString()).includes(depStr)) {
        task.dependencies.push(dependencyTaskId);
        await task.save();
    }
    return { dependencies: task.dependencies };
}

async function startTimer(userId, taskId) {
    const task = await Task.findById(taskId);
    if (!task) { const e = new Error('Task not found'); e.statusCode = 404; throw e; }

    
    const hasOpenSession = task.timeTracking.sessions.some(s => s.start && !s.end);
    if (hasOpenSession) {
        const e = new Error('A timer session is already running. Stop it first.'); e.statusCode = 400; throw e;
    }

    task.timeTracking.sessions.push({ start: new Date(), end: null });
    await task.save();
    return { message: 'Timer started', timeTracking: task.timeTracking };
}

async function stopTimer(userId, taskId) {
    const task = await Task.findById(taskId);
    if (!task) { const e = new Error('Task not found'); e.statusCode = 404; throw e; }

    const openSession = task.timeTracking.sessions
        .slice().reverse()
        .find(s => s.start && !s.end);

    if (!openSession) {
        const e = new Error('No active timer session found'); e.statusCode = 400; throw e;
    }

    const now = new Date();
    openSession.end = now;
    const elapsed = Math.floor((now - new Date(openSession.start)) / 1000); 
    task.timeTracking.totalTime = (task.timeTracking.totalTime || 0) + elapsed;

    await task.save();
    return { message: 'Timer stopped', elapsed, timeTracking: task.timeTracking };
}

async function getWorkload(userId, workspaceId) {
    if (!workspaceId) {
        const e = new Error('workspaceId required'); e.statusCode = 400; throw e;
    }
    await _validateWorkspaceMember(userId, workspaceId);

    const result = await Task.aggregate([
        { $match: { workspace: new (require('mongoose').Types.ObjectId)(workspaceId), deleted: false } },
        { $unwind: '$assignedTo' },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    
    const userIds = result.map(r => r._id);
    const users = await User.find({ _id: { $in: userIds } })
        .select('username profilePicture firstName lastName')
        .lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const workload = result.map(r => ({
        userId: r._id,
        count: r.count,
        user: userMap[r._id.toString()] || null
    }));

    return { workload };
}

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
    getTaskActivity,
    addLink,
    removeLink,
    addWatcher,
    removeWatcher,
    addDependency,
    startTimer,
    stopTimer,
    getWorkload
};
