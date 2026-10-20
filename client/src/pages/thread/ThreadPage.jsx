import React, { useEffect, useMemo, useState } from 'react';
import api from '@services/api';
import { useNavigate, useParams } from 'react-router-dom';
import ThreadPanel from '../../features/messaging/chatWindowComp/ThreadPanel';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * A thread on its own page: /workspace/:workspaceId/thread/:type/:conversationId/:messageId.
 * Mainly for split view, so a thread can sit beside any other page.
 */
export default function ThreadPage() {
    const { workspaceId, type, conversationId, messageId } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user } = useAuth();
    const conversationType = type === 'dm' ? 'dm' : 'channel';

    // The conversation's name for the header (#general, or the other person in a DM).
    const [name, setName] = useState('');
    useEffect(() => {
        let live = true;
        const url = conversationType === 'channel' ? `/api/workspaces/${workspaceId}/channels` : `/api/v2/messages/workspace/${workspaceId}/dms`;
        api.get(url).then(({ data }) => {
            if (!live) return;
            const list = conversationType === 'channel' ? (data.channels || []) : (data.sessions || data.dms || data || []);
            const hit = (Array.isArray(list) ? list : []).find((x) => String(x._id || x.id) === String(conversationId));
            setName(conversationType === 'channel' ? hit?.name || '' : hit?.otherUser?.username || '');
        }).catch(() => {});
        return () => { live = false; };
    }, [workspaceId, conversationId, conversationType]);

    // ThreadPanel loads the parent message itself; it only needs the id to start.
    const parent = useMemo(() => ({ _id: messageId, workspace: workspaceId }), [messageId, workspaceId]);
    const conversationPath = `/workspace/${workspaceId}/${conversationType === 'dm' ? 'dm' : 'channel'}/${conversationId}`;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', minWidth: 0 }}>
            <ThreadPanel
                key={messageId}
                parentMessage={parent}
                channelId={conversationId}
                conversationType={conversationType}
                conversationName={name}
                socket={socket}
                currentUserId={user?._id || user?.id}
                canOpenBeside={false}
                onClose={() => navigate(conversationPath)}
                style={{ flex: 1, width: '100%', minHeight: 0, borderLeft: 'none' }}
            />
        </div>
    );
}
