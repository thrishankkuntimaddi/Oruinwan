// client/src/components/messagesComp/events/SystemEvent.jsx
// Renders system events from the messages collection (type: 'system')
// Backend stores: event.systemEvent (e.g. 'member_joined') + event.systemData { userId, userName, ... }

import React from 'react';
import { UserPlus, UserMinus, Settings, Info, Hash, Shield, Trash2 } from 'lucide-react';

const ICONS = {
    member_joined: <UserPlus size={14} />,
    member_left: <UserMinus size={14} />,
    member_invited: <UserPlus size={14} />,
    member_removed: <UserMinus size={14} />,
    channel_created: <Hash size={14} />,
    channel_renamed: <Settings size={14} />,
    admin_assigned: <Shield size={14} />,
    admin_demoted: <Shield size={14} />,
    messages_cleared: <Trash2 size={14} />,
    channel_privacy_changed: <Settings size={14} />,
    // Legacy keys
    'user-joined': <UserPlus size={14} />,
    'user-left': <UserMinus size={14} />,
    'channel-updated': <Settings size={14} />,
};

function SystemEvent({ event, currentUserId }) {
    // Exhaustive fallback chain — event shape varies by source:
    //   History (useConversation):  ev at event.systemEvent (hoisted from msg)
    //   Realtime (ChatWindowV2):    ev at event.backend.systemEvent (raw socket doc)
    //   Fallback:                   ev at event.payload.systemEvent (full msg in payload)
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

    const isMe = (id) => id && currentUserId && String(id) === String(currentUserId);
    const who = (id, name) => isMe(id) ? 'You' : (name || 'Someone');

    const textMap = {
        member_joined: () => `${who(sd.userId, sd.userName)} joined #${sd.channelName || 'this channel'}`,
        member_left: () => `${who(sd.userId, sd.userName)} left #${sd.channelName || 'this channel'}`,
        member_invited: () => `${who(sd.inviterId, sd.inviterName)} invited ${isMe(sd.invitedUserId) ? 'you' : (sd.invitedUserName || 'someone')}`,
        member_removed: () => `${who(sd.removedById, sd.removedByName)} removed ${isMe(sd.removedUserId) ? 'you' : (sd.removedUserName || 'someone')}`,
        channel_created: () => `${who(sd.userId, sd.userName)} created this channel`,
        channel_renamed: () => `${who(sd.userId, sd.userName)} renamed the channel to #${sd.newName}`,
        admin_assigned: () => `${who(sd.assignerId, sd.assignerName)} made ${isMe(sd.assignedUserId) ? 'you' : (sd.assignedUserName || 'someone')} an admin`,
        admin_demoted: () => `${who(sd.demoterId, sd.demoterName)} removed ${isMe(sd.demotedUserId) ? 'your' : `${sd.demotedUserName || 'someone'}'s`} admin role`,
        messages_cleared: () => `${who(sd.userId, sd.userName)} cleared the message history`,
        channel_privacy_changed: () => `${who(sd.userId, sd.userName)} made this channel ${sd.newPrivacy || 'private'}`,
        // Legacy
        'user-joined': () => `${sd.userName || event.payload?.username || 'Someone'} joined`,
        'user-left': () => `${sd.userName || event.payload?.username || 'Someone'} left`,
        'channel-updated': () => 'Channel settings were updated',
        'channel-created': () => 'Channel was created',
    };

    const text = textMap[ev]?.() || event.payload?.message || 'System event';
    const icon = ICONS[ev] || <Info size={14} />;

    return (
        <div className="flex items-center justify-center my-1.5 px-4">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100/80 dark:bg-gray-800/80 text-xs text-gray-500 dark:text-gray-400 font-medium">
                {icon}
                <span>{text}</span>
                {ts && (
                    <span className="opacity-60 ml-1">
                        {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
}

export default SystemEvent;
