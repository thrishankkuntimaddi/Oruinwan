import React, { useState, useRef, useEffect } from "react";
import api from '@services/api';
import {
    Smile, MessageSquare, Share, MoreHorizontal, Pin, Trash2, Info,
    Hash, UserCheck, LogOut, UserPlus, UserMinus, Shield, ShieldOff,
    PenLine, FileText, Lock, PinIcon, Eraser
} from "lucide-react";
import TranslatePopover from './TranslatePopover';
import { getAvatarUrl } from '../../../../utils/avatarUtils';
import ReactionPicker from "./reactionPicker";
import EncryptedMessage from "../../EncryptedMessage";
import { Avatar } from "../../../../shared/components/ui";

import ImageMessage from "./types/ImageMessage";
import VideoMessage from "./types/VideoMessage";
import FileMessage from "./types/FileMessage";
import VoiceMessage from "./types/VoiceMessage";

import ContactMessage from "./types/ContactMessage";

import LinkPreviewMessage from "./types/LinkPreviewMessage";

import MeetingMessage from "./types/MeetingMessage";
import { MessageMoreMenu, EditedBadge, MessageBadges, TranslationBlock, InlineMessageEditor, useMessageToolbar } from './MessageToolbarParts';
import { hasEditHistory } from '../../../../utils/messageActionUtils';

import MessageMarkdown from '../../../../shared/components/messages/MessageMarkdown';
import ProfileTrigger from '../../../profileCard/ProfileTrigger';
import logger from '../../../../utils/logger';

function ChannelMessageItem({
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

    const senderId = msg.sender?._id || msg.senderId || (typeof msg.sender === 'string' ? msg.sender : null);
    const isMe = !!senderId && !!currentUserId && String(senderId) === String(currentUserId);
    const isSelected = selectedIds?.has(msg.id) || false;
    const [showToolbar, setShowToolbar] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionPickerRef = useRef(null);
    const [reactionPos, setReactionPos] = useState(null);

    const tb = useMessageToolbar({
        msg, isMe, currentUserId, toolbar, threadCount: count,
        openMsgMenuId, toggleMsgMenu, onOpenThread, replyToMessage, forwardMessage,
        translationState, onTranslate, onClearTranslation,
    });
    const text = tb.text;

    const avatarUrl = msg.senderAvatar || getAvatarUrl({ username: msg.senderName, _id: senderId });
    const initial = msg.senderName ? msg.senderName.charAt(0).toUpperCase() : "?";

    const toolbarBtn = (active = false) => ({
        padding: '4px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
        borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? 'var(--accent)' : 'var(--text-muted)', transition: '100ms ease',
    });

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
            logger.error('Reaction toggle failed:', err);
        }
    };

    
    if (msg.type === 'system' || msg.backend?.type === 'system') {
        const sd = msg.systemData || msg.backend?.systemData || {};
        const ev = msg.systemEvent || msg.backend?.systemEvent || '';

        const isMe = (id) => String(id) === String(currentUserId);
        const name = (id, fallback) => isMe(id) ? 'You' : (fallback || 'Someone');

        
        const eventConfig = {
            channel_created:        { Icon: Hash,      tint: 'rgba(184,149,106,0.15)', text: () => `${name(sd.userId, sd.userName)} created this channel` },
            member_joined:          { Icon: UserCheck,  tint: 'rgba(90,186,138,0.12)',  text: () => `${name(sd.userId, sd.userName)} joined #${sd.channelName || 'this channel'}` },
            member_left:            { Icon: LogOut,     tint: 'rgba(201,168,124,0.12)', text: () => `${name(sd.userId, sd.userName)} left #${sd.channelName || 'this channel'}` },
            member_invited:         { Icon: UserPlus,   tint: 'rgba(184,149,106,0.15)', text: () => `${name(sd.inviterId, sd.inviterName)} invited ${isMe(sd.invitedUserId) ? 'you' : (sd.invitedUserName || 'someone')} to #${sd.channelName || 'this channel'}` },
            member_removed:         { Icon: UserMinus,  tint: 'rgba(224,82,82,0.12)',   text: () => `${name(sd.removedById || sd.removedByUserId, sd.removedByName)} removed ${isMe(sd.removedUserId) ? 'you' : (sd.removedUserName || 'someone')}` },
            admin_assigned:         { Icon: Shield,     tint: 'rgba(184,149,106,0.15)', text: () => msg.text || `${name(sd.assignerId, sd.assignerName)} made ${isMe(sd.assignedUserId) ? 'you' : (sd.assignedUserName || 'someone')} an admin` },
            admin_demoted:          { Icon: ShieldOff,  tint: 'rgba(100,100,100,0.12)', text: () => msg.text || `${name(sd.demoterId, sd.demoterName)} removed ${isMe(sd.demotedUserId) ? 'your' : `${sd.demotedUserName || "someone"}'s`} admin role` },
            channel_renamed:        { Icon: PenLine,    tint: 'rgba(184,149,106,0.12)', text: () => `${name(sd.userId, sd.userName)} renamed the channel from #${sd.oldName} to #${sd.newName}` },
            channel_desc_changed:   { Icon: FileText,   tint: 'rgba(90,186,138,0.10)',  text: () => `${name(sd.userId, sd.userName)} updated the channel description` },
            channel_privacy_changed:{ Icon: Lock,       tint: 'rgba(201,168,124,0.12)', text: () => `${name(sd.userId, sd.userName)} made this channel ${sd.newPrivacy || 'private'}` },
            message_pinned:         { Icon: PinIcon,    tint: 'rgba(184,149,106,0.15)', text: () => `${name(sd.userId, sd.userName)} pinned a message${sd.messageSnippet ? `: "${sd.messageSnippet}"` : ''}` },
            message_unpinned:       { Icon: PinIcon,    tint: 'rgba(184,149,106,0.10)', text: () => `${name(sd.userId, sd.userName)} unpinned a message` },
            messages_cleared:       { Icon: Eraser,     tint: 'rgba(224,82,82,0.10)',   text: () => `${name(sd.userId, sd.userName)} cleared the message history` },
        };

        const config = eventConfig[ev];
        const IconComp = config?.Icon || Info;
        const tint = config?.tint || 'rgba(100,100,100,0.10)';
        const displayText = config?.text?.() || msg.text || msg.payload?.text || 'System event';

        return (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0', padding: '0 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', padding: '3px 12px', borderRadius: '99px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, maxWidth: '480px' }}>
                    <span style={{ flexShrink: 0, width: '16px', height: '16px', borderRadius: '50%', backgroundColor: tint, border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconComp size={9} style={{ color: 'var(--accent)' }} strokeWidth={2.5} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
                </div>
            </div>
        );
    }

    
    if (msg.isDeletedUniversally) {
        return (
            <div className="group" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 16px', opacity: 0.55, position: 'relative' }}
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
                <ProfileTrigger userId={senderId} username={msg.senderName}>
                    <Avatar
                        src={avatarUrl}
                        fallback={initial}
                        alt={msg.senderName}
                        size="sm"
                        style={isMe ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : {}}
                    />
                </ProfileTrigger>
            </div>

            {}
            <div className="flex-1 min-w-0 pr-24 relative">
                {}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ProfileTrigger userId={senderId} username={msg.senderName}><span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.4 }}>{msg.senderName || 'Unknown'}</span></ProfileTrigger>
                        {msg.isPinned && (
                            <Pin size={10} style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} title={msg.pinnedByName ? `Pinned by ${msg.pinnedByName}` : 'Pinned'} />
                        )}
                    </div>
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
                {}
                {(!msg.attachment || msg.text) && msg.type !== 'contact' && msg.type !== 'meeting' && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'file' && msg.type !== 'voice' && (
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.65, overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '60%' }} className="message-content">
                        {msg.isDeleted ? (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Message deleted</span>
                        ) : tb.isEditing ? (
                            <InlineMessageEditor initialText={text} onSave={tb.saveEdit} onCancel={tb.cancelEdit} />
                        ) : text ? (
                            <MessageMarkdown text={text} />
                        ) : msg.payload?.isEncrypted ? (
                            <EncryptedMessage
                                ciphertext={msg.payload.ciphertext}
                                messageIv={msg.payload.messageIv}
                                conversationId={msg.channelId || msg.conversationId}
                                conversationType="channel"
                                parentMessageId={msg.parentId || null}
                            />
                        ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No message content</span>
                        )}

                    </div>
                )}

                {}
                {!msg.isDeleted && hasEdits && !tb.isEditing && (
                    <EditedBadge msg={msg} onOpen={tb.showHistory} />
                )}
                {!msg.isDeleted && <MessageBadges msg={msg} />}
                <TranslationBlock state={translationState} onClear={tb.clearTranslation} onRetry={tb.retryTranslation} />

                {}
                {!msg.isDeleted && msg.linkPreview?.url && (
                    <LinkPreviewMessage preview={msg.linkPreview} />
                )}

                {}
                {!msg.isDeleted && msg.reactions?.length > 0 && (
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

                {}
                {msg.sending && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>Sending...</div>}
                {msg.failed && <div style={{ fontSize: '12px', color: 'var(--state-danger)', fontWeight: 500, marginTop: '4px' }}>Failed to send</div>}

                {}
                {count > 0 && onOpenThread && !msg.isDeleted && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenThread(msg.id); }}
                        style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {}
                        <div style={{ display: 'flex' }}>
                            {msg.replyAvatars && msg.replyAvatars.length > 0 ? (
                                msg.replyAvatars.map((url, i) => (
                                    <img
                                        key={i}
                                        src={url}
                                        alt="Replier"
                                        style={{ width: '18px', height: '18px', borderRadius: '2px', objectFit: 'cover', border: '1px solid var(--bg-surface)', marginLeft: i > 0 ? '-4px' : 0, position: 'relative', zIndex: msg.replyAvatars.length - i }}
                                    />
                                ))
                            ) : (
                                <div style={{ display: 'flex' }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '2px', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-default)' }} />
                                    <div style={{ width: '18px', height: '18px', borderRadius: '2px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', marginLeft: '-4px' }} />
                                </div>
                            )}
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font)' }}>
                            {count} {count === 1 ? 'reply' : 'replies'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>
                            Last reply today at {formatTime(msg.lastReplyAt || msg.ts)}
                        </span>
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
                {/* Hidden when the workspace switched reactions off. */}
                <div style={{ position: 'relative', display: toolbar?.features?.reactions === false ? 'none' : undefined }} ref={reactionPickerRef}>
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

export default React.memo(ChannelMessageItem, (prevProps, nextProps) => {
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
        p.channelId === n.channelId &&
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
