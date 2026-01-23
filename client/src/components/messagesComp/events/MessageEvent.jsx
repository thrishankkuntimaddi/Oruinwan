// client/src/components/messagesComp/events/MessageEvent.jsx
// Wrapper for message type events - reuses existing message components

import React from 'react';
import ChannelMessageItem from '../chatWindowComp/messages/ChannelMessageItem';
import DMMessageItem from '../chatWindowComp/messages/DMMessageItem';

/**
 * Renders a message event
 * @param {object} event - Message event
 * @param {object} actions - Message actions from useMessageActions
 * @param {boolean} isDM - Whether this is a DM conversation
 * @param {function} onThreadOpen - Callback when thread is opened
 * @param {object} replyingTo - Currently replying to message
 * @param {function} onCancelReply - Cancel reply callback
 * @param {string} currentUserId - Current user's ID
 */
function MessageEvent({
    event,
    actions = {},
    isDM = false,
    onThreadOpen,
    replyingTo,
    onCancelReply,
    currentUserId,
    openMsgMenuId,
    toggleMsgMenu,
    setOpenMsgMenuId
}) {
    // NEW SCHEMA: event IS the message, event.payload contains text/attachments
    // FALLBACK: Support both new (payload.text) and old (direct text) structures
    // FIX: Handle double-nested payload (event.payload.payload.text)

    // Check if message is encrypted
    const isEncrypted = event.payload?.isEncrypted || event.isEncrypted || false;
    const ciphertext = event.payload?.ciphertext || event.ciphertext;
    const messageIv = event.payload?.messageIv || event.messageIv;

    // Extract text with priority: decryptedContent > nested payload > direct payload
    const messageText = event.decryptedContent || event.payload?.payload?.text || event.payload?.text || event.text || '';

    console.log(`📝 [MessageEvent] Rendering message ${event._id || event.id}:`, {
        hasDecryptedContent: !!event.decryptedContent,
        decryptedText: event.decryptedContent?.substring(0, 20),
        finalText: messageText.substring(0, 20),
        isEncrypted
    });

    const enrichedMessage = {
        _id: event._id || event.id,
        id: event._id || event.id,
        // ✅ Use decrypted content if available, otherwise fallback to encrypted structure
        text: messageText,
        attachments: event.payload?.payload?.attachments || event.payload?.attachments || event.attachments || [],
        sender: event.sender || event.payload?.sender || {},
        createdAt: event.createdAt || event.payload?.createdAt,
        reactions: event.reactions || event.payload?.reactions || [],
        isPinned: event.isPinned || event.payload?.isPinned || false,
        replyCount: event.replyCount || event.payload?.replyCount || 0,
        replyAvatars: event.replyAvatars || event.payload?.replyAvatars || [],
        lastReplyAt: event.lastReplyAt || event.payload?.lastReplyAt,
        parentId: event.parentId || event.payload?.parentId,
        threadParent: event.parentId || event.payload?.parentId,
        senderName: event.sender?.username || event.payload?.sender?.username || 'Unknown',
        senderAvatar: event.sender?.profilePicture || event.payload?.sender?.profilePicture || null,
        timestamp: event.createdAt || event.payload?.createdAt,
        ts: event.createdAt || event.payload?.createdAt,
        isRead: (event.readBy || event.payload?.readBy)?.some(r => (r.user?._id || r.user || r._id || r) === currentUserId),
        status: event.status || 'sent',
        // Encryption fields
        isEncrypted,
        ciphertext,
        messageIv
    };

    // Common handlers
    const handleAddReaction = (emoji) => {
        actions.addReaction?.(enrichedMessage._id, emoji);
    };

    const handleDelete = (deleteForEveryone = false) => {
        actions.deleteMessage?.(enrichedMessage._id, deleteForEveryone);
    };

    const handlePin = () => {
        if (enrichedMessage.isPinned) {
            actions.unpinMessage?.(enrichedMessage._id);
        } else {
            actions.pinMessage?.(enrichedMessage._id);
        }
    };

    const handleForward = (targets) => {
        actions.forwardMessage?.(enrichedMessage._id, targets);
    };

    const handleThreadOpen = () => {
        onThreadOpen?.(enrichedMessage);
    };

    // Render appropriate message component
    if (isDM) {
        return (
            <DMMessageItem
                msg={enrichedMessage}
                selectMode={false}
                selectedIds={new Set()}
                toggleSelect={() => { }}
                openMsgMenuId={openMsgMenuId}
                toggleMsgMenu={toggleMsgMenu}
                formatTime={(ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                addReaction={handleAddReaction}
                pinMessage={handlePin}
                replyToMessage={() => { }}
                forwardMessage={handleForward}
                copyMessage={() => { }}
                deleteMessage={(id, type) => handleDelete(type === 'everyone')}
                infoMessage={() => { }}
                currentUserId={currentUserId}
                onOpenThread={handleThreadOpen}
                threadCounts={{}}
            />
        );
    }

    return (
        <ChannelMessageItem
            msg={enrichedMessage}
            selectMode={false}
            selectedIds={new Set()}
            toggleSelect={() => { }}
            openMsgMenuId={openMsgMenuId}
            toggleMsgMenu={toggleMsgMenu}
            formatTime={(ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            addReaction={handleAddReaction}
            pinMessage={handlePin}
            replyToMessage={() => { }}
            forwardMessage={handleForward}
            copyMessage={() => { }}
            deleteMessage={(id, type) => handleDelete(type === 'everyone')}
            infoMessage={() => { }}
            currentUserId={currentUserId}
            onOpenThread={handleThreadOpen}
            threadCounts={{}}
            channelMembers={[]}
            isAdmin={false}
        />
    );
}

export default MessageEvent;
