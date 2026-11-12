'use strict';

/**
 * Private chats (end-to-end encrypted 1:1, platform/crypto/privateBox.js).
 * The server stores device PUBLIC keys and opaque signed envelopes. It never holds a key that
 * can read a private message, unlike other conversations whose keys it keeps a sealed copy of.
 */

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const PrivateDeviceSchema = new mongoose.Schema({
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    ecdhKey: { type: String, required: true },  // base64 SPKI, P-256
    signKey: { type: String, required: true },  // base64 SPKI, P-256
    label: { type: String, default: 'Device', maxlength: 60 },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
}, { timestamps: true });
PrivateDeviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });

const PrivateChatSchema = new mongoose.Schema({
    workspace: { type: ObjectId, ref: 'Workspace', required: true, index: true },
    participants: [{ type: ObjectId, ref: 'User', required: true }],
    pairKey: { type: String, required: true, unique: true }, // "<workspace>:<idA>:<idB>", ids sorted
    createdBy: { type: ObjectId, ref: 'User' },
    lastMessageAt: { type: Date, default: null },
}, { timestamps: true });
PrivateChatSchema.index({ participants: 1, workspace: 1 });

const PrivateMessageSchema = new mongoose.Schema({
    chat: { type: ObjectId, ref: 'PrivateChat', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    senderDevice: { type: String, required: true },
    clientId: { type: String, required: true },
    envelope: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, minimize: false });
PrivateMessageSchema.index({ chat: 1, createdAt: -1 });
PrivateMessageSchema.index({ chat: 1, sender: 1, clientId: 1 }, { unique: true });

const pairKeyOf = (workspaceId, a, b) => {
    const [x, y] = [String(a), String(b)].sort();
    return `${workspaceId}:${x}:${y}`;
};

module.exports = {
    PrivateDevice: mongoose.models.PrivateDevice || mongoose.model('PrivateDevice', PrivateDeviceSchema),
    PrivateChat: mongoose.models.PrivateChat || mongoose.model('PrivateChat', PrivateChatSchema),
    PrivateMessage: mongoose.models.PrivateMessage || mongoose.model('PrivateMessage', PrivateMessageSchema),
    pairKeyOf,
};
