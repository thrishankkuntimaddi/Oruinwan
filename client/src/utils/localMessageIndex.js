// Messages are end-to-end encrypted, so the server cannot search their text. This
// keeps the decrypted messages of conversations opened in this session (in memory
// only, never persisted) and answers message searches in the browser.
// Queries use the operator syntax in ./searchQuery (from:, in:, before:, has:, …).

import { parseSearchQuery, matchesMessage } from './searchQuery';

const conversations = new Map(); // conversationId -> { type, name, workspaceId, messages: Map }
const MAX_PER_CONVERSATION = 2000;

const PLACEHOLDER = /^(🔒|\[Encrypted message)/;

export function indexConversation({ id, type, name, workspaceId }, events = []) {
    if (!id) return;
    let conv = conversations.get(String(id));
    if (!conv) {
        conv = { type, name, workspaceId: workspaceId ? String(workspaceId) : null, messages: new Map() };
        conversations.set(String(id), conv);
    }
    conv.type = type || conv.type;
    conv.name = name || conv.name;
    if (workspaceId) conv.workspaceId = String(workspaceId);
    for (const e of events) {
        const msgId = String(e?.id || e?._id || '');
        if (!msgId || msgId.startsWith('temp_')) continue;
        if (e?.payload?.isDeleted || e?.isDeleted) { conv.messages.delete(msgId); continue; }
        const raw = e?.decryptedContent || e?.payload?.decryptedContent || '';
        const text = PLACEHOLDER.test(raw) ? '' : raw;
        const attachments = (e?.attachments || e?.payload?.attachments || [])
            .filter(Boolean)
            .map((a) => ({ name: a.name || a.fileName || a.filename || a.originalName || '', mimeType: a.mimeType || a.mimetype || a.contentType || '', type: a.type }));
        // Attachment-only messages are kept so has:file / has:image can find them.
        if (!text && attachments.length === 0) continue;
        const replyCount = e?.replyCount ?? e?.payload?.replyCount ?? 0;
        conv.messages.set(msgId, {
            _id: msgId,
            text,
            ...(attachments.length && { attachments }),
            ...((e?.isPinned || e?.payload?.isPinned) && { isPinned: true }),
            ...(replyCount > 0 && { replyCount }),
            sender: e.sender?.username ? { _id: e.sender._id, username: e.sender.username } : (e.payload?.sender || null),
            createdAt: e.createdAt || e.payload?.createdAt,
            // Thread replies open their thread from search.
            ...((e.parentId || e.payload?.parentId) && { threadParentId: String(e.parentId?._id || e.parentId || e.payload.parentId) }),
        });
    }
    if (conv.messages.size > MAX_PER_CONVERSATION) {
        const extra = conv.messages.size - MAX_PER_CONVERSATION;
        [...conv.messages.keys()].slice(0, extra).forEach((k) => conv.messages.delete(k));
    }
}

/**
 * Matches shaped like server message results, newest first. `query` may use the
 * operators from ./searchQuery; a query made only of operators lists every match.
 */
export function searchLocalMessages(query, workspaceId, limit = 20) {
    const raw = String(query || '').trim();
    if (!raw) return [];
    const parsed = parseSearchQuery(raw);
    const hasCriteria = parsed.terms.length || parsed.phrases.length
        || ['from', 'in', 'has', 'is'].some((k) => parsed[k].length) || parsed.before || parsed.after || parsed.on;
    if (!hasCriteria) return [];
    const out = [];
    for (const [convId, conv] of conversations) {
        if (workspaceId && conv.workspaceId && conv.workspaceId !== String(workspaceId)) continue;
        for (const m of conv.messages.values()) {
            if (!matchesMessage(parsed, m, conv)) continue;
            out.push({
                ...m,
                id: m._id,
                type: 'message',
                ...(conv.type === 'channel'
                    ? { channelId: convId, channelName: conv.name }
                    : { dmId: convId, dmName: conv.name }),
                _local: true,
            });
        }
    }
    return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

export function clearLocalMessageIndex() {
    conversations.clear();
}
