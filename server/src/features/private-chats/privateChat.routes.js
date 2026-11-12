'use strict';

/**
 * /api/private — private chats, end-to-end encrypted between devices (docs/PRIVATE_CHATS.md).
 *
 *   PUT    /devices/:deviceId          register this device's public keys (immutable once set)
 *   DELETE /devices/:deviceId          revoke one of my devices
 *   GET    /devices?userIds=a,b        active device keys of people I share a workspace with
 *   GET    /chats?workspaceId=         my private chats in a workspace
 *   POST   /chats                      { workspaceId, userId } → open (or create) the chat
 *   GET    /chats/:id                  one chat
 *   GET    /chats/:id/messages         ?before=<iso>&limit=50, newest first
 *   POST   /chats/:id/messages         { clientId, envelope } (idempotent per clientId)
 *   DELETE /chats/:id/messages/:mid    the sender deletes it for everyone
 *
 * Rules: both people must be active members of the chat's workspace; nobody sends while either
 * blocked the other in their DM; envelopes must come from one of the sender's own devices.
 */

const express = require('express');
const mongoose = require('mongoose');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const requireAuth = require('../../shared/middleware/auth');
const { isActiveWorkspaceMember } = require('../../modules/conversations/conversationAccess');
const DMSession = require('../../../models/DMSession');
const logger = require('../../../utils/logger');
const { PrivateDevice, PrivateChat, PrivateMessage, pairKeyOf } = require('./privateChat.models');
const { validDeviceKeys, validEnvelope, cleanEnvelope, HEX_ID, MAX_DEVICES_PER_USER } = require('./privateChat.validate');

const router = express.Router();
router.use(requireAuth);

const sid = (v) => (v == null ? null : String(v._id || v));
const isId = (v) => mongoose.isValidObjectId(String(v || '')) && /^[0-9a-f]{24}$/i.test(String(v));
const me = (req) => String(req.user.sub || req.user.id || req.user._id);
const bad = (res, status, message, code) => res.status(status).json({ message, ...(code ? { code } : {}) });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const sendLimiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    keyGenerator: (req) => req.user?.sub ?? ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many private messages at once; slow down a little.' },
});

const chatJson = (c) => ({
    id: sid(c), workspaceId: sid(c.workspace), participants: (c.participants || []).map(sid),
    createdAt: c.createdAt, lastMessageAt: c.lastMessageAt,
});
const messageJson = (m) => ({ id: sid(m), chatId: sid(m.chat), sender: sid(m.sender), envelope: m.envelope, createdAt: m.createdAt });
const deviceJson = (d) => ({ userId: sid(d.user), deviceId: d.deviceId, ecdhKey: d.ecdhKey, signKey: d.signKey, label: d.label, createdAt: d.createdAt });

async function blocked(workspaceId, a, b) {
    if (String(a) === String(b)) return false;
    const dm = await DMSession.findOne({ pairKey: DMSession.dmPairKey(workspaceId, a, b) }).select('blockedBy').lean();
    return Boolean(dm?.blockedBy?.length);
}

/** The chat if I'm in it and still in its workspace; otherwise sends the error and returns null. */
async function myChat(req, res) {
    if (!isId(req.params.id)) { bad(res, 404, 'Private chat not found'); return null; }
    const chat = await PrivateChat.findById(req.params.id).lean();
    const uid = me(req);
    if (!chat || !chat.participants.map(sid).includes(uid)) { bad(res, 404, 'Private chat not found'); return null; }
    if (!(await isActiveWorkspaceMember(chat.workspace, uid))) { bad(res, 403, 'You are no longer in this workspace', 'NOT_A_MEMBER'); return null; }
    return chat;
}

function emitTo(req, userIds, event, payload) {
    const io = req.app?.get?.('io') || require('../../socket/getIO').getIO();
    if (!io) return;
    io.to(userIds.flatMap((u) => [`user_${u}`, `user:${u}`])).emit(event, payload);
}

// ── devices ─────────────────────────────────────────────────────────────────

router.put('/devices/:deviceId', wrap(async (req, res) => {
    const { deviceId } = req.params;
    if (!HEX_ID.test(deviceId)) return bad(res, 400, 'deviceId must be 16–64 hex characters');
    const problem = validDeviceKeys(req.body);
    if (problem) return bad(res, 400, problem);
    const uid = me(req);
    const label = String(req.body.label || 'Device').slice(0, 60);
    const existing = await PrivateDevice.findOne({ user: uid, deviceId });
    if (existing) {
        if (existing.revokedAt) return bad(res, 410, 'This device was removed; it needs new keys', 'DEVICE_REVOKED');
        // Keys never change under the same id: that would let anyone swap them silently.
        if (existing.ecdhKey !== req.body.ecdhKey || existing.signKey !== req.body.signKey) return bad(res, 409, 'Device keys cannot change', 'DEVICE_KEYS_CHANGED');
        existing.lastSeenAt = new Date();
        existing.label = label;
        await existing.save();
        return res.json({ device: deviceJson(existing) });
    }
    const active = await PrivateDevice.countDocuments({ user: uid, revokedAt: null });
    if (active >= MAX_DEVICES_PER_USER) return bad(res, 409, `You can use private chats on up to ${MAX_DEVICES_PER_USER} devices. Remove one first.`, 'TOO_MANY_DEVICES');
    const d = await PrivateDevice.create({ user: uid, deviceId, ecdhKey: req.body.ecdhKey, signKey: req.body.signKey, label });
    // People I chat with privately should see the new device (their safety number changes).
    const chats = await PrivateChat.find({ participants: uid }).select('participants').lean();
    const others = [...new Set(chats.flatMap((c) => c.participants.map(sid)))].filter((u) => u !== uid);
    emitTo(req, [uid, ...others], 'private:devices', { userId: uid });
    return res.status(201).json({ device: deviceJson(d) });
}));

router.delete('/devices/:deviceId', wrap(async (req, res) => {
    const r = await PrivateDevice.updateOne({ user: me(req), deviceId: req.params.deviceId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    if (!r.modifiedCount) return bad(res, 404, 'Device not found');
    emitTo(req, [me(req)], 'private:devices', { userId: me(req) });
    return res.json({ ok: true });
}));

router.get('/devices', wrap(async (req, res) => {
    const uid = me(req);
    const ids = [...new Set(String(req.query.userIds || '').split(',').map((s) => s.trim()).filter(isId))].slice(0, 20);
    if (!ids.length) return res.json({ devices: [] });
    // Only people I have a private chat with (or myself): device lists are not a directory.
    const others = ids.filter((u) => u !== uid);
    if (others.length) {
        const chats = await PrivateChat.find({ participants: { $all: [uid] } }).select('participants').lean();
        const partners = new Set(chats.flatMap((c) => c.participants.map(sid)));
        if (others.some((u) => !partners.has(u))) return bad(res, 403, 'Open a private chat with them first');
    }
    const devices = await PrivateDevice.find({ user: { $in: ids }, revokedAt: null }).sort({ createdAt: 1 }).lean();
    return res.json({ devices: devices.map(deviceJson) });
}));

// ── chats ───────────────────────────────────────────────────────────────────

router.get('/chats', wrap(async (req, res) => {
    const uid = me(req);
    const { workspaceId } = req.query;
    if (!isId(workspaceId)) return bad(res, 400, 'workspaceId is required');
    if (!(await isActiveWorkspaceMember(workspaceId, uid))) return bad(res, 403, 'Not a member of this workspace');
    const chats = await PrivateChat.find({ workspace: workspaceId, participants: uid }).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(200).lean();
    return res.json({ chats: chats.map(chatJson) });
}));

router.post('/chats', wrap(async (req, res) => {
    const uid = me(req);
    const { workspaceId, userId } = req.body || {};
    if (!isId(workspaceId) || !isId(userId)) return bad(res, 400, 'workspaceId and userId are required');
    if (String(userId) === uid) return bad(res, 400, 'Pick someone else for a private chat');
    const [mine, theirs] = await Promise.all([isActiveWorkspaceMember(workspaceId, uid), isActiveWorkspaceMember(workspaceId, userId)]);
    if (!mine || !theirs) return bad(res, 403, 'Both people must be active members of this workspace');
    if (await blocked(workspaceId, uid, userId)) return bad(res, 403, 'You can’t chat with this person', 'BLOCKED');
    const pairKey = pairKeyOf(workspaceId, uid, userId);
    let chat = await PrivateChat.findOne({ pairKey }).lean();
    let created = false;
    if (!chat) {
        try {
            chat = (await PrivateChat.create({ workspace: workspaceId, participants: [uid, String(userId)], pairKey, createdBy: uid })).toObject();
            created = true;
        } catch (err) {
            if (err?.code !== 11000) throw err;
            chat = await PrivateChat.findOne({ pairKey }).lean(); // created at the same moment by the other side
        }
    }
    if (created) emitTo(req, [String(userId)], 'private:chat', { chat: chatJson(chat) });
    return res.status(created ? 201 : 200).json({ chat: chatJson(chat) });
}));

router.get('/chats/:id', wrap(async (req, res) => {
    const chat = await myChat(req, res);
    if (chat) res.json({ chat: chatJson(chat) });
}));

router.get('/chats/:id/messages', wrap(async (req, res) => {
    const chat = await myChat(req, res);
    if (!chat) return undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const q = { chat: chat._id };
    if (req.query.before) {
        const before = new Date(req.query.before);
        if (!Number.isNaN(before.getTime())) q.createdAt = { $lt: before };
    }
    const rows = await PrivateMessage.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ messages: rows.reverse().map(messageJson) });
}));

router.post('/chats/:id/messages', sendLimiter, wrap(async (req, res) => {
    const chat = await myChat(req, res);
    if (!chat) return undefined;
    const uid = me(req);
    const other = chat.participants.map(sid).find((p) => p !== uid);
    if (other && !(await isActiveWorkspaceMember(chat.workspace, other))) return bad(res, 403, 'They are no longer in this workspace', 'NOT_A_MEMBER');
    if (other && (await blocked(chat.workspace, uid, other))) return bad(res, 403, 'You can’t chat with this person', 'BLOCKED');
    const { clientId, envelope } = req.body || {};
    if (!HEX_ID.test(String(clientId || ''))) return bad(res, 400, 'clientId must be 16–64 hex characters');
    const myDevices = (await PrivateDevice.find({ user: uid, revokedAt: null }).select('deviceId').lean()).map((d) => d.deviceId);
    const problem = validEnvelope(envelope, { userId: uid, deviceIds: myDevices });
    if (problem) return bad(res, 400, problem, 'BAD_ENVELOPE');

    const existing = await PrivateMessage.findOne({ chat: chat._id, sender: uid, clientId }).lean();
    if (existing) return res.json({ message: messageJson(existing) });
    let m;
    try {
        m = await PrivateMessage.create({ chat: chat._id, sender: uid, senderDevice: envelope.sender.deviceId, clientId, envelope: cleanEnvelope(envelope) });
    } catch (err) {
        if (err?.code !== 11000) throw err;
        return res.json({ message: messageJson(await PrivateMessage.findOne({ chat: chat._id, sender: uid, clientId }).lean()) });
    }
    await PrivateChat.updateOne({ _id: chat._id }, { $set: { lastMessageAt: m.createdAt } });
    const payload = { message: messageJson(m) };
    emitTo(req, chat.participants.map(sid), 'private:message', payload);
    if (other) {
        // The push says nothing about the content: the server can't read it.
        require('../push/push.service').sendToUser(other, 'New private message', 'Open Oruinwan to read it.', {
            type: 'private_message', chatId: sid(chat), workspaceId: sid(chat.workspace),
        }).catch((err) => logger.warn?.('private push failed', { err: err?.message }));
    }
    return res.status(201).json(payload);
}));

router.delete('/chats/:id/messages/:mid', wrap(async (req, res) => {
    const chat = await myChat(req, res);
    if (!chat) return undefined;
    if (!isId(req.params.mid)) return bad(res, 404, 'Message not found');
    const r = await PrivateMessage.deleteOne({ _id: req.params.mid, chat: chat._id, sender: me(req) });
    if (!r.deletedCount) return bad(res, 404, 'Message not found');
    emitTo(req, chat.participants.map(sid), 'private:deleted', { chatId: sid(chat), messageId: req.params.mid });
    return res.json({ ok: true });
}));

module.exports = router;
