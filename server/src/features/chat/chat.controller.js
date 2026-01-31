// server/src/features/chat/chat.controller.js
// Extracted from routes/chat.js (Phase 2D-1.2)

const User = require("../../../models/User");
const Channel = require("../../../models/Channel");

// ==================== ENDPOINTS ====================

// GET /api/chat/users - Get all users (for DM list)
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select("_id username email profilePicture");
        return res.json({ users });
    } catch (err) {

        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/chat/channels - Get all channels
exports.getChannels = async (req, res) => {
    try {
        const channels = await Channel.find().select("_id name members");
        return res.json({ channels });
    } catch (err) {

        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/chat/contacts - Get list of all contacts (all users except yourself)
exports.getContacts = async (req, res) => {
    try {
        const me = req.user.sub;

        const users = await User.find({ _id: { $ne: me } })
            .select("_id username email profilePicture");

        res.json({ contacts: users });
    } catch (err) {

        res.status(500).json({ message: "Server error" });
    }
};
