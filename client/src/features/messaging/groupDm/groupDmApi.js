// Group DMs: a direct conversation with 3 or more people (server: /api/v2/dm).
import api from '@services/api';

/** Largest group, the creator included (server: DMSession.MAX_GROUP_DM_MEMBERS). */
export const MAX_GROUP_MEMBERS = 10;

export async function createGroupDM(workspaceId, memberIds, name) {
    const res = await api.post('/api/v2/dm/group', { workspaceId, memberIds, name: name?.trim() || undefined });
    return res.data.dm;
}

export async function getDMDetails(dmId) {
    const res = await api.get(`/api/v2/dm/${dmId}`);
    return res.data.dm;
}

export async function renameGroupDM(dmId, name) {
    const res = await api.patch(`/api/v2/dm/${dmId}`, { name });
    return res.data.dm;
}

export async function addGroupDMMembers(dmId, userIds) {
    const res = await api.post(`/api/v2/dm/${dmId}/members`, { userIds });
    return res.data.dm;
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
    if (names.length <= 3) return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}
