// server/controllers/updateController.js

const Update = require("../../../models/Update");
const User = require("../../../models/User");
const Workspace = require("../../../models/Workspace");
const { logAction } = require("../../../utils/historyLogger");

/**
 * Get updates for a workspace
 * GET /api/updates/:workspaceId
 */
exports.getUpdates = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, type, priority, limit = 50 } = req.query;

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        if (!workspace.isMember(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const query = {
            workspace: workspaceId,
            company: workspace.company,
            isDeleted: false
        };

        if (type) query.type = type;
        if (priority) query.priority = priority;

        const updates = await Update.find(query)
            .populate("postedBy", "username profilePicture")
            .populate("mentions", "username")
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        return res.json({ updates });

    } catch (err) {
        console.error("GET UPDATES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Post a new update
 * POST /api/updates
 */
exports.postUpdate = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            workspaceId,
            message,
            type = "general",
            priority = "normal",
            mentions = [],
            attachments = [],
            title
        } = req.body;

        if (!message || !workspaceId) {
            return res.status(400).json({ message: "Message and workspace ID required" });
        }

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        if (!workspace.isMember(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Check if user can post (admins for announcements)
        if (type === "announcement") {
            if (!workspace.isAdminOrOwner(userId)) {
                return res.status(403).json({
                    message: "Only workspace admins can post announcements"
                });
            }
        }

        const update = new Update({
            company: workspace.company,
            workspace: workspaceId,
            postedBy: userId,
            title,
            message,
            type,
            priority,
            mentions,
            attachments
        });

        await update.save();

        await logAction({
            userId,
            action: "update_posted",
            description: `Posted update in ${workspace.name}`,
            resourceType: "update",
            resourceId: update._id,
            companyId: workspace.company,
            metadata: { type, priority },
            req
        });

        const populatedUpdate = await Update.findById(update._id)
            .populate("postedBy", "username profilePicture")
            .populate("mentions", "username")
            .populate("workspace", "name");

        // ✅ REAL-TIME SOCKET EMISSION (Company-wide)
        if (req.io) {
            req.io.to(`company_${workspace.company}`).emit("update-created", populatedUpdate);
            // Also emit to workspace for legacy support if needed, but client should listen to company events
            // req.io.to(`workspace_${workspaceId}`).emit("update-created", populatedUpdate);
        }

        return res.status(201).json({
            message: "Update posted successfully",
            update: populatedUpdate
        });

    } catch (err) {
        console.error("POST UPDATE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update an existing update
 * PUT /api/updates/:id
 */
exports.updateUpdate = async (req, res) => {
    try {
        const userId = req.user.sub;
        const updateId = req.params.id;
        const updates = req.body;

        const update = await Update.findById(updateId);
        if (!update) {
            return res.status(404).json({ message: "Update not found" });
        }

        // Only poster or workspace admin can edit
        const workspace = await Workspace.findById(update.workspace);
        const canEdit =
            update.postedBy.toString() === userId ||
            workspace.isAdminOrOwner(userId);

        if (!canEdit) {
            return res.status(403).json({
                message: "Only poster or workspace admin can edit updates"
            });
        }

        // Update allowed fields
        const allowedFields = ["message", "type", "priority", "isPinned", "title"];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                update[field] = updates[field];
            }
        });

        await update.save();

        const populatedUpdate = await Update.findById(update._id)
            .populate("postedBy", "username profilePicture")
            .populate("mentions", "username")
            .populate("workspace", "name");

        // ✅ REAL-TIME SOCKET EMISSION (Company-wide)
        if (req.io) {
            req.io.to(`company_${update.company}`).emit("update-updated", populatedUpdate);
        }

        return res.json({
            message: "Update edited successfully",
            update: populatedUpdate
        });

    } catch (err) {
        console.error("UPDATE UPDATE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Delete an update
 * DELETE /api/updates/:id
 */
exports.deleteUpdate = async (req, res) => {
    try {
        const userId = req.user.sub;
        const updateId = req.params.id;

        const update = await Update.findById(updateId);
        if (!update) {
            return res.status(404).json({ message: "Update not found" });
        }

        // Only poster or workspace admin can delete
        const workspace = await Workspace.findById(update.workspace);
        const canDelete =
            update.postedBy.toString() === userId ||
            workspace.isAdminOrOwner(userId);

        if (!canDelete) {
            return res.status(403).json({
                message: "Only poster or workspace admin can delete updates"
            });
        }

        // Soft delete
        update.isDeleted = true;
        await update.save();

        // ✅ REAL-TIME SOCKET EMISSION (Company-wide)
        if (req.io) {
            req.io.to(`company_${update.company}`).emit("update-deleted", { updateId });
        }

        return res.json({ message: "Update deleted successfully" });

    } catch (err) {
        console.error("DELETE UPDATE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Add reaction to update
 * POST /api/updates/:id/react
 */
exports.addReaction = async (req, res) => {
    try {
        const userId = req.user.sub;
        const updateId = req.params.id;
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ message: "Emoji required" });
        }

        const update = await Update.findById(updateId);
        if (!update) {
            return res.status(404).json({ message: "Update not found" });
        }

        // Check if already reacted with same emoji
        const existingReaction = update.reactions.find(
            r => r.userId.toString() === userId && r.emoji === emoji
        );

        if (existingReaction) {
            // Remove reaction (toggle)
            update.reactions = update.reactions.filter(
                r => !(r.userId.toString() === userId && r.emoji === emoji)
            );
        } else {
            // Add reaction
            update.reactions.push({ emoji, userId });
        }

        await update.save();

        // ✅ REAL-TIME SOCKET EMISSION (Company-wide)
        if (req.io) {
            const populatedUpdate = await Update.findById(update._id)
                .populate("postedBy", "username profilePicture")
                .populate("mentions", "username")
                .populate("workspace", "name");
            req.io.to(`company_${update.company}`).emit("update-updated", populatedUpdate);
        }

        return res.json({
            message: existingReaction ? "Reaction removed" : "Reaction added",
            reactions: update.reactions
        });

    } catch (err) {
        console.error("ADD REACTION ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Mark update as read
 * POST /api/updates/:id/read
 */
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.sub;
        const updateId = req.params.id;

        const update = await Update.findById(updateId);
        if (!update) {
            return res.status(404).json({ message: "Update not found" });
        }

        if (!update.readBy.includes(userId)) {
            update.readBy.push(userId);
            await update.save();
        }

        return res.json({ message: "Marked as read" });

    } catch (err) {
        console.error("MARK AS READ ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get updates for a company
 * GET /api/updates/company/:companyId
 */
exports.getCompanyUpdates = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { companyId } = req.params;
        const { type, priority, limit = 50 } = req.query;

        // Verify user belongs to company
        const user = await User.findById(userId);
        if (!user || user.companyId.toString() !== companyId) {
            return res.status(403).json({ message: "Access denied" });
        }

        const query = {
            company: companyId,
            isDeleted: false
        };

        if (type) query.type = type;
        if (priority) query.priority = priority;

        const updates = await Update.find(query)
            .populate("postedBy", "username profilePicture")
            .populate("mentions", "username")
            .populate("workspace", "name") // Useful for context
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        return res.json({ updates });

    } catch (err) {
        console.error("GET COMPANY UPDATES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
