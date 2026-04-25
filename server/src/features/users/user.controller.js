const User = require("../../../models/User");
const DMSession = require("../../../models/DMSession");

exports.blockUser = async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const { userIdToBlock } = req.body;

        if (!userIdToBlock) return res.status(400).json({ message: "User ID required" });
        if (String(currentUserId) === String(userIdToBlock)) return res.status(400).json({ message: "Cannot block yourself" });

        const user = await User.findById(currentUserId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const alreadyBlocked = user.blockedUsers.some(b => String(b.userId) === String(userIdToBlock));
        if (alreadyBlocked) return res.status(400).json({ message: "User already blocked" });

        user.blockedUsers.push({ userId: userIdToBlock, blockedAt: new Date() });
        await user.save();

        const blockedUser = await User.findById(userIdToBlock).select("username email profilePicture");
        return res.json({
            message: "User blocked successfully",
            blockedUser: { _id: blockedUser._id, username: blockedUser.username, email: blockedUser.email, profilePicture: blockedUser.profilePicture }
        });
    } catch (err) {
        console.error("BLOCK USER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.unblockUser = async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const { userIdToUnblock } = req.body;

        if (!userIdToUnblock) return res.status(400).json({ message: "User ID required" });

        const user = await User.findById(currentUserId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.blockedUsers = user.blockedUsers.filter(b => String(b.userId) !== String(userIdToUnblock));
        await user.save();

        return res.json({ message: "User unblocked successfully" });
    } catch (err) {
        console.error("UNBLOCK USER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.getBlockedUsers = async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const user = await User.findById(currentUserId).select("blockedUsers").populate("blockedUsers.userId", "username email profilePicture");

        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json({
            blockedUsers: user.blockedUsers.map(b => ({
                userId: b.userId._id, username: b.userId.username, email: b.userId.email,
                profilePicture: b.userId.profilePicture, blockedAt: b.blockedAt
            }))
        });
    } catch (err) {
        console.error("GET BLOCKED USERS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.muteDM = async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const { dmId } = req.params;
        const { muted } = req.body;

        const user = await User.findById(currentUserId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (muted) {
            const alreadyMuted = user.mutedChats.some(c => c.chatId === dmId && c.chatType === "dm");
            if (!alreadyMuted) {
                user.mutedChats.push({ chatId: dmId, chatType: "dm", mutedAt: new Date() });
            }
        } else {
            user.mutedChats = user.mutedChats.filter(c => !(c.chatId === dmId && c.chatType === "dm"));
        }

        await user.save();
        return res.json({ message: muted ? "DM muted successfully" : "DM unmuted successfully", muted });
    } catch (err) {
        console.error("MUTE DM ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.deleteDM = async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const { dmId } = req.params;

        const dmSession = await DMSession.findById(dmId);
        if (!dmSession) return res.status(404).json({ message: "DM session not found" });

        const isParticipant = dmSession.participants.some(p => String(p) === String(currentUserId));
        if (!isParticipant) return res.status(403).json({ message: "Not a participant of this DM" });

        const alreadyHidden = dmSession.hiddenFor.some(h => String(h.user) === String(currentUserId));
        if (!alreadyHidden) {
            dmSession.hiddenFor.push({ user: currentUserId, hiddenAt: new Date() });
            await dmSession.save();
        }

        return res.json({ message: "DM deleted successfully" });
    } catch (err) {
        console.error("DELETE DM ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { status } = req.body;

        
        if (!['active', 'away', 'dnd'].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Must be: active, away, or dnd" });
        }

        
        const user = await User.findByIdAndUpdate(
            userId,
            { userStatus: status },
            { new: true }
        ).select('username userStatus');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        
        const io = req.app.get('io');
        if (io) {
            io.emit('user-status-changed', {
                userId,
                status,
                username: user.username
            });
        }

        return res.json({
            message: "Status updated successfully",
            status: user.userStatus
        });
    } catch (err) {
        console.error("UPDATE STATUS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkUsername = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username || !username.trim()) {
            return res.status(400).json({ message: "Username is required" });
        }

        const exists = await User.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        }).select('_id');

        return res.json({
            exists: !!exists,
            available: !exists
        });
    } catch (err) {
        console.error("CHECK USERNAME ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ message: "Email is required" });
        }

        const exists = await User.findOne({
            email: email.toLowerCase()
        }).select('_id');

        return res.json({
            exists: !!exists,
            available: !exists
        });
    } catch (err) {
        console.error("CHECK EMAIL ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.checkPhone = async (req, res) => {
    try {
        const { phone, phoneCode } = req.body;

        if (!phone || !phone.trim()) {
            return res.status(400).json({ message: "Phone number is required" });
        }

        if (!phoneCode || !phoneCode.trim()) {
            return res.status(400).json({ message: "Phone code is required" });
        }

        const exists = await User.findOne({
            phone,
            phoneCode
        }).select('_id');

        return res.json({
            exists: !!exists,
            available: !exists
        });
    } catch (err) {
        console.error("CHECK PHONE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.sub;

        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        
        if (user.userType === "company" || user.companyId) {
            return res.status(403).json({
                message: "Company users cannot delete their accounts. Please contact your administrator."
            });
        }

        
        

        
        const Message = require("../messages/message.model.js");
        const Channel = require("../channels/channel.model.js");
        const Workspace = require('../../../models/Workspace');
        const Task = require('../../../models/Task');
        const Note = require('../../../models/Note');

        console.log(`🗑️ Deleting account for user: ${user.username} (${userId})`);

        
        const deletedMessages = await Message.deleteMany({ sender: userId });
        console.log(`  Deleted ${deletedMessages.deletedCount} messages`);

        
        const updatedChannels = await Channel.updateMany(
            { 'members.user': userId },
            {
                $pull: {
                    members: { user: userId },
                    admins: userId
                }
            }
        );
        console.log(`  Removed from ${updatedChannels.modifiedCount} channels`);

        
        if (user.personalWorkspace) {
            await Workspace.findByIdAndDelete(user.personalWorkspace);
            console.log(`  Deleted personal workspace`);
        }

        
        const DMSession = require('../../../models/DMSession');
        const deletedDMs = await DMSession.deleteMany({ participants: userId });
        console.log(`  Deleted ${deletedDMs.deletedCount} DM sessions`);

        
        const deletedTasks = await Task.deleteMany({
            $or: [
                { assignedTo: userId },
                { createdBy: userId }
            ]
        });
        console.log(`  Deleted ${deletedTasks.deletedCount} tasks`);

        
        const deletedNotes = await Note.deleteMany({ createdBy: userId });
        console.log(`  Deleted ${deletedNotes.deletedCount} notes`);

        
        await user.deleteOne();
        console.log(`✅ Account deleted successfully`);

        return res.json({
            message: "Account deleted successfully",
            deleted: true
        });
    } catch (err) {
        console.error("DELETE ACCOUNT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
