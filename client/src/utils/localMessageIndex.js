// Messages are end-to-end encrypted, so the server cannot search their text. This
// keeps the decrypted messages of conversations opened in this session (in memory
// only, never persisted) and answers message searches in the browser.

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
        const text = e?.decryptedContent || e?.payload?.decryptedContent || '';
        if (!msgId || msgId.startsWith('temp_') || !text || PLACEHOLDER.test(text)) continue;
        if (e?.payload?.isDeleted || e?.isDeleted) { conv.messages.delete(msgId); continue; }
        conv.messages.set(msgId, {
            _id: msgId,
            text,
            sender: e.sender?.username ? { _id: e.sender._id, username: e.sender.username } : (e.payload?.sender || null),
            createdAt: e.createdAt || e.payload?.createdAt,
        });
    }
    if (conv.messages.size > MAX_PER_CONVERSATION) {
        const extra = conv.messages.size - MAX_PER_CONVERSATION;
        [...conv.messages.keys()].slice(0, extra).forEach((k) => conv.messages.delete(k));
    }
}

/** Matches shaped like server message results, newest first. */
export function searchLocalMessages(query, workspaceId, limit = 20) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const [convId, conv] of conversations) {
        if (workspaceId && conv.workspaceId && conv.workspaceId !== String(workspaceId)) continue;
        for (const m of conv.messages.values()) {
            if (!m.text.toLowerCase().includes(q)) continue;
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
