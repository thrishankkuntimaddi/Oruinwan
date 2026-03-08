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

        // ✅ FIX: Extract DM session ID from all possible locations:
        //   - event.payload.dm  → historical load (payload = full msg object)
        //   - event.dmId        → real-time socket normalization (ChatWindowV2 normalizedEvent)
        //   - event.backend.dm  → raw backend message kept for reference
        const rawDmId = event.payload?.dm?._id || event.payload?.dm
            || event.dmId                              // real-time socket events
            || event.backend?.dm?._id || event.backend?.dm   // backend reference
            || event.dm?._id || event.dm || null;
        const rawChannelId = event.payload?.channel?._id || event.payload?.channel
            || event.payload?.channelId
            || event.channelId
            || event.backend?.channel?._id || event.backend?.channel || null;
        const conversationId = rawChannelId || rawDmId || null;
        const conversationType = rawDmId ? 'dm' : 'channel';

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

    const ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
    const msgType = event.type || event.payload?.type || 'message';
    const rawAttachments = event.payload?.payload?.attachments || event.payload?.attachments || event.attachments || [];

    const enrichedMessage = {
        _id: event._id || event.id,
        id: event._id || event.id,
        // Preserve rich message type (image/video/file/voice/message)
        type: msgType,
        // ✅ Use decrypted content if available, otherwise fallback to encrypted structure
        text: messageText,
        attachments: rawAttachments,
        // Convenience alias for attachment-type messages (ImageMessage, VideoMessage, etc.)
        attachment: ATTACHMENT_TYPES.includes(msgType)
            ? (event.payload?.attachment || rawAttachments[0] || null)
            : undefined,
        // Phase 7.4 — contact card
        contact: event.contact || event.payload?.contact || null,
        // Phase 7.5 — link preview
        linkPreview: event.linkPreview || event.payload?.linkPreview || null,
        // Phase 7.6 — meeting
        meeting: event.meeting || event.payload?.meeting || null,
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
        // ✅ Expose decryptedContent so DMMessageItem memo can detect text changes
        decryptedContent: event.decryptedContent || messageText || null,
        // Channel context (for axios calls in ChannelMessageItem)
        channelId: event.payload?.channel || event.payload?.channelId || event.channelId || null,
        // Encryption fields
        isEncrypted,
        ciphertext,
        messageIv,
        // ✅ Quoted/inline reply preview — decrypted asynchronously
        repliedTo: decryptedRepliedTo,
        // Pin context
        pinnedByName: event.payload?.pinnedByName || event.pinnedByName || null,
        // DM session ID — needed for E2EE edit encryption in DMMessageItem
        dmSessionId: event.dmId
            || event.payload?.dm?._id || event.payload?.dm
            || event.backend?.dm?._id || event.backend?.dm
            || event.dm?._id || event.dm
            || null,
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

    // ChannelMessageItem calls forwardMessage(msg.id) to OPEN the modal.
    // enhancedActions.forwardMessage(id) sets forwardingMessageId + activeModal='forward'.
    // The modal then calls handleForward(targets) which calls the API.
    // We must pass the modal opener here — NOT call the API directly with msg.id as "targets".
    const handleForward = () => {
        actions.forwardMessage?.(enrichedMessage._id);
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
                infoMessage={(id) => actions.infoMessage?.(id, enrichedMessage.decryptedContent || enrichedMessage.text)}
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
            infoMessage={(id) => actions.infoMessage?.(id, enrichedMessage.decryptedContent || enrichedMessage.text)}
            currentUserId={currentUserId}
            onOpenThread={handleThreadOpen}
            threadCounts={threadCounts} // ✅ Forward threadCounts
            channelMembers={[]}
            isAdmin={false}
        />
    );
}

export default MessageEvent;
