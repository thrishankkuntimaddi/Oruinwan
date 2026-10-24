// Every conversation with unread messages must also be listed in its own section (Channels,
// Direct messages). The unread counts are kept live from socket events (NotificationsContext),
// but the side panels load their lists once — so a DM someone just started with me, or a channel
// I was just added to, showed up as unread (badges, the Unread filter, Home) while missing from
// its section. The panels use these helpers to notice that and reload their list.

/**
 * Ids of `type` conversations ('dm' | 'channel') that have unread messages but aren't in
 * `knownIds`. `unread` is NotificationsContext.conversationUnread ({ "dm:<id>": n }).
 */
export function missingUnreadIds(unread, type, knownIds) {
    if (!unread || typeof unread !== 'object') return [];
    const known = new Set((knownIds || []).map(String));
    const prefix = `${type}:`;
    return Object.entries(unread)
        .filter(([key, n]) => key.startsWith(prefix) && Number(n) > 0)
        .map(([key]) => key.slice(prefix.length))
        .filter((id) => id && !known.has(id));
}

/**
 * Which of the missing ids are worth a reload: each id once (one that is still missing after a
 * reload — another workspace's DM, an agent DM — isn't retried). Adds them to `tried`.
 */
export function idsToReloadFor(missing, tried) {
    const fresh = (missing || []).filter((id) => !tried.has(id));
    fresh.forEach((id) => tried.add(id));
    return fresh;
}
