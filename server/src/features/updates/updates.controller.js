const logger = require('../../../utils/logger');
const Update = require("../../../models/Update");
const identity = require("../../identity");
const { hydrate } = require("../../identity/hydrate");

// postedBy / mentions are PostgreSQL users and workspace a PostgreSQL workspace.
const UPDATE_REFS = {
    postedBy: { type: "user", fields: ["username", "profilePicture"] },
    mentions: { type: "user", fields: ["username"] },
    workspace: { type: "workspace", fields: ["name"] },
};
const UPDATE_REFS_NO_WS = { postedBy: UPDATE_REFS.postedBy, mentions: UPDATE_REFS.mentions };

/** Lean update(s) with their people (and workspace name) attached. */
async function withRefs(query, refs = UPDATE_REFS) {
    const result = await query;
    if (result) await hydrate(result, refs);
    return result;
}
const { logAction } = require("../../../utils/historyLogger");

exports.getUpdates = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, type, priority, limit = 50 } = req.query;

        const workspace = await identity.workspaces.findById(workspaceId);
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

        const updates = await withRefs(Update.find(query)
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .lean(), UPDATE_REFS_NO_WS);

        return res.json({ updates });

    } catch (err) {
        logger.error("GET UPDATES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

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

        const workspace = await identity.workspaces.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        if (!workspace.isMember(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        
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

        const populatedUpdate = await withRefs(Update.findById(update._id).lean());

        
        if (req.io) {
            req.io.to(`company_${workspace.company}`).emit("update-created", populatedUpdate);
            
            
        }

        return res.status(201).json({
            message: "Update posted successfully",
            update: populatedUpdate
        });

    } catch (err) {
        logger.error("POST UPDATE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.updateUpdate = async (req, res) => {
    try {
        const userId = req.user.sub;
        const updateId = req.params.id;
        const updates = req.body;

        const update = await Update.findById(updateId);
        if (!update) {
            return res.status(404).json({ message: "Update not found" });
        }

        
        const workspace = await identity.workspaces.findById(update.workspace);
        const canEdit =
            update.postedBy.toString() === userId ||
            !!workspace?.isAdminOrOwner(userId);

        if (!canEdit) {
            return res.status(403).json({
                message: "Only poster or workspace admin can edit updates"
            });
        }

        
        const allowedFields = ["message", "type", "priority", "isPinned", "title"];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                update[field] = updates[field];
            }
        });

        await update.save();

        const populatedUpdate = await withRefs(Update.findById(update._id).lean());

        
        if (req.io) {
            req.io.to(`company_${update.company}`).emit("update-updated", populatedUpdate);
        }

        return res.json({
            message: "Update edited successfully",
            update: populatedUpdate
        });

    } catch (err) {
        logger.error("UPDATE UPDATE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.deleteUpdate = async (req, res) => {
    try {
        const userId = req.user.sub;
        const updateId = req.params.id;

        const update = await Update.findById(updateId);
        if (!update) {
            return res.status(404).json({ message: "Update not found" });
        }

        
        const workspace = await identity.workspaces.findById(update.workspace);
        const canDelete =
            update.postedBy.toString() === userId ||
            !!workspace?.isAdminOrOwner(userId);

        if (!canDelete) {
            return res.status(403).json({
                message: "Only poster or workspace admin can delete updates"
            });
        }

        
        update.isDeleted = true;
        await update.save();

        
        if (req.io) {
            req.io.to(`company_${update.company}`).emit("update-deleted", { updateId });
        }

        return res.json({ message: "Update deleted successfully" });

    } catch (err) {
        logger.error("DELETE UPDATE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

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

        
        const existingReaction = update.reactions.find(
            r => r.userId.toString() === userId && r.emoji === emoji
        );

        if (existingReaction) {
            
            update.reactions = update.reactions.filter(
                r => !(r.userId.toString() === userId && r.emoji === emoji)
            );
        } else {
            
            update.reactions.push({ emoji, userId });
        }

        await update.save();

        
        if (req.io) {
            const populatedUpdate = await withRefs(Update.findById(update._id).lean());
            req.io.to(`company_${update.company}`).emit("update-updated", populatedUpdate);
        }

        return res.json({
            message: existingReaction ? "Reaction removed" : "Reaction added",
            reactions: update.reactions
        });

    } catch (err) {
        logger.error("ADD REACTION ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

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
        logger.error("MARK AS READ ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.getCompanyUpdates = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { companyId } = req.params;
        const { type, priority, limit = 50 } = req.query;

        
        const user = await identity.users.findById(userId);
        if (!user || String(user.companyId) !== String(companyId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const query = {
            company: companyId,
            isDeleted: false
        };

        if (type) query.type = type;
        if (priority) query.priority = priority;

        const updates = await withRefs(Update.find(query)
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .lean());

        return res.json({ updates });

    } catch (err) {
        logger.error("GET COMPANY UPDATES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = exports;
