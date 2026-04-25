const Channel = require('../src/features/channels/channel.model');
const Message = require('../src/features/messages/message.model');
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const mongoose = require('mongoose');

async function sendMessageToChannel(channelId, content, userId, req) {
    try {
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return { success: false, error: "Channel not found" };
        }

        
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

        
        const io = req.app.get('io');
        if (io) {
            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'name email avatar');

            io.to(`channel:${channelId}`).emit('new_channel_message', populatedMessage);
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

async function sendToAllGeneralChannels(content, userId, req) {
    try {
        const user = await User.findById(userId).populate('workspaces');

        if (!user || !user.workspaces || user.workspaces.length === 0) {
            return { success: false, error: "No workspaces found" };
        }

        const results = [];

        for (const workspace of user.workspaces) {
            
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

async function getUserChannels(workspaceId, userId) {
    try {
        let channels;

        if (workspaceId) {
            
            channels = await Channel.find({
                workspace: workspaceId,
                members: new mongoose.Types.ObjectId(userId)
            }).select('name description isPrivate members').lean();
        } else {
            
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

async function createTaskForUser(taskData) {
    try {
        const { title, description, dueDate, priority, userId, workspaceId } = taskData;

        
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

async function getCurrentWorkspace(userId) {
    try {
        const user = await User.findById(userId).populate('workspaces');

        if (!user || !user.workspaces || user.workspaces.length === 0) {
            return { success: false, error: "No workspaces found" };
        }

        
        
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
