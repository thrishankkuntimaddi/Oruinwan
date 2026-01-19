const Poll = require("../models/Poll");
const Channel = require("../models/Channel");
const User = require("../models/User");
const { sendSuccess, sendError, sendNotFound, sendForbidden, sendValidationError } = require('../src/shared/utils/responseHelper');

/**
 * Create a new poll in a channel
 * POST /api/polls
 */
exports.createPoll = async (req, res) => {
    try {
        const { channelId, question, options, type } = req.body;
        const userId = req.user.sub;

        // Validation
        if (!question || !options || !Array.isArray(options)) {
            return sendValidationError(res, ["Question and options are required"]);
        }

        if (options.length < 2 || options.length > 10) {
            return sendValidationError(res, ["Poll must have between 2 and 10 options"]);
        }

        // Check for duplicate options
        const uniqueOptions = new Set(options.map(opt => opt.trim().toLowerCase()));
        if (uniqueOptions.size !== options.length) {
            return sendValidationError(res, ["Poll options must be unique"]);
        }

        // Verify channel exists and user is a member
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        if (!channel.isMember(userId)) {
            return sendForbidden(res, "You must be a channel member to create polls");
        }

        // Create poll
        const poll = new Poll({
            channel: channelId,
            workspace: channel.workspace,
            company: channel.company,
            createdBy: userId,
            question: question.trim(),
            options: options.map(opt => ({ text: opt.trim(), votes: [] })),
            type: type || 'single'
        });

        await poll.save();

        // Create a message that references this poll (WhatsApp-style)
        const Message = require('../models/Message');
        const message = new Message({
            type: 'poll',
            sender: userId,
            channel: channelId,
            workspace: channel.workspace,
            company: channel.company,
            payload: {
                text: `📊 Poll: ${question.trim()}`,
                poll: poll._id
            }
        });

        await message.save();

        // Populate creator info for response
        await poll.populate('createdBy', 'username email profilePicture');
        await message.populate('sender', 'username email profilePicture');

        // ✅ REAL-TIME BROADCAST: Notify all channel members
        const io = req.app?.get('io');
        if (io) {
            io.to(`channel_${channelId}`).emit('new-message', {
                message,
                clientTempId: null
            });
        }

        sendSuccess(res, { poll, message }, 201);
    } catch (err) {
        console.error("Error creating poll:", err);
        sendError(res, "Failed to create poll");
    }
};

/**
 * Get all polls for a channel
 * GET /api/polls/channel/:channelId
 */
exports.getPollsByChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.sub;

        // Verify channel exists and user is a member
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return sendNotFound(res, 'Channel');
        }

        if (!channel.isMember(userId)) {
            return sendForbidden(res, "You must be a channel member to view polls");
        }

        const polls = await Poll.find({ channel: channelId, isActive: true })
            .populate('createdBy', 'username email profilePicture')
            .sort({ createdAt: -1 });

        sendSuccess(res, { polls });
    } catch (err) {
        console.error("Error fetching polls:", err);
        sendError(res, "Failed to fetch polls");
    }
};

/**
 * Vote on a poll
 * POST /api/polls/:pollId/vote
 */
exports.vote = async (req, res) => {
    try {
        const { pollId } = req.params;
        const { optionIds } = req.body; // Array of option IDs
        const userId = req.user.sub;

        if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
            return sendValidationError(res, ["At least one option must be selected"]);
        }

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ error: "Poll not found" });
        }

        if (!poll.isActive) {
            return sendValidationError(res, ["This poll is closed"]);
        }

        // Verify user is channel member
        const channel = await Channel.findById(poll.channel);
        if (!channel || !channel.isMember(userId)) {
            return sendForbidden(res, "You must be a channel member to vote");
        }

        // Validate option IDs exist
        const validOptionIds = poll.options.map(opt => opt._id.toString());
        const invalidOptions = optionIds.filter(id => !validOptionIds.includes(id));
        if (invalidOptions.length > 0) {
            return sendValidationError(res, ["Invalid option IDs"]);
        }

        // Single-choice validation
        if (poll.type === 'single' && optionIds.length > 1) {
            return sendValidationError(res, ["Only one option allowed for single-choice polls"]);
        }

        // Remove user's previous votes
        poll.options.forEach(option => {
            option.votes = option.votes.filter(voteId => voteId.toString() !== userId.toString());
        });

        // Add new votes
        optionIds.forEach(optionId => {
            const option = poll.options.find(opt => opt._id.toString() === optionId);
            if (option && !option.votes.includes(userId)) {
                option.votes.push(userId);
            }
        });

        // Update total votes
        poll.updateTotalVotes();
        await poll.save();

        // Populate for response
        await poll.populate('createdBy', 'username email profilePicture');

        sendSuccess(res, { poll });
    } catch (err) {
        console.error("Error voting on poll:", err);
        sendError(res, "Failed to vote");
    }
};

/**
 * Delete a poll (creator or channel admin only)
 * DELETE /api/polls/:pollId
 */
exports.deletePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user.sub;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ error: "Poll not found" });
        }

        // Check permissions: creator OR channel admin
        const channel = await Channel.findById(poll.channel);
        const isCreator = poll.createdBy.toString() === userId.toString();
        const isChannelAdmin = channel && channel.isAdmin(userId);

        if (!isCreator && !isChannelAdmin) {
            return sendForbidden(res, "Only poll creator or channel admin can delete polls");
        }

        await Poll.findByIdAndDelete(pollId);

        sendSuccess(res, { message: "Poll deleted successfully", pollId });
    } catch (err) {
        console.error("Error deleting poll:", err);
        sendError(res, "Failed to delete poll");
    }
};

/**
 * Close a poll (creator or channel admin only)
 * PATCH /api/polls/:pollId/close
 */
exports.closePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user.sub;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ error: "Poll not found" });
        }

        // Check permissions: creator OR channel admin
        const channel = await Channel.findById(poll.channel);
        const isCreator = poll.createdBy.toString() === userId.toString();
        const isChannelAdmin = channel && channel.isAdmin(userId);

        if (!isCreator && !isChannelAdmin) {
            return sendForbidden(res, "Only poll creator or channel admin can close polls");
        }

        poll.isActive = false;
        await poll.save();
        await poll.populate('createdBy', 'username email profilePicture');

        sendSuccess(res, { poll });
    } catch (err) {
        console.error("Error closing poll:", err);
        sendError(res, "Failed to close poll");
    }
};
