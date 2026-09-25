import React, { useState, useRef, useEffect } from "react";
import api from '@services/api';
import { Smile, MessageSquare, Share, MoreHorizontal, Pin, Trash2 } from "lucide-react";
import TranslatePopover from './TranslatePopover';
import { getAvatarUrl } from '../../../../utils/avatarUtils';
import ReactionPicker from "./reactionPicker";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import EncryptedMessage from "../../EncryptedMessage";
import { Avatar } from "../../../../shared/components/ui";

import ImageMessage from "./types/ImageMessage";
import VideoMessage from "./types/VideoMessage";
import FileMessage from "./types/FileMessage";
import VoiceMessage from "./types/VoiceMessage";

import ContactMessage from "./types/ContactMessage";

import LinkPreviewMessage from "./types/LinkPreviewMessage";

import MeetingMessage from "./types/MeetingMessage";
import { MessageMoreMenu, EditedBadge, TranslationBlock, InlineMessageEditor, useMessageToolbar } from './MessageToolbarParts';
import { hasEditHistory } from '../../../../utils/messageActionUtils';

import { wrapMentions, mentionRenderer } from '../../../../utils/renderWithMentions';
import logger from '../../../../utils/logger';

function DMMessageItem({
    msg,
    selectMode,
    selectedIds,
    toggleSelect,
    openMsgMenuId,
    toggleMsgMenu,
    formatTime,
    replyToMessage,
    forwardMessage,
    currentUserId,
    onOpenThread,
    threadCounts,
    toolbar = {},
    translationState = null,
    onTranslate,
    onClearTranslation,
}) {
    const count = (threadCounts && threadCounts[msg.id]) || msg.replyCount || 0;
    const senderId = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender;
    const isMe = (!!senderId && !!currentUserId && String(senderId) === String(currentUserId)) || msg.sender === "you" || msg.sender === "me";
    const isSelected = selectedIds?.has(msg.id) || false;
    const [showToolbar, setShowToolbar] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [reactionPos, setReactionPos] = useState(null);
    const reactionPickerRef = useRef(null);

    const tb = useMessageToolbar({
        msg, isMe, currentUserId, toolbar, threadCount: count,
        openMsgMenuId, toggleMsgMenu, onOpenThread, replyToMessage, forwardMessage,
        translationState, onTranslate, onClearTranslation,
    });
    const text = tb.text;

    const avatarUrl = msg.senderAvatar || getAvatarUrl({ username: msg.senderName, _id: senderId });
    const initial = msg.senderName ? msg.senderName.charAt(0).toUpperCase() : "?";

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target)) {
                setShowReactionPicker(false);
            }
        };

        if (showReactionPicker) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showReactionPicker]);

    const toggleReaction = async (emoji) => {
        const normalizeId = (id) => (id?._id || id)?.toString();
        const myExistingReaction = msg.reactions?.find(
            (r) => normalizeId(r.userId) === normalizeId(currentUserId) && r.emoji === emoji
        );
        try {
            if (myExistingReaction) {
                await api.delete(`/api/v2/messages/${msg._id || msg.id}/react`, { data: { emoji } });
            } else {
                await api.post(`/api/v2/messages/${msg._id || msg.id}/react`, { emoji });
            }
        } catch (err) {
            logger.error('[DMMessageItem] Reaction toggle failed:', err);
        }
    };


    
    if (msg.type === 'system' || msg.backend?.type === 'system') {
        const sd = msg.systemData || msg.backend?.systemData || {};
        const ev = msg.systemEvent || msg.backend?.systemEvent || '';
        const isMeFn = (id) => String(id) === String(currentUserId);
        const name = (id, fallback) => isMeFn(id) ? 'You' : (fallback || 'Someone');
        const textMap = {
            member_joined: () => `${name(sd.userId, sd.userName)} joined #${sd.channelName || 'this channel'}`,
            member_left: () => `${name(sd.userId, sd.userName)} left #${sd.channelName || 'this channel'}`,
            member_invited: () => `${name(sd.inviterId, sd.inviterName)} invited ${isMeFn(sd.invitedUserId) ? 'you' : (sd.invitedUserName || 'someone')} to #${sd.channelName || 'this channel'}`,
            member_removed: () => `${name(sd.removedById, sd.removedByName)} removed ${isMeFn(sd.removedUserId) ? 'you' : (sd.removedUserName || 'someone')}`,
            channel_created: () => `${name(sd.userId, sd.userName)} created this channel`,
            channel_renamed: () => `${name(sd.userId, sd.userName)} renamed the channel from #${sd.oldName} to #${sd.newName}`,
            admin_assigned: () => `${name(sd.assignerId, sd.assignerName)} made ${isMeFn(sd.assignedUserId) ? 'you' : (sd.assignedUserName || 'someone')} an admin`,
            admin_demoted: () => `${name(sd.demoterId, sd.demoterName)} removed ${isMeFn(sd.demotedUserId) ? 'your' : `${sd.demotedUserName || 'someone'}'s`} admin role`,
            messages_cleared: () => `${name(sd.userId, sd.userName)} cleared the message history`,
        };
        const displayText = textMap[ev]?.() || msg.payload?.text || msg.text || 'System event';
        return (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                <div style={{ backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', padding: '3px 12px', borderRadius: '99px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {displayText}
                </div>
            </div>
        );
    }

    
    if (msg.isDeletedUniversally) {
        return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 16px', opacity: 0.55, position: 'relative' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}
            >
                <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '2px', backgroundColor: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={12} style={{ color: 'var(--text-muted)' }} />
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', padding: '4px 0' }}>
                        Message deleted by {String(msg.deletedBy) === String(currentUserId) ? 'You' : (msg.deletedByName || 'Unknown')}
                    </div>
                </div>
            </div>
        );
    }

    
    const toolbarBtn = (active = false) => ({
        padding: '4px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
        borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? 'var(--accent)' : 'var(--text-muted)', transition: '100ms ease',
    });
    const hasEdits = hasEditHistory(msg);
    const toolbarVisible = !msg.isDeleted && !tb.isEditing && (showToolbar || tb.menuOpen || showReactionPicker || !!tb.translatePopover);

    return (
        <div
            style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '2px 16px', position: 'relative',
                backgroundColor: isSelected ? 'rgba(184,149,106,0.06)' : msg.isPinned ? 'rgba(184,149,106,0.04)' : 'transparent',
                borderLeft: msg.isPinned ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'background-color 80ms ease',
            }}
            onMouseEnter={e => { setShowToolbar(true); if (!isSelected && !msg.isPinned) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={e => { setShowToolbar(false); if (!isSelected && !msg.isPinned) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
            {}
            {selectMode && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4px', paddingRight: '4px' }}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(msg.id)}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                </div>
            )}

            {}
            <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                <Avatar
                    src={avatarUrl}
                    username={msg.senderName}
                    fallback={initial}
                    alt={msg.senderName}
                    size="sm"
                    style={isMe ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : {}}
                />
            </div>

            {}
            <div style={{ flex: 1, minWidth: 0, paddingRight: '96px', position: 'relative' }}>
                {}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.4 }}>{msg.senderName || 'Unknown'}</span>
                    {msg.isPinned && <Pin size={10} style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} title={msg.pinnedByName ? `Pinned by ${msg.pinnedByName}` : 'Pinned'} />}
                </div>

                {}
                <span style={{ position: 'absolute', top: '2px', right: '16px', fontSize: '10px', color: 'var(--text-muted)', userSelect: 'none' }}>
                    {formatTime(msg.ts)}
                </span>

                {}
                {msg.repliedTo && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', padding: '0 4px' }}>
                        <div style={{ width: '2px', backgroundColor: 'var(--accent)', borderRadius: '1px', flexShrink: 0, alignSelf: 'stretch', opacity: 0.6 }}></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                <MessageSquare size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{msg.repliedTo.senderName}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                                {msg.repliedTo.payload?.text || '🔒 Encrypted message'}
                            </div>
                        </div>
                    </div>
                )}

                {}
                {!msg.isDeleted && msg.attachment && (
                    <div className="mt-0.5">
                        {msg.type === 'image' && <ImageMessage msg={msg} />}
                        {msg.type === 'video' && <VideoMessage msg={msg} />}
                        {msg.type === 'file' && <FileMessage msg={msg} />}
                        {msg.type === 'voice' && <VoiceMessage msg={msg} />}
                    </div>
                )}
                {}
                {!msg.isDeleted && msg.type === 'contact' && (
                    <div className="mt-0.5">
                        <ContactMessage msg={msg} />
                    </div>
                )}

                {}
                {!msg.isDeleted && msg.type === 'meeting' && msg.meeting && (
                    <div className="mt-0.5">
                        <MeetingMessage meeting={msg.meeting} />
                    </div>
                )}

                {}
                {(!msg.attachment || msg.text) && msg.type !== 'contact' && msg.type !== 'meeting' && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'file' && msg.type !== 'voice' && (
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.65, overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '60%' }} className="message-content">
                        {msg.isDeleted ? (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Message deleted</span>
                        ) : tb.isEditing ? (
                            <InlineMessageEditor initialText={text} onSave={tb.saveEdit} onCancel={tb.cancelEdit} />
                        ) : text ? (
                            <ReactMarkdown
                                remarkPlugins={[remarkBreaks]}
                                components={{
                                    a: ({ node, children, ...props }) => (
                                        <a
                                            {...props}
                                            style={{ color: 'var(--accent)' }}
                                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {children}
                                        </a>
                                    ),
                                    ul: ({ node, ...props }) => <ul {...props} style={{ listStyleType: 'disc', paddingLeft: '18px', margin: '4px 0' }} />,
                                    ol: ({ node, ...props }) => <ol {...props} style={{ listStyleType: 'decimal', paddingLeft: '18px', margin: '4px 0' }} />,
                                    del: mentionRenderer(msg.senderName),
                                }}
                            >
                                {wrapMentions(text)}
                            </ReactMarkdown>
                        ) : msg.payload?.isEncrypted ? (
                            <EncryptedMessage
                                ciphertext={msg.payload.ciphertext}
                                messageIv={msg.payload.messageIv}
                                conversationId={msg.dmSessionId || msg.conversationId}
                                conversationType="dm"
                                parentMessageId={msg.parentId || null}
                            />
                        ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No message content</span>
                        )}
                    </div>
                )}

                {}
                {!msg.isDeleted && msg.linkPreview?.url && (
                    <LinkPreviewMessage preview={msg.linkPreview} />
                )}

                {}
                {!msg.isDeleted && hasEdits && !tb.isEditing && (
                    <EditedBadge msg={msg} onOpen={tb.showHistory} />
                )}
                <TranslationBlock state={translationState} onClear={tb.clearTranslation} onRetry={tb.retryTranslation} />

                {msg.sending && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>Sending...</div>}
                {msg.failed && <div style={{ fontSize: '11px', color: 'var(--state-danger)', fontWeight: 500, marginTop: '2px' }}>Failed to send</div>}

                {}
                {msg.reactions && msg.reactions.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                                acc[r.emoji] = acc[r.emoji] || [];
                                const uid = (r.userId?._id || r.userId)?.toString();
                                acc[r.emoji].push(uid);
                                return acc;
                            }, {})
                        ).map(([emoji, users]) => {
                            const myReaction = users.includes(currentUserId?.toString());
                            return (
                                <button
                                    key={emoji}
                                    onClick={() => toggleReaction(emoji)}
                                    style={{
                                        padding: '1px 7px', borderRadius: '99px', fontSize: '13px', fontFamily: 'var(--font)',
                                        backgroundColor: myReaction ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)',
                                        border: `1px solid ${myReaction ? 'var(--accent)' : 'var(--border-default)'}`,
                                        color: myReaction ? 'var(--accent)' : 'var(--text-secondary)',
                                        cursor: 'pointer', transition: '120ms ease', outline: 'none',
                                    }}
                                    onMouseEnter={e => { if (!myReaction) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                    onMouseLeave={e => { if (!myReaction) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                                >
                                    {emoji} {users.length}
                                </button>
                            );
                        })}
                    </div>
                )}
                {count > 0 && onOpenThread && !msg.isDeleted && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenThread(msg.id); }}
                        style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        <MessageSquare size={12} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font)' }}>
                            {count} {count === 1 ? 'reply' : 'replies'}
                        </span>
                        {msg.lastReplyAt && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>
                                Last reply at {formatTime(msg.lastReplyAt)}
                            </span>
                        )}
                    </div>
                )}

            </div>

            {}
            <div style={{
                position: 'absolute', top: '2px', right: '96px',
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                borderRadius: '2px', padding: '2px', display: 'flex', alignItems: 'center',
                zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                opacity: toolbarVisible ? 1 : 0,
                pointerEvents: toolbarVisible ? 'auto' : 'none',
                transition: 'opacity 100ms ease',
            }}>
                <div style={{ position: 'relative' }} ref={reactionPickerRef}>
                    <button
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            setReactionPos({ right: window.innerWidth - rect.right, openUp: spaceBelow < 320, top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4 });
                            setShowReactionPicker(v => !v);
                        }}
                        title="React" style={toolbarBtn(showReactionPicker)}
                        onMouseEnter={e => { if (!showReactionPicker) e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { if (!showReactionPicker) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <Smile size={14} />
                    </button>
                    {showReactionPicker && reactionPos && (
                        <div style={{ position: 'fixed', zIndex: 999, right: reactionPos.right, ...(reactionPos.openUp ? { bottom: reactionPos.bottom } : { top: reactionPos.top }) }}>
                            <ReactionPicker onSelect={(emoji) => { toggleReaction(emoji); setShowReactionPicker(false); }} />
                        </div>
                    )}
                </div>

                {onOpenThread && <button onClick={() => onOpenThread(msg.id)} title="Reply in thread" style={toolbarBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><MessageSquare size={14} /></button>}
                {forwardMessage && <button onClick={() => forwardMessage(msg.id)} title="Forward" style={toolbarBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><Share size={14} /></button>}

                <button
                    onClick={tb.openMenu}
                    title="More" aria-haspopup="menu" aria-expanded={tb.menuOpen}
                    style={toolbarBtn(tb.menuOpen)}
                    onMouseEnter={e => { if (!tb.menuOpen) e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { if (!tb.menuOpen) e.currentTarget.style.color = 'var(--text-muted)'; }}
                ><MoreHorizontal size={14} /></button>
            </div>
            {tb.menuOpen && <MessageMoreMenu anchor={tb.menuAnchor} groups={tb.groups} onClose={tb.closeMenu} />}
            {tb.translatePopover && (
                <TranslatePopover
                    pos={tb.translatePopover.pos}
                    status={null}
                    onSelect={tb.selectLanguage}
                    onClose={tb.closeTranslatePopover}
                    onRetry={tb.retryTranslation}
                />
            )}
        </div>
    );
}

export default React.memo(DMMessageItem, (prevProps, nextProps) => {
    const p = prevProps.msg;
    const n = nextProps.msg;
    return (
        p.id === n.id &&
        p.text === n.text &&
        p.decryptedContent === n.decryptedContent &&
        p.editedAt === n.editedAt &&
        p.version === n.version &&
        p.restoredFromVersion === n.restoredFromVersion &&
        p.isPinned === n.isPinned &&
        p.pinnedByName === n.pinnedByName &&
        p.isDeleted === n.isDeleted &&
        p.isDeletedUniversally === n.isDeletedUniversally &&
        p.sending === n.sending &&
        p.failed === n.failed &&
        p.replyCount === n.replyCount &&
        p.lastReplyAt === n.lastReplyAt &&
        p.dmSessionId === n.dmSessionId &&
        prevProps.selectMode === nextProps.selectMode &&
        prevProps.selectedIds === nextProps.selectedIds &&
        prevProps.openMsgMenuId === nextProps.openMsgMenuId &&
        prevProps.translationState === nextProps.translationState &&
        prevProps.toolbar === nextProps.toolbar &&
        (prevProps.threadCounts?.[p.id] || 0) === (nextProps.threadCounts?.[n.id] || 0) &&
        JSON.stringify(p.bookmarkedBy) === JSON.stringify(n.bookmarkedBy) &&
        (p.editHistory?.length || 0) === (n.editHistory?.length || 0) &&
        JSON.stringify(p.repliedTo) === JSON.stringify(n.repliedTo) &&
        JSON.stringify(p.reactions) === JSON.stringify(n.reactions)
    );
});
