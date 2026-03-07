// client/src/components/messagesComp/events/MessageEvent.jsx
// Wrapper for message type events - reuses existing message components

import React, { useState, useEffect } from 'react';
import ChannelMessageItem from '../chatWindowComp/messages/ChannelMessageItem';
import DMMessageItem from '../chatWindowComp/messages/DMMessageItem';

/**
 * Renders a message event
 * @param {object} event - Message event
 * @param {object} actions - Message actions from useMessageActions
 * @param {boolean} isDM - Whether this is a DM conversation
 * @param {function} onThreadOpen - Callback when thread is opened
 * @param {function} onReply - Called with enrichedMessage when Reply is clicked
 * @param {string} currentUserId - Current user's ID
 * @param {object} threadCounts - Object containing thread counts for messages
 */
function MessageEvent({
    event,
    actions = {},
    onThreadOpen,
    onReply,       // ← new: called with enrichedMessage when Reply is clicked
    replyingTo,
    onCancelReply,
    currentUserId,
    isDM = false,
    openMsgMenuId,
    toggleMsgMenu,
    setOpenMsgMenuId,
    threadCounts = {} // ✅ Add threadCounts prop
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

    // Extract repliedTo info for showing quoted message preview
    // Backend populates 'quotedMessageId' as the inlined quoted Message doc (with sender populated)
    // The frontend may also receive an explicit 'repliedTo' field on some paths
    const rawRepliedTo = event.quotedMessageId                    // populated quotedMessageId (primary)
        || event.payload?.quotedMessageId                         // nested inside payload
        || event.repliedTo                                        // legacy explicit field
        || event.payload?.repliedTo                               // legacy nested
        || null;

    // Build the immediate (possibly encrypted) repliedTo from what we have
    const immediateRepliedTo = rawRepliedTo ? {
        senderName: rawRepliedTo.senderName || rawRepliedTo.sender?.username || 'Someone',
        payload: {
            // Use plaintext if available (from replyingTo state capture),
            // only fall back to "🔒" if the field is truly a ciphertext blob
            text: rawRepliedTo.payload?.text
                || rawRepliedTo.text
                || rawRepliedTo.decryptedContent
                || null  // null triggers async decryption below
        }
    } : null;

    // Async decryption of quoted message for historical loads (other users / page refresh)
    const [decryptedRepliedTo, setDecryptedRepliedTo] = useState(immediateRepliedTo);

    useEffect(() => {
        setDecryptedRepliedTo(immediateRepliedTo);

        // If we have a completely encrypted quoted payload (no plaintext available), decrypt it
        if (!immediateRepliedTo) return;
        if (immediateRepliedTo.payload?.text) return; // already have plaintext

        const quotedPayload = rawRepliedTo?.payload || rawRepliedTo; // handle nested payload
        const qCiphertext = quotedPayload?.ciphertext || rawRepliedTo?.payload?.ciphertext;
        const qIv = quotedPayload?.messageIv || rawRepliedTo?.payload?.messageIv;
        const conversationId = event.payload?.channel || event.payload?.channelId || event.channelId
            || event.payload?.dm || event.channelId || null;
        const conversationType = (event.payload?.dm || event.dm) ? 'dm' : 'channel';

        if (!qCiphertext || !qIv || !conversationId) {
            // No ciphertext to decrypt or no conversationId — show placeholder
            setDecryptedRepliedTo(prev => ({
                ...prev,
                payload: { text: '🔒 Encrypted message' }
            }));
            return;
        }

        // Decrypt asynchronously using the conversation key
        let cancelled = false;
        (async () => {
            try {
                const { decryptReceivedMessage } = await import('../../../services/messageEncryptionService');
                const plaintext = await decryptReceivedMessage(
                    qCiphertext, qIv, conversationId, conversationType, null
                );
                if (!cancelled) {
                    setDecryptedRepliedTo({
                        senderName: rawRepliedTo.senderName || rawRepliedTo.sender?.username || 'Someone',
                        payload: { text: plaintext }
                    });
                }
            } catch {
                if (!cancelled) {
                    setDecryptedRepliedTo(prev => ({
                        ...prev,
                        payload: { text: '🔒 Encrypted message' }
                    }));
                }
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event._id || event.id]);

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
        senderName: event.sender?.username || event.payload?.sender?.username || 'Unknown',
        senderAvatar: event.sender?.profilePicture
            || event.payload?.sender?.profilePicture
            || event.backend?.sender?.profilePicture
            || null,
        timestamp: event.createdAt || event.payload?.createdAt,
        ts: event.createdAt || event.payload?.createdAt,
        isRead: (event.readBy || event.payload?.readBy)?.some(r => (r.user?._id || r.user || r._id || r) === currentUserId),
        status: event.status || 'sent',
        // Soft delete fields
        isDeleted: event.payload?.isDeleted || event.isDeleted || false,
        isDeletedUniversally: event.payload?.isDeletedUniversally || event.isDeletedUniversally || false,
        deletedBy: event.payload?.deletedBy || event.deletedBy || null,
        deletedByName: event.payload?.deletedByName || event.deletedByName || null,
        // Edit fields
        editedAt: event.payload?.editedAt || event.editedAt || null,
        // Channel context (for axios calls in ChannelMessageItem)
        channelId: event.payload?.channel || event.payload?.channelId || event.channelId || null,
        // Encryption fields
        isEncrypted,
        ciphertext,
        messageIv,
        // ✅ Quoted/inline reply preview — decrypted asynchronously
        repliedTo: decryptedRepliedTo
    };


    // Common handlers
    const handleAddReaction = (emoji) => {
        actions.addReaction?.(enrichedMessage._id, emoji);
    };

    const handleDelete = (scope = 'everyone') => {
        // scope: 'me' | 'everyone' — pass straight through to actions.deleteMessage
        actions.deleteMessage?.(enrichedMessage._id, scope);
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
                replyToMessage={(id) => onReply?.(enrichedMessage)}
                forwardMessage={handleForward}
                copyMessage={() => { }}
                deleteMessage={(id, scope) => handleDelete(scope)}
                infoMessage={() => { }}
                currentUserId={currentUserId}
                onOpenThread={handleThreadOpen}
                threadCounts={threadCounts} // ✅ Forward threadCounts
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
            replyToMessage={(id) => onReply?.(enrichedMessage)}
            forwardMessage={handleForward}
            copyMessage={() => { }}
            deleteMessage={(id, scope) => handleDelete(scope)}
            infoMessage={() => { }}
            currentUserId={currentUserId}
            onOpenThread={handleThreadOpen}
            threadCounts={threadCounts} // ✅ Forward threadCounts
            channelMembers={[]}
            isAdmin={false}
        />
    );
}

export default MessageEvent;
