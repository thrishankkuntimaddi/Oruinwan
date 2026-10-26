'use strict';

// Scheduled messages (send later) and the "Sent" list for the apps.
//   GET    /api/v2/scheduled-messages?workspaceId=     → { scheduled: [...] }  (mine, still to send or failed)
//   POST   /api/v2/scheduled-messages                  { workspaceId, kind, conversationId, sendAt, body }
//   PATCH  /api/v2/scheduled-messages/:id              { sendAt }
//   DELETE /api/v2/scheduled-messages/:id
//   POST   /api/v2/scheduled-messages/:id/send-now
//   GET    /api/v2/scheduled-messages/sent?workspaceId= → { messages: [...] }  (my latest top-level messages)
// `body` is the send endpoint's body with the text already encrypted on the sender's device.

const mongoose = require('mongoose');
const ScheduledMessage = require('../../../models/ScheduledMessage');
const Channel = require('../channels/channel.model.js');
const DMSession = require('../../../models/DMSession');
const logger = require('../../../utils/logger');

const MAX_PENDING = 50;
const MIN_LEAD_MS = 20 * 1000;
const MAX_LEAD_MS = 366 * 24 * 60 * 60 * 1000;
// Fields of the send body a scheduled message may carry (nothing that names another sender).
const BODY_FIELDS = ['ciphertext', 'messageIv', 'keyVersion', 'isEncrypted', 'type', 'attachments', 'quotedMessageId', 'mentionText', 'linkPreview', 'checklistCount'];

function fail(status, message, code) {
    return Object.assign(new Error(message), { statusCode: status, ...(code ? { code } : {}) });
}

const shape = (s) => ({
    id: String(s._id),
    kind: s.kind,
    conversationId: String(s.conversation),
    sendAt: s.sendAt,
    status: s.status,
    error: s.error || null,
    createdAt: s.createdAt,
    // The encrypted text, for the sender's own app to show what will be sent.
    body: { ciphertext: s.body?.ciphertext || null, messageIv: s.body?.messageIv || null, keyVersion: s.body?.keyVersion ?? null, type: s.body?.type || 'message', attachments: s.body?.attachments || [] },
});

async function canPost(userId, workspaceId, kind, id) {
    if (kind === 'channel') return Boolean(await Channel.exists({ _id: id, workspace: workspaceId, 'members.user': userId }));
    return Boolean(await DMSession.exists({ _id: id, workspace: workspaceId, participants: userId }));
}

function cleanBody(body) {
    const out = {};
    for (const k of BODY_FIELDS) if (body && body[k] !== undefined) out[k] = body[k];
    if (!out.type) out.type = 'message';
    if (out.type === 'message' && (!out.ciphertext || !out.messageIv)) throw fail(400, 'Scheduled text must be encrypted');
    return out;
}

function checkTime(sendAt, now = Date.now()) {
    const t = new Date(sendAt).getTime();
    if (!Number.isFinite(t)) throw fail(400, 'Pick a time to send it');
    if (t < now + MIN_LEAD_MS) throw fail(400, 'Pick a time at least a minute from now');
    if (t > now + MAX_LEAD_MS) throw fail(400, 'Pick a time within a year');
    return new Date(t);
}

async function list(userId, workspaceId) {
    if (!mongoose.isValidObjectId(workspaceId)) throw fail(400, 'Invalid workspace');
    const rows = await ScheduledMessage.find({ user: userId, workspace: workspaceId, status: { $in: ['scheduled', 'sending', 'failed'] } })
        .sort({ sendAt: 1 })
        .lean();
    return rows.map(shape);
}

async function create(userId, { workspaceId, kind, conversationId, sendAt, body } = {}) {
    if (!['channel', 'dm'].includes(kind)) throw fail(400, 'kind must be channel or dm');
    if (!mongoose.isValidObjectId(workspaceId) || !mongoose.isValidObjectId(conversationId)) throw fail(400, 'Invalid id');
    const when = checkTime(sendAt);
    const clean = cleanBody(body);
    if (!(await canPost(userId, workspaceId, kind, conversationId))) throw fail(404, 'Conversation not found');
    const pending = await ScheduledMessage.countDocuments({ user: userId, status: 'scheduled' });
    if (pending >= MAX_PENDING) throw fail(409, `You can have up to ${MAX_PENDING} scheduled messages`, 'SCHEDULE_LIMIT');
    const doc = await ScheduledMessage.create({ user: userId, workspace: workspaceId, kind, conversation: conversationId, body: clean, sendAt: when });
    return shape(doc.toObject ? doc.toObject() : doc);
}

async function mine(userId, id) {
    if (!mongoose.isValidObjectId(id)) throw fail(404, 'Not found');
    const doc = await ScheduledMessage.findOne({ _id: id, user: userId });
    if (!doc) throw fail(404, 'Not found');
    return doc;
}

async function reschedule(userId, id, { sendAt } = {}) {
    const doc = await mine(userId, id);
    if (!['scheduled', 'failed'].includes(doc.status)) throw fail(409, 'It has already been sent');
    doc.sendAt = checkTime(sendAt);
    doc.status = 'scheduled';
    doc.error = null;
    await doc.save();
    return shape(doc.toObject());
}

async function cancel(userId, id) {
    const doc = await mine(userId, id);
    if (doc.status === 'sent') throw fail(409, 'It has already been sent');
    doc.status = 'cancelled';
    await doc.save();
    return { ok: true };
}

/** Sends one through the normal send controller, as its author. */
async function deliver(doc, io) {
    const controller = require('../../modules/messages/messages.controller');
    const body = { ...doc.body, clientMessageId: `sched-${doc._id}` };
    if (doc.kind === 'channel') body.channelId = String(doc.conversation);
    else {
        body.dmSessionId = String(doc.conversation);
        body.workspaceId = String(doc.workspace);
    }
    let status = 200;
    let payload = null;
    const req = { user: { sub: String(doc.user) }, body, params: {}, query: {}, headers: {}, app: { get: (k) => (k === 'io' ? io : undefined) } };
    const res = {
        status(code) {
            status = code;
            return this;
        },
        json(data) {
            payload = data;
            return this;
        },
        send(data) {
            payload = data;
            return this;
        },
    };
    await (doc.kind === 'channel' ? controller.sendChannelMessage : controller.sendDirectMessage)(req, res);
    if (status === 409 && payload?.code === 'KEY_ROTATED') {
        // Encrypted with a key the conversation no longer uses (someone was added or removed since).
        throw fail(409, 'The conversation changed since you scheduled this (someone was added or removed). Schedule it again.', 'KEY_ROTATED');
    }
    if (status >= 400) throw fail(status, payload?.message || 'Could not send');
    const sent = payload?.message || payload?.data || payload;
    return sent?._id || sent?.id || null;
}

async function sendNow(userId, id, io) {
    const doc = await mine(userId, id);
    if (!['scheduled', 'failed'].includes(doc.status)) throw fail(409, 'It has already been sent');
    return runOne(doc, io);
}

async function runOne(doc, io) {
    // Claim it first, so two instances (or a send-now racing the job) never send it twice.
    const claimed = await ScheduledMessage.findOneAndUpdate({ _id: doc._id, status: { $in: ['scheduled', 'failed'] } }, { $set: { status: 'sending' } }, { new: true });
    if (!claimed) return { ok: false };
    try {
        const sentId = await deliver(claimed, io);
        claimed.status = 'sent';
        claimed.sentMessageId = mongoose.isValidObjectId(String(sentId)) ? sentId : null;
        claimed.error = null;
        await claimed.save();
        if (io) io.to(`user_${claimed.user}`).to(`user:${claimed.user}`).emit('scheduled-message:sent', { id: String(claimed._id), messageId: claimed.sentMessageId ? String(claimed.sentMessageId) : null });
        return { ok: true, messageId: claimed.sentMessageId ? String(claimed.sentMessageId) : null };
    } catch (err) {
        claimed.status = 'failed';
        claimed.error = String(err.message || 'Could not send').slice(0, 300);
        await claimed.save();
        logger.warn(`[SCHEDULED] ${claimed._id} failed: ${claimed.error}`);
        if (io) io.to(`user_${claimed.user}`).to(`user:${claimed.user}`).emit('scheduled-message:failed', { id: String(claimed._id), error: claimed.error });
        return { ok: false, error: claimed.error };
    }
}

/** The job: every due message, oldest first. */
async function sendDue(io, now = new Date()) {
    const due = await ScheduledMessage.find({ status: 'scheduled', sendAt: { $lte: now } }).sort({ sendAt: 1 }).limit(100);
    for (const doc of due) await runOne(doc, io);
    return due.length;
}

/** My latest top-level messages in this workspace (encrypted; the app decrypts them). */
async function sent(userId, workspaceId, limit = 50) {
    if (!mongoose.isValidObjectId(workspaceId)) throw fail(400, 'Invalid workspace');
    const Message = require('../../modules/messages/message.model');
    const rows = await Message.find({
        workspace: workspaceId,
        sender: userId,
        parentId: null,
        type: { $ne: 'system' },
        isDeleted: { $ne: true },
        isDeletedUniversally: { $ne: true },
        hiddenFor: { $ne: userId },
    })
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 50, 100))
        .select('_id channel dm payload type attachments createdAt')
        .lean();
    return rows.map((m) => ({
        id: String(m._id),
        kind: m.channel ? 'channel' : 'dm',
        conversationId: String(m.channel || m.dm),
        type: m.type,
        payload: m.payload?.ciphertext ? { ciphertext: m.payload.ciphertext, messageIv: m.payload.messageIv } : null,
        attachments: m.attachments || [],
        at: m.createdAt,
    }));
}

module.exports = { list, create, reschedule, cancel, sendNow, sendDue, sent, checkTime, cleanBody, MAX_PENDING };
