/**
 * When does an incoming event pop something? One pure module so the rules
 * live in one place (and are unit-tested): NotificationsContext gathers the
 * facts (route, tab visibility/focus, open thread, other tabs, prefs) and
 * asks here what to do.
 *
 *   Viewing that conversation (or thread) in a visible, focused tab
 *       → nothing pops; it's read, not counted as unread.
 *   Visible + focused, elsewhere in the app
 *       → a quiet in-app toast for DMs and @mentions only (coalesced per
 *         conversation), sound only if `sound` is on, never an OS notification.
 *   Hidden or unfocused
 *       → OS notification (if `desktopPush` and permission), one per
 *         conversation (replaced by tag), shown by one tab only.
 *   Another tab of the app is the active one → that tab decides; this one
 *       only keeps its counters.
 *   Non-message notifications (tasks, meetings, notes…) → bell always, toast
 *       unless that page is open, OS notification only when not active.
 */

/** Sliding window in which messages from one conversation share one toast. */
export const COALESCE_WINDOW_MS = 6000;

const OBJECT_ID = '[a-f0-9]{24}';

/** Notification types that are about a message (not their own "thing"). */
const CONVERSATIONAL_TYPES = new Set(['dm', 'mention', 'thread_reply', 'reaction']);
/** Never toast or OS-notify these; the bell is enough. */
const QUIET_TYPES = new Set(['reaction', 'message_edited', 'message_deleted']);

/**
 * The conversation open in the URL, if any ({ type: 'dm'|'channel', id }).
 * Covers /channel/:id, /dm/:id, /messages/dm/:id, /home/channel/:id,
 * /home/dm/:id. `/dm/new/:userId` is not a conversation yet.
 */
export function conversationInPath(pathname) {
    const m = new RegExp(`/(dm|channel)/(${OBJECT_ID})(?:/|$)`).exec(pathname || '');
    return m ? { type: m[1], id: m[2] } : null;
}

export function isViewingConversation(pathname, type, id) {
    if (!type || !id) return false;
    const open = conversationInPath(pathname);
    return !!open && open.type === type && open.id === String(id);
}

/** Is the page a stored notification points at (task, meeting, note…) open? */
export function isViewingTarget(pathname, notification, href) {
    const path = String(pathname || '');
    const meta = notification?.meta || {};
    if (meta.taskId && path.includes(`/tasks/${meta.taskId}`)) return true;
    if (meta.meetingId && path.includes(`/meetings/${meta.meetingId}`)) return true;
    if (meta.noteId && path.includes(`/notes/${meta.noteId}`)) return true;
    if (!href) return false;
    const target = String(href).split(/[?#]/)[0].replace(/\/+$/, '');
    if (!target) return false;
    // A generic list page (/tasks, /huddles) counts only as an exact match.
    return path.replace(/\/+$/, '') === target;
}

/** The conversation a stored notification belongs to, if any. */
export function notificationConversation(notification) {
    const meta = notification?.meta || {};
    if (meta.dmSessionId) return { type: 'dm', id: String(meta.dmSessionId) };
    if (meta.channelId) return { type: 'channel', id: String(meta.channelId) };
    return null;
}

/** Stable per-conversation key used for toast replacement and OS `tag`. */
export function conversationKey(type, id) {
    return `${type}:${id}`;
}

const NOTHING = Object.freeze({ count: false, markRead: false, toast: false, os: false, sound: false });

/**
 * Where the user's attention is.
 *   ctx.visible        document.visibilityState === 'visible'
 *   ctx.focused        document.hasFocus()
 *   ctx.otherTabActive another tab of the app is visible + focused
 *   ctx.isLeader       this tab is the one that shows OS notifications
 *   ctx.canNotifyOs    OS notifications are possible (permission granted / desktop app)
 */
function attention(ctx) {
    const active = !!ctx.visible && !!ctx.focused;
    return { active, otherTabActive: !active && !!ctx.otherTabActive };
}

/** Decide the alert channels once we know the user wants to hear about it. */
function deliver(ctx, prefs, { toastAllowed = true, osAllowed = true } = {}) {
    const { active, otherTabActive } = attention(ctx);
    if (active) {
        return { toast: toastAllowed, os: false, sound: toastAllowed && prefs.sound !== false };
    }
    // The active tab (if any) handles the alert; hidden tabs stay quiet.
    if (otherTabActive) return { toast: false, os: false, sound: false };
    const os = osAllowed && prefs.desktopPush !== false && !!ctx.canNotifyOs && ctx.isLeader !== false;
    return { toast: false, os, sound: false };
}

/**
 * A new top-level message (`conversation:activity`).
 * activity: { workspaceId, conversationType, conversationId, senderId, isMention, isDirectMention, muted }
 * prefs: account prefs (+ `workspace`: the per-workspace NotificationPreference)
 * ctx: { currentUserId, workspaceId, pathname, visible, focused, otherTabActive, isLeader, canNotifyOs }
 * Returns { count, markRead, toast, os, sound }.
 */
export function decideMessageAlert(activity, ctx = {}, prefs = {}) {
    if (!activity) return NOTHING;
    if (ctx.workspaceId && String(activity.workspaceId) !== String(ctx.workspaceId)) return NOTHING;
    if (ctx.currentUserId && String(activity.senderId) === String(ctx.currentUserId)) return NOTHING;

    const type = activity.conversationType;
    const id = String(activity.conversationId || '');
    const onRoute = isViewingConversation(ctx.pathname, type, id);
    // The chat window marks the open conversation read whenever the tab is
    // visible, so it must not be counted as unread here.
    if (onRoute && ctx.visible) {
        if (ctx.focused) return { ...NOTHING, markRead: true };
        // Visible but another window has focus: read on screen, maybe unseen.
        const wants = wantsMessageAlert(activity, prefs);
        return { ...NOTHING, markRead: true, ...(wants ? deliver(ctx, prefs, { toastAllowed: false }) : {}) };
    }

    const base = { ...NOTHING, count: true };
    if (!wantsMessageAlert(activity, prefs)) return base;
    return { ...base, ...deliver(ctx, prefs) };
}

function wantsMessageAlert(activity, prefs) {
    const isDm = activity.conversationType === 'dm';
    // Workspace-level "Messages" toggle (Notifications page → Settings).
    if (prefs.workspace && prefs.workspace.message === false) return false;
    // Muted: DMs never alert; a muted channel still alerts for a direct
    // @mention, never for @channel / @here.
    if (activity.muted) {
        if (isDm) return false;
        const direct = activity.isDirectMention !== undefined ? !!activity.isDirectMention : !!activity.isMention;
        return direct;
    }
    if (isDm) return prefs.dmNotifications !== false;
    return !!activity.isMention;
}

/**
 * A stored notification (`notification:new`).
 * ctx additionally carries `openThreadId` (the thread panel on screen) and
 * `href` (where the notification points).
 * Returns { count, markRead, toast, os, sound }.
 */
export function decideStoredAlert(notification, ctx = {}, prefs = {}) {
    if (!notification) return NOTHING;
    if (ctx.workspaceId && String(notification.workspaceId) !== String(ctx.workspaceId)) return NOTHING;

    const type = notification.type;
    const meta = notification.meta || {};
    const conv = notificationConversation(notification);
    const onConversation = conv ? isViewingConversation(ctx.pathname, conv.type, conv.id) : false;
    const lookingAtIt = !!ctx.visible && !!ctx.focused;

    if (type === 'thread_reply') {
        const threadOpen = !!meta.parentMessageId && String(ctx.openThreadId || '') === String(meta.parentMessageId);
        if (threadOpen && onConversation && ctx.visible) return { ...NOTHING, markRead: true };
        if (prefs.mentionsOnly) return { ...NOTHING, count: true };
        // Replies are no DM/@mention: never a toast; an OS alert when away.
        return { ...NOTHING, count: true, ...deliver(ctx, prefs, { toastAllowed: false }) };
    }

    if (CONVERSATIONAL_TYPES.has(type)) {
        // DMs and mentions pop through `conversation:activity`; reactions are
        // bell-only. Opening the conversation reads them.
        if (onConversation && ctx.visible) return { ...NOTHING, markRead: true };
        return { ...NOTHING, count: true };
    }
    if (QUIET_TYPES.has(type)) return { ...NOTHING, count: true };

    const base = { ...NOTHING, count: true };
    // "Only mentions and direct messages": everything else stays in the bell.
    if (prefs.mentionsOnly) return base;
    if (lookingAtIt && isViewingTarget(ctx.pathname, notification, ctx.href)) return base;
    return { ...base, ...deliver(ctx, prefs) };
}

/** A "remind me" reminder: always wanted; toast when active, OS when away. */
export function decideReminderAlert(ctx = {}, prefs = {}) {
    return { ...NOTHING, ...deliver(ctx, prefs) };
}

/**
 * Counts bursts per key. `hit(key)` returns how many events for that key
 * arrived within `windowMs` of each other (sliding); a quiet gap restarts it.
 * windowMs = Infinity counts until `reset`.
 */
export function createBurstCounter(windowMs = COALESCE_WINDOW_MS) {
    const entries = new Map();
    return {
        hit(key, now = Date.now()) {
            const e = entries.get(key);
            if (e && now - e.last <= windowMs) {
                e.count += 1;
                e.last = now;
                return e.count;
            }
            entries.set(key, { count: 1, last: now });
            return 1;
        },
        reset(key) {
            if (key === undefined) entries.clear();
            else entries.delete(key);
        },
        size() {
            return entries.size;
        },
    };
}

/** Toast / OS title for `count` messages from `sender` (`where` e.g. " · #general"). */
export function burstTitle(sender, count, where = '') {
    const who = sender || 'Someone';
    if (count > 1) return `${count} new messages from ${who}${where}`;
    return `${who}${where}`;
}
