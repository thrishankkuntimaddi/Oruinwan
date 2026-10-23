// The chat object the chat window uses for a group DM (built from a DM list entry).
import { useEffect } from 'react';
import { groupTitle } from './groupDmApi';

export function groupChatObject(session, workspaceId, workspaceRole) {
    const members = session.members || session.participants || [];
    return {
        id: String(session.id),
        type: 'dm',
        isGroup: true,
        userId: null,
        name: session.displayName || session.name || 'Group',
        groupName: session.name || null,
        members,
        memberCount: session.memberCount || members.length,
        createdBy: session.createdBy || null,
        image: null,
        status: 'offline',
        isNew: false,
        workspaceId,
        workspaceRole,
    };
}

/**
 * Keeps an open group DM up to date: new name or people (dm:members_updated), and leaves the
 * conversation when I'm removed or leave on another device (dm:removed).
 */
export function useGroupDMLive(socket, chat, myId, { onUpdate, onRemoved }) {
    const id = chat?.isGroup ? String(chat.id) : null;
    useEffect(() => {
        if (!socket || !id) return undefined;
        const updated = (data) => {
            if (String(data?.dmSessionId) !== id) return;
            const members = data.participants || [];
            onUpdate?.({
                name: groupTitle({ name: data.name, participants: members }, myId),
                groupName: data.name || null,
                members,
                memberCount: members.length,
            });
        };
        const removed = (data) => { if (String(data?.dmSessionId) === id) onRemoved?.(data); };
        socket.on('dm:members_updated', updated);
        socket.on('dm:removed', removed);
        return () => {
            socket.off('dm:members_updated', updated);
            socket.off('dm:removed', removed);
        };
    }, [socket, id, myId, onUpdate, onRemoved]);
}
