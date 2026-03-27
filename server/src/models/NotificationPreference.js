/**
 * NotificationPreference.js
 *
 * Per-user, per-workspace notification preferences.
 * All channels default to true (opt-out model).
 */
const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
            index: true,
        },
        // In-app notification toggles
        message: { type: Boolean, default: true },
        threadReply: { type: Boolean, default: true },
        task: { type: Boolean, default: true },
        meeting: { type: Boolean, default: true },
        // Channel toggles
        email: { type: Boolean, default: false }, // opt-in for email
        push: { type: Boolean, default: true },   // desktop push
    },
    { timestamps: true }
);

// Unique preference doc per user+workspace
notificationPreferenceSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
