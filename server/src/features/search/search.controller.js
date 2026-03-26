// server/controllers/searchController.js
const Channel = require("../channels/channel.model.js");
const User = require("../../../models/User");
const Message = require("../messages/message.model.js");
const Workspace = require("../../../models/Workspace");
const Task = require("../../../models/Task");
const Note = require("../../../models/Note");
const WorkspaceFile = require("../files/WorkspaceFile");
const KnowledgePage = require("../knowledge/KnowledgePage");
const logger = require("../../../utils/logger");

/**
 * Universal Search - Search across channels, contacts, and messages
 * GET /api/search/universal?workspaceId=xxx&query=xxx
 */
exports.universalSearch = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, query } = req.query;

        logger.debug('🔍 [UNIVERSAL SEARCH] Request received:', { userId, workspaceId, query });

        if (!workspaceId) {
            logger.debug('🔍 [UNIVERSAL SEARCH] ERROR: No workspace ID provided');
            return res.status(400).json({ message: "Workspace ID is required" });
        }

        if (!query || query.trim().length === 0) {
            logger.debug('🔍 [UNIVERSAL SEARCH] Empty query, returning empty results');
            return res.json({ channels: [], contacts: [], messages: [] });
        }

        const searchTerm = query.trim();
        const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive search
        logger.debug('🔍 [UNIVERSAL SEARCH] Search term:', searchTerm);

        // Verify workspace exists and user has access
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            logger.debug('🔍 [UNIVERSAL SEARCH] ERROR: Workspace not found:', workspaceId);
            return res.status(404).json({ message: "Workspace not found" });
        }
        logger.debug('🔍 [UNIVERSAL SEARCH] Workspace found:', workspace.name);

        // Parallel search across all categories
        const [channels, contacts, messages, tasks, notes, files, knowledge] = await Promise.all([
            searchChannels(workspaceId, userId, searchRegex),
            searchContacts(workspaceId, userId, searchRegex),
            searchMessages(workspaceId, userId, searchRegex),
            searchTasks(workspaceId, userId, searchRegex),
            searchNotes(workspaceId, userId, searchRegex),
            searchFiles(workspaceId, searchRegex),
            searchKnowledgePages(workspaceId, searchRegex),
        ]);

        logger.debug('🔍 [UNIVERSAL SEARCH] Results:', {
            channels: channels.length,
            contacts: contacts.length,
            messages: messages.length,
            tasks: tasks.length,
            notes: notes.length,
            files: files.length,
            knowledge: knowledge.length,
        });

        return res.json({
            channels,
            contacts,
            messages,
            tasks,
            notes,
            files,
            knowledge,
            query: searchTerm
        });
    } catch (err) {
        logger.error("UNIVERSAL SEARCH ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Search contacts endpoint
 * GET /api/search/contacts?workspaceId=xxx&query=xxx
 */
exports.searchContactsHandler = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, query } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ message: "Workspace ID is required" });
        }

        const searchTerm = (query || "").trim();
        const searchRegex = new RegExp(searchTerm, "i");

        const contacts = await searchContacts(workspaceId, userId, searchRegex);
        return res.json({ contacts });
    } catch (err) {
        logger.error("SEARCH CONTACTS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Search channels by name and description
 */
async function searchChannels(workspaceId, userId, searchRegex) {
    try {
        logger.debug('🔍 [searchChannels] Starting search:', { workspaceId, userId, searchRegex: searchRegex.toString() });

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
                        { 'members.user': userId } // New format: user is a member
                    ]
                }
            ]
        })
            .select("name description isPrivate isDefault members createdAt")
            .limit(10) // Limit to 10 channel results
            .lean();

        logger.debug('🔍 [searchChannels] Found channels:', channels.length);
        if (channels.length > 0) {
            logger.debug('🔍 [searchChannels] Sample channel:', {
                name: channels[0].name,
                isPrivate: channels[0].isPrivate,
                membersType: Array.isArray(channels[0].members) ?
                    (channels[0].members[0]?.user ? 'new format (with user field)' : 'old format (direct IDs)') :
                    'unknown'
            });
        }

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
        logger.error("Search channels error:", err);
        return [];
    }
}

/**
 * Search contacts (users in the workspace)
 */
async function searchContacts(workspaceId, userId, searchRegex) {
    try {
        // Get workspace to find company ID
        const workspace = await Workspace.findById(workspaceId);

        if (!workspace) {
            return [];
        }

        // Build query — personal workspaces have no company, so search all users in the workspace members list
        let userQuery;
        if (workspace.company) {
            // Company workspace: search all users in the same company
            userQuery = {
                companyId: workspace.company, // ✅ correct field name on User model
                _id: { $ne: userId },
                $or: [
                    { username: searchRegex },
                    { name: searchRegex },
                    { email: searchRegex }
                ]
            };
        } else {
            // Personal workspace: search workspace members directly
            const memberIds = (workspace.members || []).map(m => m.user || m).filter(Boolean);
            userQuery = {
                _id: { $in: memberIds, $ne: userId },
                $or: [
                    { username: searchRegex },
                    { name: searchRegex },
                    { email: searchRegex }
                ]
            };
        }

        const contacts = await User.find(userQuery)
            .select("username name email profilePicture isOnline userStatus")
            .limit(10)
            .lean();

        return contacts.map(user => ({
            id: user._id,
            type: "contact",
            name: user.username || user.name || user.email,
            email: user.email,
            profilePicture: user.profilePicture,
            isOnline: user.isOnline || false,
            userStatus: user.userStatus || "active"
        }));

    } catch (err) {
        logger.error("Search contacts error:", err);
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
                preview: truncateText(stripMarkdown(msg.text), 120)
            };
        });
    } catch (err) {
        logger.error("Search messages error:", err);
        return [];
    }
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + "...";
}

/**
 * Strip markdown syntax for clean previews
 * Handles bold (**x** / __x__), italic (*x* / _x_), code (`x`), strikethrough (~~x~~)
 */
function stripMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')         // **bold**
        .replace(/__([^_]+)__/g, '$1')              // __bold__
        .replace(/\*([^*]+)\*/g, '$1')              // *italic*
        .replace(/_([^_]+)_/g, '$1')                // _italic_
        .replace(/~~([^~]+)~~/g, '$1')              // ~~strike~~
        .replace(/`([^`]+)`/g, '$1')                // `code`
        .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) or ![img](url)
        .replace(/^#{1,6}\s/gm, '')                 // # heading
        .replace(/\n+/g, ' ')                       // newlines → space
        .trim();
}

/**
 * Extract plain text from Slate.js rich content (stored as JSON array of nodes)
 */
function plainTextFromSlate(content) {
    if (!content) return '';
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) return extractSlateText(parsed);
        } catch {
            return stripMarkdown(content);
        }
        return stripMarkdown(content);
    }
    if (Array.isArray(content)) return extractSlateText(content);
    return String(content);
}

function extractSlateText(nodes) {
    if (!Array.isArray(nodes)) return '';
    return nodes.map(node => {
        if (node.text !== undefined) return node.text;          // leaf node
        if (node.children) return extractSlateText(node.children); // element
        return '';
    }).join(' ').replace(/\s+/g, ' ').trim();
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

        // Format results — guard against null populated refs (e.g. deleted users)
        return tasks
            .filter(task => task.createdBy != null)
            .map(task => ({
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
                assignedTo: (task.assignedTo || []).filter(u => u != null).map(user => ({
                    id: user._id,
                    name: user.username,
                    profilePicture: user.profilePicture
                })),
                tags: task.tags || [],
                createdAt: task.createdAt
            }));
    } catch (err) {
        logger.error("Search tasks error:", err);
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

        // Format results — guard against null populated owner (deleted users)
        return notes
            .filter(note => note.owner != null)
            .map(note => ({
                id: note._id,
                type: "note",
                title: note.title,
                preview: truncateText(plainTextFromSlate(note.content), 120),
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
        logger.error("Search notes error:", err);
        return [];
    }
}

/**
 * Search workspace files by name, description, and tags
 */
async function searchFiles(workspaceId, searchRegex) {
    try {
        const files = await WorkspaceFile.find({
            workspaceId,
            isDeleted: false,
            $or: [
                { name: searchRegex },
                { description: searchRegex },
                { tags: searchRegex },
            ],
        })
            .select('name description mimeType size url tags createdBy createdAt')
            .populate('createdBy', 'username profilePicture')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return files.map(f => ({
            id: f._id,
            type: 'file',
            name: f.name,
            description: truncateText(f.description || '', 100),
            mimeType: f.mimeType,
            size: f.size,
            url: f.url,
            tags: f.tags || [],
            createdBy: f.createdBy
                ? { id: f.createdBy._id, name: f.createdBy.username, profilePicture: f.createdBy.profilePicture }
                : null,
            createdAt: f.createdAt,
        }));
    } catch (err) {
        logger.error('Search files error:', err);
        return [];
    }
}

/**
 * Search knowledge pages by title, content, and tags
 */
async function searchKnowledgePages(workspaceId, searchRegex) {
    try {
        const pages = await KnowledgePage.find({
            workspaceId,
            isDeleted: false,
            $or: [
                { title: searchRegex },
                { content: searchRegex },
                { tags: searchRegex },
            ],
        })
            .select('title icon content tags summary createdBy createdAt')
            .populate('createdBy', 'username profilePicture')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return pages.map(p => ({
            id: p._id,
            type: 'knowledge',
            title: p.title,
            icon: p.icon || '📄',
            snippet: truncateText((p.summary || p.content || '').replace(/[#*>`_\[\]]/g, ''), 120),
            tags: p.tags || [],
            createdBy: p.createdBy
                ? { id: p.createdBy._id, name: p.createdBy.username, profilePicture: p.createdBy.profilePicture }
                : null,
            createdAt: p.createdAt,
        }));
    } catch (err) {
        logger.error('Search knowledge pages error:', err);
        return [];
    }
}
