'use strict';

const mongoose = require('mongoose');

/**
 * One saved conversation with Oruinwan AI (or a connected assistant) from the private AI
 * panel, so the history follows the person to every device. Only its owner reads it.
 * `chatId` is chosen by the app, so a conversation can be saved before the server answers.
 */
const aiChatSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, required: true },
    chatId: { type: String, required: true },
    title: { type: String, default: '' },
    assistant: { type: String, default: 'default' },
    messages: [{
        _id: false,
        role: { type: String, enum: ['user', 'assistant'], required: true },
        text: { type: String, default: '' },
        at: { type: Date, default: Date.now },
    }],
}, { timestamps: true });

aiChatSchema.index({ user: 1, workspace: 1, chatId: 1 }, { unique: true });
aiChatSchema.index({ user: 1, workspace: 1, updatedAt: -1 });

module.exports = mongoose.models.AIChat || mongoose.model('AIChat', aiChatSchema);
