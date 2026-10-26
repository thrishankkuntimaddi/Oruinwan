import { searchPeople } from '@platform/people/peopleMatch.js';

// Recipients for "New message" and group pickers: the workspace's active members, in one shape,
// filtered with the people matcher the phone app uses too (platform/people/peopleMatch.js).

/** A member row from GET /api/workspaces/:id/members (or a search result) in one shape. */
export function toRecipient(m) {
    if (!m) return null;
    const id = String(m._id || m.id || m.user?._id || '');
    if (!id) return null;
    const username = m.username || m.user?.username || '';
    const displayName = (m.profile?.name || m.displayName || m.name || '').trim();
    return {
        _id: id,
        username,
        // What the row shows: the person's name when they set one, else their username.
        name: displayName || username || m.email || 'Unknown',
        email: m.email || '',
        profilePicture: m.profilePicture || null,
        about: m.profile?.about || m.about || '',
        role: m.role || 'member',
        status: m.status || (m.isOnline ? 'online' : 'offline'),
        userStatus: m.userStatus || null,
        membershipStatus: m.membershipStatus || 'active',
    };
}

/** Active members other than me, in a stable order (name, then username). */
export function recipientsFrom(members, myId) {
    const me = String(myId || '');
    const seen = new Set();
    const out = [];
    for (const raw of members || []) {
        const r = toRecipient(raw);
        if (!r || r._id === me || seen.has(r._id)) continue;
        if (r.membershipStatus !== 'active' || raw?.isCurrentUser) continue;
        seen.add(r._id);
        out.push(r);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.username.localeCompare(b.username));
}

/**
 * Filter by what the person typed, with the matcher the phone app uses too
 * (platform/people/peopleMatch.js): word starts of the name, username or email start, and 3+
 * letters anywhere; best matches first. An empty query keeps the list as it is.
 */
export function filterRecipients(list, query) {
    if (!String(query || '').trim()) return list || [];
    return searchPeople(list, query);
}

/** Toggle someone in a pick list by id (never by object identity). */
export function togglePicked(picked, person) {
    const id = String(person?._id || '');
    if (!id) return picked;
    return picked.some((p) => p._id === id) ? picked.filter((p) => p._id !== id) : [...picked, person];
}
