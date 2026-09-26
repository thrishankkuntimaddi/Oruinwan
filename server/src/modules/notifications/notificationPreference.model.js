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
        
        message: { type: Boolean, default: true },
        threadReply: { type: Boolean, default: true },
        task: { type: Boolean, default: true },
        meeting: { type: Boolean, default: true },
        
        email: { type: Boolean, default: false }, 
        push: { type: Boolean, default: true },   
    },
    { timestamps: true }
);

notificationPreferenceSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
