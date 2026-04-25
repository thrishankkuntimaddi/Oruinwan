import React, { useState, useEffect, lazy, Suspense } from 'react';
import ChannelMessageItem from '../chatWindowComp/messages/ChannelMessageItem';
import DMMessageItem from '../chatWindowComp/messages/DMMessageItem';
import { getAvatarUrl } from '../../../utils/avatarUtils';
import ChecklistMessage from '../ChecklistMessage';
import { useTranslation } from '../../../hooks/useTranslation';

const MessageDiffViewer = lazy(() => import('../MessageDiffViewer'));

function MessageEvent({
    event,
    actions = {},
    onThreadOpen,
    onReply,       
    replyingTo,
    onCancelReply,
    currentUserId,
    isDM = false,
    openMsgMenuId,
    toggleMsgMenu,
    setOpenMsgMenuId,
    threadCounts = {} 
}) {
    const [showDiff, setShowDiff] = useState(false);
    
    const { getTranslation, requestTranslation, clearTranslation } = useTranslation();
    
    
    

    
    const isEncrypted = event.payload?.isEncrypted || event.isEncrypted || false;
    const ciphertext = event.payload?.ciphertext || event.ciphertext;
    const messageIv = event.payload?.messageIv || event.messageIv;

    
    const messageText = event.decryptedContent || event.payload?.payload?.text || event.payload?.text || event.text || '';

    
    
    
    const rawRepliedTo = event.quotedMessageId                    
        || event.payload?.quotedMessageId                         
        || event.repliedTo                                        
        || event.payload?.repliedTo                               
        || null;

    
    const immediateRepliedTo = rawRepliedTo ? {
        senderName: rawRepliedTo.senderName || rawRepliedTo.sender?.username || 'Someone',
        payload: {
            
            
            text: rawRepliedTo.payload?.text
                || rawRepliedTo.text
                || rawRepliedTo.decryptedContent
                || null  
        }
    } : null;

    
    const [decryptedRepliedTo, setDecryptedRepliedTo] = useState(immediateRepliedTo);

    useEffect(() => {
        setDecryptedRepliedTo(immediateRepliedTo);

        
        if (!immediateRepliedTo) return;
        if (immediateRepliedTo.payload?.text) return; 

        const quotedPayload = rawRepliedTo?.payload || rawRepliedTo; 
        const qCiphertext = quotedPayload?.ciphertext || rawRepliedTo?.payload?.ciphertext;
        const qIv = quotedPayload?.messageIv || rawRepliedTo?.payload?.messageIv;

        
        
        
        
        const rawDmId = event.payload?.dm?._id || event.payload?.dm
            || event.dmId                              
            || event.backend?.dm?._id || event.backend?.dm   
            || event.dm?._id || event.dm || null;
        const rawChannelId = event.payload?.channel?._id || event.payload?.channel
            || event.payload?.channelId
            || event.channelId
            || event.backend?.channel?._id || event.backend?.channel || null;
        const conversationId = rawChannelId || rawDmId || null;
        const conversationType = rawDmId ? 'dm' : 'channel';

        if (!qCiphertext || !qIv || !conversationId) {
            
            setDecryptedRepliedTo(prev => ({
                ...prev,
                payload: { text: '🔒 Encrypted message' }
            }));
            return;
        }

        
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
        
    }, [event._id || event.id]);

    const ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
    const msgType = event.type || event.payload?.type || 'message';
    const rawAttachments = event.payload?.payload?.attachments || event.payload?.attachments || event.attachments || [];

    const enrichedMessage = {
        _id: event._id || event.id,
        id: event._id || event.id,
        
        type: msgType,
        
        text: messageText,
        attachments: rawAttachments,
        
        attachment: ATTACHMENT_TYPES.includes(msgType)
            ? (event.payload?.attachment || rawAttachments[0] || null)
            : undefined,
        
        contact: event.contact || event.payload?.contact || null,
        
        linkPreview: event.linkPreview || event.payload?.linkPreview || null,
        
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
        senderAvatar: getAvatarUrl(
            event.sender
            || event.payload?.sender
            || event.backend?.sender
            || { username: event.sender?.username || 'user' }
        ),
        timestamp: event.createdAt || event.payload?.createdAt,
        ts: event.createdAt || event.payload?.createdAt,
        isRead: (event.readBy || event.payload?.readBy)?.some(r => (r.user?._id || r.user || r._id || r) === currentUserId),
        status: event.status || 'sent',
        
        isDeleted: event.payload?.isDeleted || event.isDeleted || false,
        isDeletedUniversally: event.payload?.isDeletedUniversally || event.isDeletedUniversally || false,
        deletedBy: event.payload?.deletedBy || event.deletedBy || null,
        deletedByName: event.payload?.deletedByName || event.deletedByName || null,
        
        editedAt: event.payload?.editedAt || event.editedAt || null,
        
        editHistory: event.editHistory || event.payload?.editHistory || [],
        
        decryptedContent: event.decryptedContent || messageText || null,
        
        channelId: event.payload?.channel || event.payload?.channelId || event.channelId || null,
        
        isEncrypted,
        ciphertext,
        messageIv,
        
        repliedTo: decryptedRepliedTo,
        
        pinnedByName: event.payload?.pinnedByName || event.pinnedByName || null,
        
        dmSessionId: event.dmId
            || event.payload?.dm?._id || event.payload?.dm
            || event.backend?.dm?._id || event.backend?.dm
            || event.dm?._id || event.dm
            || null,
        
        bookmarkedBy: event.bookmarkedBy || event.payload?.bookmarkedBy || [],
        
        checklist: event.checklist || event.payload?.checklist || [],
        
        resolvedThreadAt: event.resolvedThreadAt || event.payload?.resolvedThreadAt || null,
        resolvedBy:       event.resolvedBy || event.payload?.resolvedBy || null,
        
        linkedTaskId: event.linkedTaskId || event.payload?.linkedTaskId || null,
    };

    
    const handleShowHistory = () => setShowDiff(true);

    
    const handleAddReaction = (emoji) => {
        actions.addReaction?.(enrichedMessage._id, emoji);
    };

    const handleDelete = (scope = 'everyone') => {
        
        actions.deleteMessage?.(enrichedMessage._id, scope);
    };

    const handlePin = () => {
        if (enrichedMessage.isPinned) {
            actions.unpinMessage?.(enrichedMessage._id);
        } else {
            actions.pinMessage?.(enrichedMessage._id);
        }
    };

    
    
    
    
    const handleForward = () => {
        actions.forwardMessage?.(enrichedMessage._id);
    };

    const handleThreadOpen = () => {
        onThreadOpen?.(enrichedMessage);
    };

    const renderChecklist = msgType === 'checklist' && enrichedMessage.checklist?.length > 0;
    const plainText = enrichedMessage.text || enrichedMessage.decryptedContent || '';

    if (isDM) {
        return (
            <>
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
                    threadCounts={threadCounts}
                    translationState={getTranslation(enrichedMessage._id)}
                    onTranslate={requestTranslation}
                    onClearTranslation={clearTranslation}
                    onRemind={actions.onRemind}
                    onConvertToTask={actions.onConvertToTask}
                    isBookmarked={Array.isArray(enrichedMessage.bookmarkedBy) ? enrichedMessage.bookmarkedBy.some(id => String(id?._id || id) === String(currentUserId)) : false}
                    onBookmarkToggle={() => {}}
                />
                {renderChecklist && (
                    <div style={{ paddingLeft: 52, paddingRight: 16, paddingBottom: 4 }}>
                        <ChecklistMessage
                            messageId={enrichedMessage._id}
                            checklist={enrichedMessage.checklist}
                        />
                    </div>
                )}
                {showDiff && (
                    <Suspense fallback={null}>
                        <MessageDiffViewer
                            messageId={enrichedMessage._id}
                            currentText={plainText}
                            onClose={() => setShowDiff(false)}
                        />
                    </Suspense>
                )}
            </>
        );
    }

    return (
        <>
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
                threadCounts={threadCounts}
                channelMembers={[]}
                isAdmin={false}
                onRemind={actions.onRemind}
                onShowHistory={handleShowHistory}   
                isBookmarked={
                    Array.isArray(enrichedMessage.bookmarkedBy)
                        ? enrichedMessage.bookmarkedBy.some(
                            id => String(id?._id || id) === String(currentUserId)
                        )
                        : false
                }
                onBookmarkToggle={() => {  }}
                onConvertToTask={actions.onConvertToTask}
                translationState={getTranslation(enrichedMessage._id)}
                onTranslate={requestTranslation}
                onClearTranslation={clearTranslation}
            />
            {renderChecklist && (
                <div style={{ paddingLeft: 56, paddingRight: 16, paddingBottom: 4 }}>
                    <ChecklistMessage
                        messageId={enrichedMessage._id}
                        checklist={enrichedMessage.checklist}
                    />
                </div>
            )}
            {showDiff && (
                <Suspense fallback={null}>
                    <MessageDiffViewer
                        messageId={enrichedMessage._id}
                        currentText={plainText}
                        onClose={() => setShowDiff(false)}
                    />
                </Suspense>
            )}
        </>
    );
}

export default MessageEvent;
