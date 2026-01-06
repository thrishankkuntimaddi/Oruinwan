// server/utils/aiActions.js
// Helper functions for AI-powered actions

const Channel = require('../models/Channel');
const Message = require('../models/Message');
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const mongoose = require('mongoose');

/**
 * Send a message to a specific channel
 * @param {string} channelId - Channel ID
 * @param {string} content - Message content
 * @param {string} userId - User ID who is sending (from auth)
 * @param {object} req - Express request object (for socket.io access)
 */
async function sendMessageToChannel(channelId, content, userId, req) {
    try {
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return { success: false, error: "Channel not found" };
        }

        // Check if user is a member
        if (!channel.members.some(m => m.toString() === userId)) {
            return { success: false, error: "You are not a member of this channel" };
        }

        const message = new Message({
            text: content,
            sender: userId,
            channel: channelId,
            company: channel.company,
            workspace: channel.workspace,
            senderModel: 'User'
        });

        await message.save();

        // Emit socket event if io available
        const io = req.app.get('io');
        if (io) {
            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'name email avatar');

            io.to(channelId).emit('new_channel_message', populatedMessage);
        }

        return {
            success: true,
            channelName: channel.name,
            messageId: message._id.toString(),
            content: content
        };
    } catch (error) {
        console.error('Error in sendMessageToChannel:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send the same message to all channels named "general" in user's workspaces
 * @param {string} content - Message content
 * @param {string} userId - User ID
 * @param {object} req - Express request object
 */
async function sendToAllGeneralChannels(content, userId, req) {
    try {
        const user = await User.findById(userId).populate('workspaces');

        if (!user || !user.workspaces || user.workspaces.length === 0) {
            return { success: false, error: "No workspaces found" };
        }

        const results = [];

        for (const workspace of user.workspaces) {
            // Find general channels in this workspace where user is a member
            const generalChannels = await Channel.find({
                workspace: workspace._id,
                name: { $regex: /^general$/i },
                members: new mongoose.Types.ObjectId(userId)
            });

            for (const channel of generalChannels) {
                const result = await sendMessageToChannel(
                    channel._id.toString(),
                    content,
                    userId,
                    req
                );
                results.push({
                    workspace: workspace.name,
                    channel: channel.name,
                    ...result
                });
            }
        }

        const successCount = results.filter(r => r.success).length;

        if (successCount === 0) {
            return {
                success: false,
                error: "No general channels found or you don't have access to any"
            };
        }

        return {
            success: true,
            messagesSent: successCount,
            totalChannels: results.length,
            details: results
        };
    } catch (error) {
        console.error('Error in sendToAllGeneralChannels:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's channels in a workspace
 * @param {string} workspaceId - Workspace ID
 * @param {string} userId - User ID
 */
async function getUserChannels(workspaceId, userId) {
    try {
        let channels;

        if (workspaceId) {
            // Get channels for specific workspace
            channels = await Channel.find({
                workspace: workspaceId,
                members: new mongoose.Types.ObjectId(userId)
            }).select('name description isPrivate members').lean();
        } else {
            // Get all channels across all user's workspaces
            const user = await User.findById(userId).populate('workspaces');
            const workspaceIds = user.workspaces.map(w => w._id);

            channels = await Channel.find({
                workspace: { $in: workspaceIds },
                members: new mongoose.Types.ObjectId(userId)
            })
                .populate('workspace', 'name')
                .select('name description isPrivate members workspace')
                .lean();
        }

        return {
            success: true,
            count: channels.length,
            channels: channels.map(c => ({
                id: c._id.toString(),
                name: c.name,
                description: c.description,
                isPrivate: c.isPrivate,
                memberCount: c.members?.length || 0,
                workspace: c.workspace?.name || null
            }))
        };
    } catch (error) {
        console.error('Error in getUserChannels:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a task for the user
 * @param {object} taskData - Task data including title, description, dueDate, priority, userId
 */
async function createTaskForUser(taskData) {
    try {
        const { title, description, dueDate, priority, userId, workspaceId } = taskData;

        // Validate required fields
        if (!title) {
            return { success: false, error: "Task title is required" };
        }

        const task = new Task({
            title: title,
            description: description || '',
            assignedTo: [userId],
            dueDate: dueDate ? new Date(dueDate) : null,
            priority: priority || 'medium',
            status: 'todo',
            createdBy: userId,
            workspace: workspaceId || null
        });

        await task.save();

        return {
            success: true,
            taskId: task._id.toString(),
            title: task.title,
            dueDate: task.dueDate,
            priority: task.priority
        };
    } catch (error) {
        console.error('Error in createTaskForUser:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's current workspace (most recently accessed or first one)
 * @param {string} userId - User ID
 */
async function getCurrentWorkspace(userId) {
    try {
        const user = await User.findById(userId).populate('workspaces');

        if (!user || !user.workspaces || user.workspaces.length === 0) {
            return { success: false, error: "No workspaces found" };
        }

        // Return the first workspace for now
        // TODO: Track user's current/last accessed workspace
        const workspace = user.workspaces[0];

        return {
            success: true,
            workspace: {
                id: workspace._id.toString(),
                name: workspace.name
            }
        };
    } catch (error) {
        console.error('Error in getCurrentWorkspace:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendMessageToChannel,
    sendToAllGeneralChannels,
    getUserChannels,
    createTaskForUser,
    getCurrentWorkspace
};
