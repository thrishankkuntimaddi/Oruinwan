// server/controllers/noteController.js

const Note = require("../models/Note");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { logAction } = require("../utils/historyLogger");

/**
 * Get notes (personal or workspace)
 * GET /api/notes?workspaceId=...&type=...
 */
exports.getNotes = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, type } = req.query;

        const user = await User.findById(userId);

        const query = {
            $or: [
                { owner: userId }, // Notes owned by user
                { sharedWith: userId } // Notes shared with user
            ],
            isArchived: false
        };

        if (workspaceId) {
            query.workspace = workspaceId;

            // Verify workspace access
            const workspace = await Workspace.findById(workspaceId);
            if (!workspace || !workspace.isMember(userId)) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        if (type) {
            query.type = type;
        }

        const notes = await Note.find(query)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture")
            .sort({ isPinned: -1, updatedAt: -1 })
            .lean();

        return res.json({ notes });

    } catch (err) {
        console.error("GET NOTES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Create a note
 * POST /api/notes
 */
exports.createNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            title,
            content,
            type = "personal",
            workspaceId,
            sharedWith = [],
            tags = []
        } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }

        const user = await User.findById(userId);

        let companyId = null;
        let workspace = null;

        // Validate workspace if provided
        if (workspaceId) {
            workspace = await Workspace.findById(workspaceId);
            if (!workspace) {
                return res.status(404).json({ message: "Workspace not found" });
            }

            if (!workspace.isMember(userId)) {
                return res.status(403).json({ message: "Access denied" });
            }

            companyId = workspace.company;
        } else if (type !== "personal") {
            return res.status(400).json({
                message: "Workspace ID required for non-personal notes"
            });
        }

        const note = new Note({
            company: companyId,
            workspace: workspaceId || null,
            owner: userId,
            title,
            content: content || "",
            type,
            sharedWith,
            tags
        });

        await note.save();

        await logAction({
            userId,
            action: "note_created",
            description: `Created note: ${title}`,
            resourceType: "note",
            resourceId: note._id,
            companyId,
            metadata: { type, workspaceId },
            req
        });

        const populatedNote = await Note.findById(note._id)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture");

        return res.status(201).json({
            message: "Note created successfully",
            note: populatedNote
        });

    } catch (err) {
        console.error("CREATE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update a note
 * PUT /api/notes/:id
 */
exports.updateNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const updates = req.body;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        // Only owner can update
        if (note.owner.toString() !== userId) {
            return res.status(403).json({ message: "Only note owner can update" });
        }

        // Update allowed fields
        const allowedFields = [
            "title",
            "content",
            "sharedWith",
            "isPublic",
            "isPinned",
            "tags"
        ];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                note[field] = updates[field];
            }
        });

        await note.save();

        const populatedNote = await Note.findById(note._id)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture");

        return res.json({
            message: "Note updated successfully",
            note: populatedNote
        });

    } catch (err) {
        console.error("UPDATE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Delete/Archive a note
 * DELETE /api/notes/:id
 */
exports.deleteNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const { permanent = false } = req.query;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        if (note.owner.toString() !== userId) {
            return res.status(403).json({ message: "Only note owner can delete" });
        }

        if (permanent) {
            await Note.findByIdAndDelete(noteId);
            return res.json({ message: "Note permanently deleted" });
        } else {
            // Soft delete (archive)
            note.isArchived = true;
            note.archivedAt = new Date();
            await note.save();
            return res.json({ message: "Note archived" });
        }

    } catch (err) {
        console.error("DELETE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Share a note with users
 * POST /api/notes/:id/share
 */
exports.shareNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: "User IDs array required" });
        }

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        if (note.owner.toString() !== userId) {
            return res.status(403).json({ message: "Only note owner can share" });
        }

        // Add users to sharedWith (avoid duplicates)
        userIds.forEach(uid => {
            if (!note.sharedWith.includes(uid)) {
                note.sharedWith.push(uid);
            }
        });

        await note.save();

        await logAction({
            userId,
            action: "note_shared",
            description: `Shared note: ${note.title}`,
            resourceType: "note",
            resourceId: note._id,
            companyId: note.company,
            metadata: { sharedWith: userIds },
            req
        });

        const populatedNote = await Note.findById(note._id)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture");

        return res.json({
            message: "Note shared successfully",
            note: populatedNote
        });

    } catch (err) {
        console.error("SHARE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
