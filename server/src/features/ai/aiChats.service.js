'use strict';

/**
 * Saved AI panel conversations (history across devices). The app saves the whole
 * conversation after each answer; the server keeps the newest MAX_CHATS per person and
 * workspace.
 */
const AIChat = require('./aiChat.model');

const LIMITS = { messages: 200, text: 20000, title: 120, assistant: 60 };
const MAX_CHATS = 200;
const CHAT_ID = /^[A-Za-z0-9_-]{6,64}$/;

const isChatId = (id) => typeof id === 'string' && CHAT_ID.test(id);

/** Keeps only what history needs, with sane sizes. Returns null for an empty conversation. */
function cleanChat(body = {}) {
    const messages = (Array.isArray(body.messages) ? body.messages : [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({
            role: m.role,
            text: String(m.text ?? m.content ?? '').slice(0, LIMITS.text),
            at: Number.isFinite(new Date(m.at).getTime()) ? new Date(m.at) : new Date(),
        }))
        .filter((m) => m.text.trim())
        .slice(-LIMITS.messages);
    if (!messages.length) return null;
    const firstQuestion = messages.find((m) => m.role === 'user')?.text || messages[0].text;
    const title = String(body.title || '').trim() || firstQuestion.replace(/\s+/g, ' ').trim();
    return {
        title: title.slice(0, LIMITS.title),
        assistant: typeof body.assistant === 'string' && body.assistant ? body.assistant.slice(0, LIMITS.assistant) : 'default',
        messages,
    };
}

function summary(doc) {
    const last = doc.messages?.[doc.messages.length - 1];
    return {
        id: doc.chatId,
        title: doc.title,
        assistant: doc.assistant,
        messageCount: doc.messages?.length || 0,
        preview: last ? last.text.replace(/\s+/g, ' ').slice(0, 140) : '',
        updatedAt: doc.updatedAt,
    };
}

async function list(userId, workspaceId) {
    const docs = await AIChat.find({ user: userId, workspace: workspaceId })
        .sort({ updatedAt: -1 }).limit(MAX_CHATS).lean();
    return docs.map(summary);
}

async function get(userId, workspaceId, chatId) {
    const doc = await AIChat.findOne({ user: userId, workspace: workspaceId, chatId }).lean();
    return doc ? { ...summary(doc), messages: doc.messages.map(({ role, text, at }) => ({ role, text, at })) } : null;
}

async function save(userId, workspaceId, chatId, body) {
    const clean = cleanChat(body);
    if (!clean) return null;
    const doc = await AIChat.findOneAndUpdate(
        { user: userId, workspace: workspaceId, chatId },
        { $set: clean },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    await prune(userId, workspaceId);
    return summary(doc);
}

/** Drops the oldest conversations beyond MAX_CHATS. */
async function prune(userId, workspaceId) {
    const extra = await AIChat.find({ user: userId, workspace: workspaceId })
        .sort({ updatedAt: -1 }).skip(MAX_CHATS).select('_id').lean();
    if (extra.length) await AIChat.deleteMany({ _id: { $in: extra.map((d) => d._id) } });
}

async function rename(userId, workspaceId, chatId, title) {
    const clean = String(title || '').trim().slice(0, LIMITS.title);
    if (!clean) return null;
    const doc = await AIChat.findOneAndUpdate({ user: userId, workspace: workspaceId, chatId }, { $set: { title: clean } }, { new: true }).lean();
    return doc ? summary(doc) : null;
}

async function remove(userId, workspaceId, chatId) {
    const res = await AIChat.deleteOne({ user: userId, workspace: workspaceId, chatId });
    return res.deletedCount > 0;
}

async function clear(userId, workspaceId) {
    const res = await AIChat.deleteMany({ user: userId, workspace: workspaceId });
    return res.deletedCount || 0;
}

module.exports = { cleanChat, isChatId, list, get, save, rename, remove, clear, LIMITS, MAX_CHATS };
