// Group DMs: a direct conversation with 3 or more people (server: /api/v2/dm).
import api from '@services/api';

/** Largest group, the creator included (server: DMSession.MAX_GROUP_DM_MEMBERS). */
export const MAX_GROUP_MEMBERS = 10;

/**
 * Start a group with these people (the creator is added by the server). Without a name, a group
 * with exactly the same people is reopened instead (`created: false`).
 */
export async function createGroupDM(workspaceId, memberIds, name, { newGroup = false } = {}) {
    // newGroup: "Start a new group" — always a separate group, even with the same people.
    const res = await api.post('/api/v2/dm/group', { workspaceId, memberIds, name: name?.trim() || undefined, ...(newGroup ? { newGroup: true } : {}) });
    return { ...res.data.dm, created: res.data.created !== false };
}

export async function getDMDetails(dmId) {
    const res = await api.get(`/api/v2/dm/${dmId}`);
    return res.data.dm;
}

export async function renameGroupDM(dmId, name) {
    const res = await api.patch(`/api/v2/dm/${dmId}`, { name });
    return res.data.dm;
}

/** What people added to a group can read (server: groupDM.service addMembers). */
export const HISTORY_OPTIONS = [
    { value: 'from_now', title: 'From now on', body: 'They see messages sent after they join.' },
    { value: 'earlier', title: 'Include earlier messages', body: 'They also see the earlier messages you can see.' },
];

/**
 * Adds people. history: 'from_now' (default) or 'earlier'. The group comes back with
 * `limitedHistory`: true when some earlier messages couldn't be shared with them.
 */
export async function addGroupDMMembers(dmId, userIds, { history = 'from_now' } = {}) {
    const res = await api.post(`/api/v2/dm/${dmId}/members`, { userIds, history });
    const limitedHistory = Object.values(res.data.history || {}).some((h) => h?.limited);
    return res.data.dm ? { ...res.data.dm, limitedHistory } : res.data.dm;
}

/** The confirmation after adding people to a group. */
export function addedMessage(count, history, limited = false) {
    const who = count === 1 ? 'Added to the group' : `${count} people added to the group`;
    if (history !== 'earlier') return `${who}. They see messages from now on.`;
    return limited ? `${who}. Some older messages couldn't be shared with them.` : `${who} with the earlier messages.`;
}

export async function removeGroupDMMember(dmId, userId) {
    await api.delete(`/api/v2/dm/${dmId}/members/${userId}`);
}

export async function leaveGroupDM(dmId) {
    await api.delete(`/api/v2/dm/${dmId}/members/me`);
}

/** "Ben, Chen and 2 others" when a group has no name (same rule as the server). */
export function groupTitle(group, myId) {
    if (group?.name) return group.name;
    const names = (group?.participants || group?.members || [])
        .filter((p) => String(p._id || p.id) !== String(myId))
        .map((p) => p.username || 'Someone');
    if (names.length === 0) return 'Just you';
    // Short however big the group is: two names, then a count.
    if (names.length <= 2) return names.join(' and ');
    const more = names.length - 2;
    return `${names.slice(0, 2).join(', ')} and ${more} ${more === 1 ? 'other' : 'others'}`;
}
