/**
 * Notification.js
 * Stores per-user, per-workspace notifications for all event types.
 * Indexed for fast unread counts and paginated feeds.
 */
const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
    'mention',        // @-mentioned in a channel or DM
    'dm',             // new direct message
    'task_assigned',  // task assigned to you
    'task_comment',   // comment added to your task
    'member_joined',  // someone joined your workspace
    'channel_pinned', // message pinned in a channel you're in
    'huddle_started', // huddle started in your channel
    'schedule_created', // new meeting scheduled
    'reaction',       // someone reacted to your message
];

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
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
        type: {
            type: String,
            enum: NOTIFICATION_TYPES,
            required: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        body: {
            type: String,
            default: '',
            maxlength: 500,
        },
        // Deep-link: e.g. /workspace/xxx/channel/yyy
        link: {
            type: String,
            default: null,
        },
        // Extra data for rendering (sender avatar, channel name, etc.)
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    { timestamps: true }
);

// Compound index for fast feed queries
notificationSchema.index({ recipient: 1, workspaceId: 1, createdAt: -1 });
// Fast unread count
notificationSchema.index({ recipient: 1, workspaceId: 1, read: 1 });

// Auto-TTL: delete notifications older than 60 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
