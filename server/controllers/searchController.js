// server/controllers/searchController.js
const Channel = require("../models/Channel");
const User = require("../models/User");
const Message = require("../models/Message");
const Workspace = require("../models/Workspace");
const Task = require("../models/Task");
const Note = require("../models/Note");

/**
 * Universal Search - Search across channels, contacts, and messages
 * GET /api/search/universal?workspaceId=xxx&query=xxx
 */
exports.universalSearch = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, query } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ message: "Workspace ID is required" });
        }

        if (!query || query.trim().length === 0) {
            return res.json({ channels: [], contacts: [], messages: [] });
        }

        const searchTerm = query.trim();
        const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive search

        // Verify workspace exists and user has access
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Parallel search across all categories
        const [channels, contacts, messages, tasks, notes] = await Promise.all([
            searchChannels(workspaceId, userId, searchRegex),
            searchContacts(workspaceId, userId, searchRegex),
            searchMessages(workspaceId, userId, searchRegex),
            searchTasks(workspaceId, userId, searchRegex),
            searchNotes(workspaceId, userId, searchRegex)
        ]);

        console.log('🔍 UNIVERSAL SEARCH RESULTS:');
        console.log('Query:', searchTerm);
        console.log('WorkspaceId:', workspaceId);
        console.log('UserId:', userId);
        console.log('Channels found:', channels.length, channels);
        console.log('Contacts found:', contacts.length, contacts);
        console.log('Messages found:', messages.length, messages);
        console.log('Tasks found:', tasks.length, tasks);
        console.log('Notes found:', notes.length, notes);

        return res.json({
            channels,
            contacts,
            messages,
            tasks,
            notes,
            query: searchTerm
        });
    } catch (err) {
        console.error("UNIVERSAL SEARCH ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Search channels by name and description
 */
async function searchChannels(workspaceId, userId, searchRegex) {
    try {
        // Find channels in this workspace that match the search term
        // User must be a member or it must be a public channel
        const channels = await Channel.find({
            workspace: workspaceId,
            $or: [
                { name: searchRegex },
                { description: searchRegex }
            ],
            $and: [
                {
                    $or: [
                        { isPrivate: false }, // Public channels
                        { 'members.user': userId } // Or user is a member
                    ]
                }
            ]
        })
            .select("name description isPrivate isDefault members createdAt")
            .limit(10) // Limit to 10 channel results
            .lean();

        // Format results
        return channels.map(ch => ({
            id: ch._id,
            type: "channel",
            name: ch.name,
            description: ch.description || "",
            isPrivate: ch.isPrivate,
            isDefault: ch.isDefault,
            memberCount: ch.members?.length || 0,
            icon: ch.isPrivate ? "🔒" : "#"
        }));
    } catch (err) {
        console.error("Search channels error:", err);
        return [];
    }
}

/**
 * Search contacts (users in the workspace)
 */
async function searchContacts(workspaceId, userId, searchRegex) {
    try {
        // Get workspace to find all members
        const workspace = await Workspace.findById(workspaceId)
            .populate({
                path: "members.user",
                match: {
                    _id: { $ne: userId }, // Exclude current user
                    $or: [
                        { username: searchRegex },
                        { email: searchRegex }
                    ]
                },
                select: "username email profilePicture isOnline userStatus"
            })
            .lean();

        if (!workspace || !workspace.members) {
            return [];
        }

        // Filter out null users (those that didn't match) and format
        const contacts = workspace.members
            .filter(m => m.user != null)
            .map(m => ({
                id: m.user._id,
                type: "contact",
                name: m.user.username,
                email: m.user.email,
                profilePicture: m.user.profilePicture,
                isOnline: m.user.isOnline || false,
                userStatus: m.user.userStatus || "active"
            }))
            .slice(0, 10); // Limit to 10 contact results

        return contacts;
    } catch (err) {
        console.error("Search contacts error:", err);
        return [];
    }
}

/**
 * Search messages (limited to 3 most recent)
 */
async function searchMessages(workspaceId, userId, searchRegex) {
    try {
        // Find messages in channels where user is a member or in user's DMs
        const messages = await Message.find({
            workspace: workspaceId,
            text: searchRegex,
            $or: [
                { channel: { $exists: true } }, // Channel messages
                { dm: { $exists: true } } // DM messages
            ]
        })
            .sort({ createdAt: -1 }) // Most recent first
            .limit(3) // Only return 3 most recent
            .populate("sender", "username profilePicture")
            .populate("channel", "name isPrivate members")
            .populate({
                path: "dm",
                populate: { path: "participants", select: "username" }
            })
            .lean();

        // Filter messages based on access (user must be channel member or DM participant)
        const accessibleMessages = messages.filter(msg => {
            if (msg.channel) {
                // Check if user is a channel member
                const isMember = msg.channel.members?.some(m => {
                    const memberId = m.user ? m.user.toString() : m.toString();
                    return memberId === userId.toString();
                });
                return isMember;
            } else if (msg.dm) {
                // Check if user is a DM participant
                const isParticipant = msg.dm.participants?.some(
                    p => p._id.toString() === userId.toString()
                );
                return isParticipant;
            }
            return false;
        });

        // Format results
        return accessibleMessages.map(msg => {
            const isChannel = !!msg.channel;
            const parentName = isChannel
                ? msg.channel.name
                : msg.dm?.participants?.find(p => p._id.toString() !== userId.toString())?.username || "Unknown";

            return {
                id: msg._id,
                type: "message",
                text: msg.text,
                sender: {
                    id: msg.sender._id,
                    name: msg.sender.username,
                    profilePicture: msg.sender.profilePicture
                },
                parent: {
                    id: isChannel ? msg.channel._id : msg.dm._id,
                    type: isChannel ? "channel" : "dm",
                    name: parentName
                },
                createdAt: msg.createdAt,
                preview: truncateText(msg.text, 100)
            };
        });
    } catch (err) {
        console.error("Search messages error:", err);
        return [];
    }
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

/**
 * Search tasks by title, description, and tags
 */
async function searchTasks(workspaceId, userId, searchRegex) {
    try {
        // Find tasks in this workspace that the user can access
        const tasks = await Task.find({
            workspace: workspaceId,
            deleted: false,
            $or: [
                { title: searchRegex },
                { description: searchRegex },
                { tags: searchRegex }
            ],
            $and: [
                {
                    $or: [
                        { visibility: "workspace" }, // Workspace-visible tasks
                        { createdBy: userId }, // Created by user
                        { assignedTo: userId } // Assigned to user
                        // Note: channel-specific tasks would need channel membership check
                    ]
                }
            ]
        })
            .select("title description status priority dueDate visibility createdBy assignedTo tags createdAt")
            .populate("createdBy", "username profilePicture")
            .populate("assignedTo", "username profilePicture")
            .sort({ createdAt: -1 })
            .limit(10) // Limit to 10 task results
            .lean();

        // Format results
        return tasks.map(task => ({
            id: task._id,
            type: "task",
            title: task.title,
            description: truncateText(task.description || "", 100),
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            visibility: task.visibility,
            createdBy: {
                id: task.createdBy._id,
                name: task.createdBy.username,
                profilePicture: task.createdBy.profilePicture
            },
            assignedTo: task.assignedTo?.map(user => ({
                id: user._id,
                name: user.username,
                profilePicture: user.profilePicture
            })) || [],
            tags: task.tags || [],
            createdAt: task.createdAt
        }));
    } catch (err) {
        console.error("Search tasks error:", err);
        return [];
    }
}

/**
 * Search notes by title, content, and tags
 */
async function searchNotes(workspaceId, userId, searchRegex) {
    try {
        // Find notes in this workspace that the user can access
        const notes = await Note.find({
            workspace: workspaceId,
            isArchived: false,
            $or: [
                { title: searchRegex },
                { content: searchRegex },
                { tags: searchRegex }
            ],
            $and: [
                {
                    $or: [
                        { owner: userId }, // Owned by user
                        { isPublic: true }, // Public notes
                        { sharedWith: userId } // Shared with user
                    ]
                }
            ]
        })
            .select("title content type isPublic owner tags createdAt isPinned")
            .populate("owner", "username profilePicture")
            .sort({ isPinned: -1, createdAt: -1 }) // Pinned notes first
            .limit(10) // Limit to 10 note results
            .lean();

        // Format results
        return notes.map(note => ({
            id: note._id,
            type: "note",
            title: note.title,
            preview: truncateText(note.content || "", 100),
            noteType: note.type,
            isPublic: note.isPublic,
            isPinned: note.isPinned,
            owner: {
                id: note.owner._id,
                name: note.owner.username,
                profilePicture: note.owner.profilePicture
            },
            tags: note.tags || [],
            createdAt: note.createdAt
        }));
    } catch (err) {
        console.error("Search notes error:", err);
        return [];
    }
}
