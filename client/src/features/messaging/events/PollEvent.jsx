import React from 'react';
import PollMessage from '../chatWindowComp/messages/types/PollMessage';
import { Avatar } from '../../../shared/components/ui';
import { getAvatarUrl } from '../../../utils/avatarUtils';

function formatTime(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** A poll in the conversation stream, laid out like any other message row. */
function PollEvent({ event, currentUserId }) {
    const poll = event.poll || event.backend?.poll || event.payload?.poll || null;
    const sender = event.sender || event.backend?.sender || event.payload?.sender || {};
    const senderId = String(sender._id || sender.id || sender || '');
    const senderName = sender.username || event.senderName || 'Unknown';
    const isMe = !!currentUserId && senderId === String(currentUserId);
    const createdAt = event.createdAt || event.ts || event.payload?.createdAt;
    const avatarUrl = sender.profilePicture || event.senderAvatar || getAvatarUrl({ username: senderName, _id: senderId });

    const msg = {
        _id: event._id || event.id,
        id: event._id || event.id,
        type: 'poll',
        poll,
        sender,
        createdAt,
    };

    return (
        <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '6px 16px', position: 'relative', transition: 'background-color 80ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
            <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                <Avatar
                    src={avatarUrl}
                    fallback={senderName.charAt(0).toUpperCase()}
                    alt={senderName}
                    size="sm"
                    style={isMe ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : {}}
                />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative', paddingRight: '96px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.4 }}>{senderName}</span>
                <span style={{ position: 'absolute', top: '2px', right: '0', fontSize: '10px', color: 'var(--text-muted)', userSelect: 'none' }}>
                    {formatTime(createdAt)}
                </span>
                <PollMessage msg={msg} currentUserId={currentUserId} />
            </div>
        </div>
    );
}

export default PollEvent;
