const Poll = require("../models/Poll");
const Channel = require("../models/Channel");
const User = require("../models/User");

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
            return res.status(400).json({ error: "Question and options are required" });
        }

        if (options.length < 2 || options.length > 10) {
            return res.status(400).json({ error: "Poll must have between 2 and 10 options" });
        }

        // Check for duplicate options
        const uniqueOptions = new Set(options.map(opt => opt.trim().toLowerCase()));
        if (uniqueOptions.size !== options.length) {
            return res.status(400).json({ error: "Poll options must be unique" });
        }

        // Verify channel exists and user is a member
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        if (!channel.isMember(userId)) {
            return res.status(403).json({ error: "You must be a channel member to create polls" });
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

        // Populate creator info for response
        await poll.populate('createdBy', 'username email profilePicture');

        res.status(201).json({ poll });
    } catch (err) {
        console.error("Error creating poll:", err);
        res.status(500).json({ error: "Failed to create poll" });
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
            return res.status(404).json({ error: "Channel not found" });
        }

        if (!channel.isMember(userId)) {
            return res.status(403).json({ error: "You must be a channel member to view polls" });
        }

        const polls = await Poll.find({ channel: channelId, isActive: true })
            .populate('createdBy', 'username email profilePicture')
            .sort({ createdAt: -1 });

        res.json({ polls });
    } catch (err) {
        console.error("Error fetching polls:", err);
        res.status(500).json({ error: "Failed to fetch polls" });
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
            return res.status(400).json({ error: "At least one option must be selected" });
        }

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ error: "Poll not found" });
        }

        if (!poll.isActive) {
            return res.status(400).json({ error: "This poll is closed" });
        }

        // Verify user is channel member
        const channel = await Channel.findById(poll.channel);
        if (!channel || !channel.isMember(userId)) {
            return res.status(403).json({ error: "You must be a channel member to vote" });
        }

        // Validate option IDs exist
        const validOptionIds = poll.options.map(opt => opt._id.toString());
        const invalidOptions = optionIds.filter(id => !validOptionIds.includes(id));
        if (invalidOptions.length > 0) {
            return res.status(400).json({ error: "Invalid option IDs" });
        }

        // Single-choice validation
        if (poll.type === 'single' && optionIds.length > 1) {
            return res.status(400).json({ error: "Only one option allowed for single-choice polls" });
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

        res.json({ poll });
    } catch (err) {
        console.error("Error voting on poll:", err);
        res.status(500).json({ error: "Failed to vote" });
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
            return res.status(403).json({ error: "Only poll creator or channel admin can delete polls" });
        }

        await Poll.findByIdAndDelete(pollId);

        res.json({ message: "Poll deleted successfully", pollId });
    } catch (err) {
        console.error("Error deleting poll:", err);
        res.status(500).json({ error: "Failed to delete poll" });
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
            return res.status(403).json({ error: "Only poll creator or channel admin can close polls" });
        }

        poll.isActive = false;
        await poll.save();
        await poll.populate('createdBy', 'username email profilePicture');

        res.json({ poll });
    } catch (err) {
        console.error("Error closing poll:", err);
        res.status(500).json({ error: "Failed to close poll" });
    }
};
