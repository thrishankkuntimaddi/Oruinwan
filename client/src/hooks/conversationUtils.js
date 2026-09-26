// Pure helpers shared by useConversation (kept separate so they are unit-testable).

export const ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function normalizeMessage(msg) {
    return {
        id: msg._id,
        type: msg.type === 'system' ? 'system'
            : msg.type === 'poll' ? 'poll'
                : msg.pollId ? 'poll'
                    : msg.type === 'contact' ? 'contact'
                        : msg.type === 'meeting' ? 'meeting'
                            : msg.type === 'checklist' ? 'checklist'
                                : ATTACHMENT_TYPES.includes(msg.type) ? msg.type
                                : 'message',
        payload: {
            ...msg,
            replyCount: msg.replyCount || 0,
            reactions: msg.reactions || [],
            isPinned: msg.isPinned || false,
            attachments: msg.attachments || [],
            attachment: ATTACHMENT_TYPES.includes(msg.type) ? (msg.attachments?.[0] || null) : undefined,
            isDeleted: msg.isDeleted || msg.deletedAt != null,
            deletedBy: msg.deletedBy || null,
            deletedByName: msg.deletedByName || null
        },
        ...((msg.type === 'poll' || msg.pollId) && { poll: msg.poll }),
        ...(msg.type === 'contact' && { contact: msg.contact }),
        ...(msg.type === 'checklist' && { checklist: msg.checklist || [] }),
        ...(msg.type === 'system' && {
            systemEvent: msg.systemEvent,
            systemData: msg.systemData,
        }),
        sender: msg.sender,
        createdAt: msg.createdAt,
        parentId: msg.parentId
    };
}

/**
 * Merge `incoming` events into `existing`, skipping ids already present
 * (in `existing` or earlier in `incoming`).
 * @param {Array} existing
 * @param {Array} incoming
 * @param {'prepend'|'append'} position
 */
export function mergeUniqueEvents(existing, incoming, position = 'append') {
    const seen = new Set(existing.map(e => e.id));
    const fresh = [];
    for (const event of incoming) {
        if (event?.id == null || seen.has(event.id)) continue;
        seen.add(event.id);
        fresh.push(event);
    }
    if (fresh.length === 0) return existing;
    return position === 'prepend' ? [...fresh, ...existing] : [...existing, ...fresh];
}

/** Newest event that has a server id (skips optimistic temp ids). */
export function newestPersistedEvent(events) {
    for (let i = events.length - 1; i >= 0; i -= 1) {
        const id = events[i]?.id;
        if (typeof id === 'string' && OBJECT_ID_RE.test(id)) return events[i];
    }
    return null;
}

/** Compare two ids that may be ObjectId-like objects, populated docs, or strings. */
export function sameId(a, b) {
    const norm = (v) => (v && typeof v === 'object' ? (v._id ?? v.id ?? null) : v);
    const x = norm(a);
    const y = norm(b);
    return x != null && y != null && String(x) === String(y);
}
