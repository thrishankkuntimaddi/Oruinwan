'use strict';

const mongoose = require('mongoose');

/**
 * When a person last read a thread (opened it or replied in it). Replies from others after
 * `readAt` are that person's unread replies in the thread (the Threads view's badges).
 */
const ThreadReadSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    readAt: { type: Date, required: true },
}, { timestamps: false });

ThreadReadSchema.index({ user: 1, thread: 1 }, { unique: true });

module.exports = mongoose.models.ThreadRead || mongoose.model('ThreadRead', ThreadReadSchema);
