// server/models/Favorite.js
const mongoose = require("mongoose");

const FavoriteSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },

    // What is favorited
    itemType: { type: String, enum: ["channel", "dm"], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Channel or DMSession ID

    // When it was favorited
    createdAt: { type: Date, default: Date.now }
});

// Indexes for fast lookups
FavoriteSchema.index({ user: 1, workspace: 1 });
FavoriteSchema.index({ user: 1, itemType: 1, itemId: 1 }, { unique: true }); // Prevent duplicates

module.exports = mongoose.model("Favorite", FavoriteSchema);
