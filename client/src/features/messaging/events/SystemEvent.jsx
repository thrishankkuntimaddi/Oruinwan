import React from 'react';
import { UserPlus, UserMinus, Settings, Info, Hash, Shield, Trash2, Pin, MessageCircle, Phone, Video } from 'lucide-react';

const ICONS = {
    member_joined: <UserPlus size={14} />,
    member_left: <UserMinus size={14} />,
    member_invited: <UserPlus size={14} />,
    member_removed: <UserMinus size={14} />,
    channel_created: <Hash size={14} />,
    channel_renamed: <Settings size={14} />,
    channel_desc_changed: <Settings size={14} />,
    admin_assigned: <Shield size={14} />,
    admin_demoted: <Shield size={14} />,
    messages_cleared: <Trash2 size={14} />,
    channel_privacy_changed: <Settings size={14} />,
    message_pinned: <Pin size={14} />,
    message_unpinned: <Pin size={14} />,
    
    dm_created: <MessageCircle size={14} />,
    dm_message_pinned: <Pin size={14} />,
    dm_message_unpinned: <Pin size={14} />,
    dm_call_started: <Phone size={14} />,
    dm_video_call_started: <Video size={14} />,
    dm_messages_cleared: <Trash2 size={14} />,
    
    'user-joined': <UserPlus size={14} />,
    'user-left': <UserMinus size={14} />,
    'channel-updated': <Settings size={14} />,
};

function SystemEvent({ event, currentUserId }) {
    
    
    
    
    const ev =
        event.systemEvent ||
        event.backend?.systemEvent ||
        event.payload?.systemEvent ||
        event.payload?.action ||
        '';
    const sd =
        event.systemData ||
        event.backend?.systemData ||
        event.payload?.systemData ||
        {};
    const ts =
        event.createdAt ||
        event.backend?.createdAt ||
        event.payload?.createdAt ||
        event.payload?.timestamp;

    
    
    const rawText =
        event.text ||
        event.backend?.text ||
        event.payload?.text ||
        '';

    const isMe = (id) => id && currentUserId && String(id) === String(currentUserId);
    const who = (id, name) => isMe(id) ? 'You' : (name || 'Someone');

    const textMap = {
        member_joined: () => `${who(sd.userId, sd.userName)} joined #${sd.channelName || 'this channel'}`,
        member_left: () => `${who(sd.userId, sd.userName)} left #${sd.channelName || 'this channel'}`,
        member_invited: () => `${who(sd.inviterId, sd.inviterName)} invited ${isMe(sd.invitedUserId) ? 'you' : (sd.invitedUserName || 'someone')}`,
        member_removed: () => `${who(sd.removedById || sd.removedByUserId, sd.removedByName)} removed ${isMe(sd.removedUserId) ? 'you' : (sd.removedUserName || 'someone')}`,
        channel_created: () => `${who(sd.userId, sd.userName)} created this channel`,
        channel_renamed: () => `${who(sd.userId, sd.userName)} renamed the channel to #${sd.newName || 'new name'}`,
        channel_desc_changed: () => `${who(sd.userId, sd.userName)} updated the channel description`,
        channel_privacy_changed: () => `${who(sd.userId, sd.userName)} made this channel ${sd.newPrivacy || 'private'}`,
        
        admin_assigned: () =>
            rawText || `${who(sd.assignerId, sd.assignerName)} made ${isMe(sd.assignedUserId) ? 'you' : (sd.assignedUserName || 'someone')} an admin`,
        admin_demoted: () =>
            rawText || `${who(sd.demoterId, sd.demoterName)} removed ${isMe(sd.demotedUserId) ? 'your' : `${sd.demotedUserName || "someone"}'s`} admin role`,
        messages_cleared: () => `${who(sd.userId, sd.userName)} cleared the message history`,
        message_pinned: () => {
            const snippet = sd.messageSnippet ? `: "${sd.messageSnippet}"` : '';
            return `${who(sd.userId, sd.userName)} pinned a message${snippet}`;
        },
        message_unpinned: () => `${who(sd.userId, sd.userName)} unpinned a message`,
        
        dm_created: () => `${who(sd.userId, sd.userName)} started this conversation`,
        dm_message_pinned: () => {
            const snippet = sd.messageSnippet ? `: "${sd.messageSnippet}"` : '';
            return `${who(sd.userId, sd.userName)} pinned a message${snippet}`;
        },
        dm_message_unpinned: () => `${who(sd.userId, sd.userName)} unpinned a message`,
        dm_call_started: () => `${who(sd.userId, sd.userName)} started a voice call`,
        dm_video_call_started: () => `${who(sd.userId, sd.userName)} started a video call`,
        dm_messages_cleared: () => `${who(sd.userId, sd.userName)} cleared the chat history`,
        
        'user-joined': () => `${sd.userName || event.payload?.username || 'Someone'} joined`,
        'user-left': () => `${sd.userName || event.payload?.username || 'Someone'} left`,
        'channel-updated': () => 'Channel settings were updated',
        'channel-created': () => 'Channel was created',
    };

    
    const text = textMap[ev]?.() || rawText || event.payload?.message || 'System event';
    const icon = ICONS[ev] || <Info size={14} />;

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 12px', borderRadius: '99px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>
                <span>{text}</span>
                {ts && (
                    <span style={{ opacity: 0.55, marginLeft: '4px' }}>
                        {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
}

export default SystemEvent;
