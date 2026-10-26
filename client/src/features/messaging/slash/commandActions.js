// The web app's side of the shared slash commands (platform/commands/slashCommands.js): the API
// calls they make. The chat window and the thread panel build their command context from these.
import api from '@services/api';
import { encryptMessageForSending } from '../../../services/messageEncryptionService';
import { leaveGroupDM } from '../groupDm/groupDmApi';

const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;
const rethrow = (fallback) => (err) => { throw new Error(errorText(err, fallback)); };

/** Workspace members → the people commands can @mention: [{ id, username, name }]. */
export function commandPeople(members = []) {
    return (members || [])
        .map((m) => {
            const u = m?.user && typeof m.user === 'object' ? m.user : m;
            return { id: String(u?._id || u?.id || m?._id || ''), username: u?.username || '', name: u?.name || u?.username || '' };
        })
        .filter((p) => p.id && p.username);
}

/**
 * /task: a task linked to the "Task created" line (so to this conversation). With nobody named it is
 * mine; with people it is one task shared by them. In a channel it belongs to the channel too.
 */
export async function createCommandTask({ workspaceId, conversationType, conversationId, title, assigneeIds = [], dueDate, linkedMessageId }) {
    if (!workspaceId) throw new Error('Open a workspace first.');
    const payload = {
        title,
        workspaceId,
        assignmentType: assigneeIds.length ? 'individual' : 'self',
        assignedToIds: assigneeIds,
        taskMode: 'shared',
        status: 'todo',
        priority: 'medium',
        source: 'chat',
        ...(dueDate ? { dueDate } : {}),
        ...(linkedMessageId ? { linkedMessage: linkedMessageId } : {}),
        ...(conversationType === 'channel' ? { channelId: conversationId } : {}),
    };
    const { data } = await api.post('/api/v2/tasks', payload).catch(rethrow('Could not create the task.'));
    return data?.task || data?.tasks?.[0] || {};
}

/** /remind: a reminder on a message, for me or for someone who can read it. */
export function remindOnMessage({ messageId, at, note, forUserId }) {
    return api.post(`/api/v2/messages/${messageId}/reminder`, {
        remindAt: new Date(at).toISOString(), note, ...(forUserId ? { forUserId } : {}),
    }).catch(rethrow('Could not set the reminder.'));
}

/** /later: encrypted here, sent by the server at `at` (same as Send later on the phone). */
export async function scheduleEncrypted({ workspaceId, conversationType, conversationId, text, at }) {
    const enc = await encryptMessageForSending(text, conversationId, conversationType === 'channel' ? 'channel' : 'dm');
    if (!enc?.ciphertext) throw new Error("This conversation's encryption key isn't ready yet.");
    // keyVersion: which of the conversation's keys encrypted it (checked when it is sent).
    const { data } = await api.post('/api/v2/scheduled-messages', {
        workspaceId,
        kind: conversationType === 'channel' ? 'channel' : 'dm',
        conversationId,
        sendAt: new Date(at).toISOString(),
        body: { ciphertext: enc.ciphertext, messageIv: enc.messageIv, isEncrypted: true, ...(enc.keyVersion ? { keyVersion: enc.keyVersion } : {}) },
    }).catch(rethrow('Could not schedule the message.'));
    return data?.scheduled;
}

/** /mute and /unmute. */
export function setConversationMuted(conversationType, conversationId, muted) {
    const base = conversationType === 'channel' ? `/api/channels/${conversationId}/mute` : `/api/v2/dm/${conversationId}/mute`;
    return (muted ? api.post(base, {}) : api.delete(base)).catch(rethrow('Could not change notifications.'));
}

/** /status (null clears it), /away and /back. */
export const setMyStatus = (status) => api.patch('/api/users/status', { customStatus: status }).catch(rethrow('Could not set your status.'));
export const setMyPresence = (presence) => api.patch('/api/users/status', { status: presence }).catch(rethrow('Could not change your status.'));

/** /topic (the channel's description is its topic). */
export const setChannelTopic = (channelId, topic) => api.patch(`/api/channels/${channelId}/description`, { description: topic }).catch(rethrow('Could not set the topic.'));

/** /leave: a channel or a group. */
export function leaveConversation(conversationType, conversationId) {
    if (conversationType === 'channel') return api.post(`/api/channels/${conversationId}/exit`, {}).catch(rethrow('Could not leave the channel.'));
    return leaveGroupDM(conversationId).catch(rethrow('Could not leave the group.'));
}

/** /invite in a channel: add each person (the server posts who joined). Returns how many were added. */
export async function addToChannel(channelId, people) {
    let added = 0;
    let problem = null;
    for (const p of people) {
        try {
            await api.post(`/api/channels/${channelId}/invite`, { userId: p.id });
            added += 1;
        } catch (err) {
            problem = errorText(err, 'Could not add them.');
        }
    }
    if (!added && problem) throw new Error(problem);
    return added;
}

/** /call @person: their DM's id (made if needed). */
export async function dmWith(workspaceId, userId) {
    const { data } = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/resolve/${userId}`).catch(rethrow('Could not open a chat with them.'));
    if (!data?.dmSessionId) throw new Error('Could not open a chat with them.');
    return data.dmSessionId;
}
