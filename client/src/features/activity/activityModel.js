/**
 * Home → Activity: the pure part. Turns what the app already knows —
 * unread conversations (server snapshot + live `conversation:activity`),
 * per-conversation unread counts from NotificationsContext (the same numbers
 * as the rail badges) and the bell's stored notifications — into one list of
 * rows, newest first. Unit-tested in activityModel.test.js.
 *
 * A conversation record ("meta"):
 *   { type: 'dm'|'channel', id, title, avatar, userId, status, isPrivate,
 *     muted, mentioned, directMention,
 *     last: { id, senderId, senderName, senderAvatar, text, at } }
 *
 * A row:
 *   { key, kind: 'dm'|'channel'|'thread'|'notification', convType, convId,
 *     title, preview, senderName, avatar, userId, status, isPrivate,
 *     unread, mentioned, at, notificationIds, notificationType, notification }
 */

import { notificationConversation } from '../notifications/notificationPolicy';

export const ACTIVITY_FILTERS = ['all', 'mentions', 'dms'];
export const ACTIVITY_LIMIT = 8;

/** Bell types that are about a message in a conversation (folded into its row). */
const CONVERSATION_NOTIFICATION_TYPES = new Set(['dm', 'mention']);
/** Bell types that only summarise other items ("You have 3 unread…"): not listed. */
const SUMMARY_NOTIFICATION_TYPES = new Set(['digest']);

export const convKey = (type, id) => `${type}:${id}`;

const time = (v) => {
    const t = v ? new Date(v).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
};

/** A conversation record from one item of GET …/workspace/:id/activity. */
export function metaFromServerItem(item) {
    if (!item || !item.id || (item.type !== 'dm' && item.type !== 'channel')) return null;
    const last = item.lastMessage || {};
    const isDm = item.type === 'dm';
    const other = item.otherUser || {};
    return {
        type: item.type,
        id: String(item.id),
        title: isDm ? (other.username || 'Direct message') : (item.name || 'channel'),
        avatar: isDm ? (other.profilePicture || null) : null,
        userId: isDm ? (other.id || null) : null,
        status: isDm ? (other.status || 'offline') : null,
        isPrivate: !!item.isPrivate,
        muted: !!item.muted,
        mentioned: !!item.mentioned,
        directMention: !!item.mentioned,
        last: {
            id: last.id || null,
            senderId: last.senderId || (isDm ? other.id : null) || null,
            senderName: isDm ? (other.username || null) : (last.senderUsername || null),
            senderAvatar: isDm ? (other.profilePicture || null) : (last.senderAvatar || null),
            // Filled in by the client after decrypting `last.preview`.
            text: last.kindLabel || null,
            at: last.createdAt || null,
        },
    };
}

/**
 * Fold a live `conversation:activity` payload into the conversation record.
 * `text` is the decrypted preview (or null).
 */
export function metaFromActivityEvent(prev, payload, text = null) {
    const type = payload.conversationType;
    const id = String(payload.conversationId);
    const isDm = type === 'dm';
    const base = prev || {
        type, id, title: null, avatar: null, userId: null, status: null,
        isPrivate: false, muted: false, mentioned: false, directMention: false, last: {},
    };
    return {
        ...base,
        type,
        id,
        title: isDm
            ? (payload.senderUsername || base.title || 'Direct message')
            : (payload.channelName || base.title || 'channel'),
        avatar: isDm ? (payload.senderAvatar || base.avatar || null) : base.avatar,
        userId: isDm ? (payload.senderId ? String(payload.senderId) : base.userId) : base.userId,
        muted: payload.muted !== undefined ? !!payload.muted : base.muted,
        mentioned: base.mentioned || !!payload.isMention,
        directMention: base.directMention || !!(payload.isDirectMention ?? payload.isMention),
        last: {
            id: payload.messageId ? String(payload.messageId) : null,
            senderId: payload.senderId ? String(payload.senderId) : null,
            senderName: payload.senderUsername || null,
            senderAvatar: payload.senderAvatar || null,
            text: text || payload.kindLabel || null,
            at: payload.createdAt || new Date().toISOString(),
        },
    };
}

/** Forget "you were mentioned" once the conversation has been read. */
export function clearMention(meta) {
    if (!meta || (!meta.mentioned && !meta.directMention)) return meta;
    return { ...meta, mentioned: false, directMention: false };
}

function sameConversation(a, b) {
    return !!a && !!b && a.type === b.type && String(a.id) === String(b.id);
}

/**
 * Build the merged, newest-first list.
 *   conversations    Map/obj of convKey → meta
 *   unreadOf(t, id)  unread count (NotificationsContext.getUnread)
 *   mentionOf(t, id) live "@you" flag (NotificationsContext.hasMention)
 *   notifications    the bell's list (NotificationsContext.notifications)
 *   openConversation { type, id } open in the URL (never listed as unread)
 *   currentUserId    my id (notifications I triggered myself are skipped)
 *   workspaceId      notifications from other workspaces are ignored
 */
export function buildActivityRows({
    conversations, unreadOf, mentionOf, notifications = [], openConversation = null,
    currentUserId = null, workspaceId = null,
}) {
    const rows = [];
    const convRows = new Map();
    const entries = conversations instanceof Map ? [...conversations.values()] : Object.values(conversations || {});

    for (const meta of entries) {
        if (!meta || !meta.id) continue;
        if (sameConversation(meta, openConversation)) continue;
        const unread = Number(unreadOf ? unreadOf(meta.type, meta.id) : 0) || 0;
        if (unread <= 0) continue;
        const liveMention = !!(mentionOf && mentionOf(meta.type, meta.id));
        const mentioned = meta.type === 'channel' && (liveMention || !!meta.mentioned);
        // Muted conversations only surface for a direct @mention.
        if (meta.muted && !(meta.type === 'channel' && meta.directMention)) continue;
        const row = {
            key: convKey(meta.type, meta.id),
            kind: meta.type,
            convType: meta.type,
            convId: meta.id,
            title: meta.title || (meta.type === 'dm' ? 'Direct message' : 'channel'),
            preview: meta.last?.text || null,
            senderName: meta.last?.senderName || null,
            avatar: meta.type === 'dm' ? (meta.avatar || meta.last?.senderAvatar || null) : null,
            userId: meta.userId || null,
            status: meta.status || null,
            isPrivate: !!meta.isPrivate,
            unread,
            mentioned,
            at: time(meta.last?.at),
            notificationIds: [],
            notificationType: null,
            notification: null,
        };
        convRows.set(row.key, row);
        rows.push(row);
    }

    const threads = new Map();
    for (const n of notifications || []) {
        if (!n || n.read || SUMMARY_NOTIFICATION_TYPES.has(n.type)) continue;
        if (workspaceId && n.workspaceId && String(n.workspaceId) !== String(workspaceId)) continue;
        if (currentUserId && n.meta?.senderId && String(n.meta.senderId) === String(currentUserId)) continue;
        const conv = notificationConversation(n);
        if (conv && sameConversation(conv, openConversation) && n.type !== 'thread_reply') continue;
        const at = time(n.createdAt);

        if (CONVERSATION_NOTIFICATION_TYPES.has(n.type) && conv) {
            const row = convRows.get(convKey(conv.type, conv.id));
            if (row) {
                // Same message the conversation row already shows: fold it in.
                row.notificationIds.push(n._id);
                if (n.type === 'mention') row.mentioned = true;
                row.at = Math.max(row.at, at);
                continue;
            }
        }

        if (n.type === 'thread_reply') {
            const parent = n.meta?.parentMessageId ? String(n.meta.parentMessageId) : String(n._id);
            const key = `thread:${parent}`;
            const existing = threads.get(key);
            if (existing) {
                existing.unread += 1;
                existing.notificationIds.push(n._id);
                if (at > existing.at) {
                    existing.at = at;
                    existing.preview = n.body || existing.preview;
                    existing.senderName = n.meta?.senderUsername || existing.senderName;
                    existing.notification = n;
                }
                continue;
            }
            const row = {
                key,
                kind: 'thread',
                convType: conv?.type || null,
                convId: conv?.id || null,
                parentMessageId: n.meta?.parentMessageId ? String(n.meta.parentMessageId) : null,
                title: n.meta?.channelName ? `Thread in #${n.meta.channelName}` : (n.title || 'Thread reply'),
                preview: n.body || null,
                senderName: n.meta?.senderUsername || null,
                avatar: null, userId: null, status: null, isPrivate: false,
                unread: 1,
                mentioned: false,
                at,
                notificationIds: [n._id],
                notificationType: n.type,
                notification: n,
            };
            threads.set(key, row);
            rows.push(row);
            continue;
        }

        rows.push({
            key: `notif:${n._id}`,
            kind: 'notification',
            convType: conv?.type || null,
            convId: conv?.id || null,
            title: n.title || 'Notification',
            preview: n.body || null,
            senderName: null,
            avatar: n.meta?.senderAvatar || null,
            userId: n.meta?.senderId || null,
            status: null,
            isPrivate: false,
            unread: 0,
            mentioned: n.type === 'mention',
            at,
            notificationIds: [n._id],
            notificationType: n.type,
            notification: n,
        });
    }

    return sortActivityRows(rows);
}

/** Newest first; ties keep mentions and DMs ahead. */
export function sortActivityRows(rows) {
    const weight = (r) => (r.mentioned ? 2 : 0) + (r.kind === 'dm' ? 1 : 0);
    return [...rows].sort((a, b) => (b.at - a.at) || (weight(b) - weight(a)) || a.key.localeCompare(b.key));
}

/** Does `row` belong under the "All · Mentions · DMs" tab `filter`? */
export function rowMatchesFilter(row, filter) {
    if (filter === 'mentions') return !!row.mentioned || row.notificationType === 'mention';
    if (filter === 'dms') return row.kind === 'dm' || row.notificationType === 'dm';
    return true;
}

export function filterActivityRows(rows, filter) {
    return (rows || []).filter(r => rowMatchesFilter(r, filter));
}

/** Counts per tab (for the little numbers in the segmented filter). */
export function activityCounts(rows) {
    const counts = { all: 0, mentions: 0, dms: 0 };
    for (const r of rows || []) {
        counts.all += 1;
        if (rowMatchesFilter(r, 'mentions')) counts.mentions += 1;
        if (rowMatchesFilter(r, 'dms')) counts.dms += 1;
    }
    return counts;
}

/**
 * Where a row goes. `base: 'home'` keeps DMs/channels inside the Home layout
 * (desktop); otherwise the Messages / Channels routes (mobile).
 */
export function activityHref(row, workspaceId, { base = 'home', notificationHref } = {}) {
    if (!row || !workspaceId) return null;
    const convPath = (type, id) => {
        if (!type || !id) return null;
        if (type === 'dm') return base === 'home' ? `/workspace/${workspaceId}/home/dm/${id}` : `/workspace/${workspaceId}/messages/dm/${id}`;
        return base === 'home' ? `/workspace/${workspaceId}/home/channel/${id}` : `/workspace/${workspaceId}/channel/${id}`;
    };
    if (row.kind === 'dm' || row.kind === 'channel' || row.kind === 'thread') {
        return convPath(row.convType, row.convId)
            || (notificationHref && row.notification ? notificationHref(row.notification, workspaceId) : null);
    }
    if (notificationHref && row.notification) return notificationHref(row.notification, workspaceId);
    return null;
}

/** "now", "5m", "3h", "2d", or a short date. */
export function shortAgo(at, now = Date.now()) {
    if (!at) return '';
    const diff = Math.max(0, now - at);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
