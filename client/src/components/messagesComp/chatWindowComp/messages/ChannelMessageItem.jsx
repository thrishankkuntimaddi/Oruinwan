import React, { useState, useRef, useEffect, useCallback } from "react";
import api from '@services/api';
import {
    Smile, MessageSquare, Share, MoreHorizontal, Pin, Copy, Trash2, Info, Pencil, Check, X,
    Hash, UserCheck, LogOut, UserPlus, UserMinus, Shield, ShieldOff,
    PenLine, FileText, Lock, PinIcon, Eraser, History, Globe, Bookmark, Bell, CheckSquare, Sparkles
} from "lucide-react";
import TranslatePopover from './TranslatePopover';
import { getAvatarUrl } from '../../../../utils/avatarUtils';
import ReactionPicker from "./reactionPicker";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import EncryptedMessage from "../../EncryptedMessage";
import { Avatar } from "../../../../shared/components/ui";
// Phase 7.1 — Attachment type renderers
import ImageMessage from "./types/ImageMessage";
import VideoMessage from "./types/VideoMessage";
import FileMessage from "./types/FileMessage";
import VoiceMessage from "./types/VoiceMessage";
// Phase 7.4 — Contact card
import ContactMessage from "./types/ContactMessage";
// Phase 7.5 — Link preview
import LinkPreviewMessage from "./types/LinkPreviewMessage";
// Phase 7.6 — Meeting card
import MeetingMessage from "./types/MeetingMessage";
// Mentions — highlight @username chips
import { wrapMentions, mentionRenderer } from '../../../../utils/renderWithMentions';

/* ---------------------------------------------------------
   CHANNEL MessageItem Component (Slack Style)
--------------------------------------------------------- */
function ChannelMessageItem({
    msg,
    selectMode,
    selectedIds,
    toggleSelect,
    openMsgMenuId,
    toggleMsgMenu,
    formatTime,
    addReaction,
    pinMessage,
    replyToMessage,
    forwardMessage,
    copyMessage,
    deleteMessage,
    infoMessage,
    currentUserId,
    onOpenThread,
    threadCounts,
    channelMembers,
    isAdmin = false, // Admin check for pin permissions
    // Phase 1 — Bookmarks, Reminders, Edit History
    onRemind,
    onShowHistory,
    isBookmarked = false,
    onBookmarkToggle,
    onConvertToTask,           // (msgId) => void — convert message to in-app Task
    // Translation (from useTranslation hook in MessagesContainer)
    translationState = null,   // { status, translatedText, language, detectedLang } | null
    onTranslate,               // (msgId, text, langCode) => void
    onClearTranslation,        // (msgId) => void
}) {
    // TEMPORARY FIX: Fallback to msg.replyCount if threadCounts missing
    const count = (threadCounts && threadCounts[msg.id]) || msg.replyCount || 0;

    // ✅ Fix: Robust isMe — use String() to handle ObjectId vs string type mismatch
    const senderId = msg.sender?._id || msg.senderId || (typeof msg.sender === 'string' ? msg.sender : null);
    const isMe = !!senderId && !!currentUserId && String(senderId) === String(currentUserId);
    const isSelected = selectedIds?.has(msg.id) || false;
    const [showToolbar, setShowToolbar] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionPickerRef = useRef(null);
    // Translate popover state
    const [translatePopover, setTranslatePopover] = useState(null); // { pos } | null
    const [lastLangCode, setLastLangCode] = useState(null); // for retry
    // Fixed-position tracking for dropdowns — escapes scroll container overflow clipping
    const [menuPos, setMenuPos] = useState(null);      // { top, bottom, right, openUp }
    const [reactionPos, setReactionPos] = useState(null);

    // Step 3 — Local edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(msg.decryptedContent || msg.text || '');

    // Avatar Logic — always use a colorful avatar; fall back to DiceBear when no photo set
    const avatarUrl = msg.senderAvatar || getAvatarUrl({ username: msg.senderName, _id: senderId });
    const initial = msg.senderName ? msg.senderName.charAt(0).toUpperCase() : "?";

    // Shared style helpers
    const toolbarBtn = (active = false) => ({
        padding: '4px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
        borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? 'var(--accent)' : 'var(--text-muted)', transition: '100ms ease',
    });
    const menuItem = (label, icon, onClick, accent = false, danger = false) => {
        const color = danger ? 'var(--state-danger)' : accent ? 'var(--accent)' : 'var(--text-secondary)';
        const hoverBg = danger ? 'rgba(192,57,43,0.08)' : 'var(--bg-hover)';
        return (
            <button
                key={label}
                onClick={onClick}
                style={{ width: '100%', textAlign: 'left', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', color, fontSize: '13px', fontFamily: 'var(--font)', transition: '100ms ease' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = hoverBg}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                {icon}{label}
            </button>
        );
    };

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

    // Step 3 — Save edit handler (E2EE-aware)
    const handleSaveEdit = async () => {
        const trimmed = editText.trim();
        const currentText = msg.decryptedContent || msg.text || '';
        if (trimmed === currentText.trim()) {
            setIsEditing(false);
            return;
        }
        if (!trimmed) return; // Don't save empty message
        try {
            const channelId = msg.channelId || (msg.channel && (msg.channel._id || msg.channel));
            const convType = channelId ? 'channel' : 'dm';

            if (channelId) {
                // E2EE path: encrypt then save ciphertext
                const { encryptMessageForSending } = await import('../../../../services/messageEncryptionService');
                const encrypted = await encryptMessageForSending(trimmed, channelId, convType);

                if (encrypted && encrypted.status !== 'ENCRYPTION_NOT_READY') {
                    await api.patch(`/api/v2/messages/${msg._id || msg.id}`, {
                        ciphertext: encrypted.ciphertext,
                        messageIv: encrypted.messageIv
                    });
                } else {
                    // Fallback: plaintext (only if key not available)
                    await api.patch(`/api/v2/messages/${msg._id || msg.id}`, { text: trimmed });
                }
            } else {
                // No channel context — send plaintext
                await api.patch(`/api/v2/messages/${msg._id || msg.id}`, { text: trimmed });
            }
        } catch (err) {
            console.error('Edit failed:', err);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditText(msg.decryptedContent || msg.text || '');
        setIsEditing(false);
    };

    // Step 5 — Reaction toggle handler (one reaction per user, server enforces swap)
    const toggleReaction = async (emoji) => {
        const normalizeId = (id) => (id?._id || id)?.toString();

        // Check if I already reacted with THIS EXACT emoji
        const myExistingReaction = msg.reactions?.find(
            (r) => normalizeId(r.userId) === normalizeId(currentUserId) && r.emoji === emoji
        );

        try {
            if (myExistingReaction) {
                // Same emoji — toggle off (remove)
                await api.delete(`/api/v2/messages/${msg._id || msg.id}/react`, { data: { emoji } });
            } else {
                // New or different emoji — server will auto-swap if user already has one
                await api.post(`/api/v2/messages/${msg._id || msg.id}/react`, { emoji });
            }
        } catch (err) {
            console.error('Reaction toggle failed:', err);
        }
    };

    // System message renderer — reads from systemEvent + systemData
    if (msg.type === 'system' || msg.backend?.type === 'system') {
        const sd = msg.systemData || msg.backend?.systemData || {};
        const ev = msg.systemEvent || msg.backend?.systemEvent || '';

        const isMe = (id) => String(id) === String(currentUserId);
        const name = (id, fallback) => isMe(id) ? 'You' : (fallback || 'Someone');

        // { icon: LucideComponent, color: tailwind bg class, text fn }
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

    // ✨ Deleted Message Rendering
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
            {/* Selection Checkbox */}
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

            {/* Avatar */}
            <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                <Avatar
                    src={avatarUrl}
                    fallback={initial}
                    alt={msg.senderName}
                    size="sm"
                    style={isMe ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : {}}
                />
            </div>

            {/* Content — always has right padding so toolbar never overlaps text */}
            <div className="flex-1 min-w-0 pr-24 relative">
                {/* Header: Name + Pin Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.4 }}>{msg.senderName || 'Unknown'}</span>
                        {msg.isPinned && (
                            <Pin size={10} style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} title={msg.pinnedByName ? `Pinned by ${msg.pinnedByName}` : 'Pinned'} />
                        )}
                    </div>
                </div>

                {/* Timestamp */}
                <span style={{ position: 'absolute', top: '2px', right: '16px', fontSize: '10px', color: 'var(--text-muted)', userSelect: 'none' }}>
                    {formatTime(msg.ts)}
                </span>

                {/* Reply Preview */}
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

                {/* Phase 7.1/7.4 — Rich message type rendering (image/video/file/voice/contact) */}
                {!msg.isDeleted && msg.attachment && (
                    <div className="mt-0.5">
                        {msg.type === 'image' && <ImageMessage msg={msg} />}
                        {msg.type === 'video' && <VideoMessage msg={msg} />}
                        {msg.type === 'file' && <FileMessage msg={msg} />}
                        {msg.type === 'voice' && <VoiceMessage msg={msg} />}
                    </div>
                )}
                {/* Phase 7.4 — Contact card (has contact, not attachment) */}
                {!msg.isDeleted && msg.type === 'contact' && (
                    <div className="mt-0.5">
                        <ContactMessage msg={msg} />
                    </div>
                )}

                {/* Phase 7.6 — Meeting card */}
                {!msg.isDeleted && msg.type === 'meeting' && msg.meeting && (
                    <div className="mt-0.5">
                        <MeetingMessage meeting={msg.meeting} />
                    </div>
                )}

                {/* Message Text — Step 1: soft delete, Step 3: inline edit */}
                {/* Only render text block for text/encrypted messages, not pure attachment or card messages */}
                {(!msg.attachment || msg.text) && msg.type !== 'contact' && msg.type !== 'meeting' && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'file' && msg.type !== 'voice' && (
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.65, overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '60%' }} className="message-content">
                        {msg.isDeleted ? (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Message deleted</span>
                        ) : isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '480px' }}>
                                <textarea
                                    style={{ width: '100%', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-accent)', borderRadius: '2px', padding: '8px 12px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'none', minHeight: '60px', fontFamily: 'var(--font)', boxSizing: 'border-box', lineHeight: 1.6 }}
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    autoFocus
                                    rows={Math.min(6, (editText.match(/\n/g) || []).length + 2)}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button onClick={handleSaveEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', backgroundColor: 'var(--accent)', color: '#0c0c0c', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', outline: 'none' }}>
                                        <Check size={11} /> Save
                                    </button>
                                    <button onClick={handleCancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', backgroundColor: 'var(--bg-active)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', outline: 'none' }}>
                                        <X size={11} /> Cancel
                                    </button>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Enter to save · Esc to cancel</span>
                                </div>
                            </div>
                        ) : msg.text ? (
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
                                {wrapMentions(msg.text)}
                            </ReactMarkdown>
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

                {/* Translation Display Block */}
                {translationState?.status === 'done' && translationState.translatedText && (
                    <div style={{ marginTop: '6px', maxWidth: '60%' }}>
                        <div style={{ padding: '8px 12px', borderRadius: '2px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-accent)', fontSize: '13px', lineHeight: 1.65, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {translationState.translatedText}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            {translationState.detectedLang && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Detected: {translationState.detectedLang.toUpperCase()}</span>
                            )}
                            <button onClick={() => onClearTranslation?.(msg._id || msg.id)} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none' }}>Show original</button>
                        </div>
                    </div>
                )}
                {translationState?.status === 'error' && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--state-danger)' }}>
                        Translation failed.
                        <button
                            onClick={() => onTranslate?.(msg._id || msg.id, msg.text || '', lastLangCode)}
                            className="ml-1 underline"
                        >
                            Retry
                        </button>
                    </div>
                )}
                {/* Edit badge with history popover */}
                {msg.editedAt && !msg.isDeleted && (
                    <EditedBadge
                        editHistory={msg.editHistory}
                        editedAt={msg.editedAt}
                        conversationId={msg.channel || msg.channelId || msg.conversationId}
                        conversationType={msg.channel || msg.channelId ? 'channel' : 'dm'}
                    />
                )}

                {/* Phase 7.5 — Link preview card */}
                {!msg.isDeleted && msg.linkPreview?.url && (
                    <LinkPreviewMessage preview={msg.linkPreview} />
                )}

                {/* Step 5 — Reaction bar (grouped emoji buttons) */}
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

                {/* Sending/Failed States */}
                {msg.sending && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>Sending...</div>}
                {msg.failed && <div style={{ fontSize: '12px', color: 'var(--state-danger)', fontWeight: 500, marginTop: '4px' }}>Failed to send</div>}



                {/* Thread Reply Link */}
                {count > 0 && onOpenThread && !msg.isDeleted && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenThread(msg.id); }}
                        style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {/* Reply avatars */}
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

            {/* Hover Toolbar */}
            <div style={{
                position: 'absolute', top: '2px', right: '96px',
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                borderRadius: '2px', padding: '2px', display: 'flex', alignItems: 'center',
                zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                opacity: (!msg.isDeleted && (showToolbar || openMsgMenuId === msg.id || showReactionPicker || !!translatePopover)) ? 1 : 0,
                pointerEvents: (!msg.isDeleted && (showToolbar || openMsgMenuId === msg.id || showReactionPicker || !!translatePopover)) ? 'auto' : 'none',
                transition: 'opacity 100ms ease',
            }}>

                {/* Reaction Trigger */}
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

                <button onClick={() => onOpenThread && onOpenThread(msg.id)} title="Thread" style={toolbarBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><MessageSquare size={14} /></button>
                <button onClick={() => forwardMessage(msg.id)} title="Forward" style={toolbarBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><Share size={14} /></button>

                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            setMenuPos({ right: window.innerWidth - rect.right, openUp: spaceBelow < 260, top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4 });
                            toggleMsgMenu(e, msg.id);
                        }}
                        title="More" style={toolbarBtn(openMsgMenuId === msg.id)}
                        onMouseEnter={e => { if (openMsgMenuId !== msg.id) e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { if (openMsgMenuId !== msg.id) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    ><MoreHorizontal size={14} /></button>
                    {openMsgMenuId === msg.id && menuPos && (
                        <div
                            style={{
                                position: 'fixed', zIndex: 999, width: '200px',
                                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                                borderRadius: '2px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                paddingTop: '4px', paddingBottom: '4px', fontSize: '13px',
                                right: menuPos.right, ...(menuPos.openUp ? { bottom: menuPos.bottom } : { top: menuPos.top })
                            }}
                        >

                            {menuItem('Copy text',    <Copy size={13} />,         () => { navigator.clipboard.writeText(msg.text || msg.payload?.text || ''); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {menuItem('Reply',         <MessageSquare size={13} />,() => { replyToMessage?.(msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {menuItem(msg.isPinned ? 'Unpin message' : 'Pin message', <Pin size={13} />, async () => { try { await api.post(`/api/v2/messages/${msg._id || msg.id}/pin`, { pin: !msg.isPinned }); } catch {} toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {menuItem('Message info', <Info size={13} />,           () => { infoMessage?.(msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {isMe && !msg.isDeleted && menuItem('Edit message', <Pencil size={13} />, () => { setIsEditing(true); setEditText(msg.decryptedContent || msg.text || ''); toggleMsgMenu({ stopPropagation: () => {} }, null); })}

                            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

                            {menuItem(
                                isBookmarked ? 'Remove Bookmark' : 'Save / Bookmark',
                                <Bookmark size={13} style={{ fill: isBookmarked ? 'currentColor' : 'none' }} />,
                                async () => { try { await api.post(`/api/v2/messages/${msg._id || msg.id}/bookmark`); onBookmarkToggle?.(msg._id || msg.id); } catch {} toggleMsgMenu({ stopPropagation: () => {} }, null); },
                                isBookmarked
                            )}
                            {onRemind && menuItem('Remind Me', <Bell size={13} />, () => { onRemind(msg._id || msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {onConvertToTask && menuItem('Convert to Task', <CheckSquare size={13} />, async () => { await onConvertToTask(msg._id || msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {(msg.replyCount > 0 || (threadCounts && threadCounts[msg.id] > 0)) && menuItem('Summarize Thread', <Sparkles size={13} />, async () => { toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {onShowHistory && msg.editHistory?.length > 0 && menuItem('Edit History', <History size={13} />, () => { onShowHistory(msg); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {msg.text && menuItem(translationState?.status === 'done' ? 'Show original' : 'Translate', <Globe size={13} />, (e) => {
                                if (translationState?.status === 'done') { onClearTranslation?.(msg._id || msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); return; }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const spaceBelow = window.innerHeight - rect.bottom;
                                setTranslatePopover({ pos: { right: window.innerWidth - rect.right, ...(spaceBelow < 240 ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) } });
                            })}
                            {translatePopover && (
                                <TranslatePopover
                                    pos={translatePopover.pos}
                                    status={translationState?.status === 'loading' ? 'loading' : translationState?.status === 'error' ? 'error' : null}
                                    onSelect={(langCode) => { setLastLangCode(langCode); onTranslate?.(msg._id || msg.id, msg.text || '', langCode); setTranslatePopover(null); toggleMsgMenu({ stopPropagation: () => {} }, null); }}
                                    onClose={() => { setTranslatePopover(null); toggleMsgMenu({ stopPropagation: () => {} }, null); }}
                                    onRetry={() => { if (lastLangCode) { onTranslate?.(msg._id || msg.id, msg.text || '', lastLangCode); setTranslatePopover(null); toggleMsgMenu({ stopPropagation: () => {} }, null); } }}
                                />
                            )}

                            {(isMe || isAdmin) && (
                                <>
                                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
                                    {menuItem('Delete for me',       <Trash2 size={13} />, async () => { try { await deleteMessage(msg._id || msg.id, 'me'); } catch {} toggleMsgMenu({ stopPropagation: () => {} }, null); }, false, true)}
                                    {isMe && menuItem('Delete for everyone', <Trash2 size={13} />, async () => { try { await deleteMessage(msg._id || msg.id, 'everyone'); } catch {} toggleMsgMenu({ stopPropagation: () => {} }, null); }, false, true)}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChannelMessageItem;
/* export default React.memo(ChannelMessageItem, (prevProps, nextProps) => {
    // Re-render only if these specific props change
    return (
        prevProps.msg.id === nextProps.msg.id &&
        prevProps.msg.payload?.text === nextProps.msg.payload?.text &&
        prevProps.msg.isPinned === nextProps.msg.isPinned &&
        prevProps.msg.sending === nextProps.msg.sending &&
        prevProps.msg.failed === nextProps.msg.failed &&
        prevProps.selectMode === nextProps.selectMode &&
        prevProps.selectedIds === nextProps.selectedIds &&
        prevProps.openMsgMenuId === nextProps.openMsgMenuId &&
        JSON.stringify(prevProps.msg.reactions) === JSON.stringify(nextProps.msg.reactions) &&
        prevProps.msg.replyCount === nextProps.msg.replyCount && // ✅ Check msg.replyCount
        prevProps.threadCounts?.[prevProps.msg.id] === nextProps.threadCounts?.[nextProps.msg.id]
    );
}); */

// ── EditedBadge ──────────────────────────────────────────────────────────────
// Shows "(edited)" next to a message. If editHistory has entries, clicking opens
// a popover listing all previous versions with timestamps.
function EditedBadge({ editHistory = [], editedAt, conversationId, conversationType }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const hasHistory = editHistory.length > 0;

    // Close when clicking outside
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const formatTs = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} ref={ref}>
            <button
                onClick={() => hasHistory && setOpen(v => !v)}
                style={{
                    fontSize: '11px', fontStyle: 'italic', marginLeft: '4px',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', outline: 'none', padding: 0,
                    color: hasHistory ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: hasHistory ? 'pointer' : 'default',
                    transition: 'color 150ms ease',
                    fontFamily: 'var(--font)',
                }}
                onMouseEnter={e => { if (hasHistory) e.currentTarget.style.color = 'var(--accent-hover)'; }}
                onMouseLeave={e => { if (hasHistory) e.currentTarget.style.color = 'var(--accent)'; }}
                title={hasHistory ? 'View edit history' : `Edited ${formatTs(editedAt)}`}
            >
                <History size={10} />
                (edited)
            </button>

            {open && hasHistory && (
                <div style={{
                    position: 'absolute', bottom: '100%', left: 0, marginBottom: '6px',
                    width: '280px', zIndex: 50, overflow: 'hidden',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: '2px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                }}>
                    {/* Popover header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 12px', borderBottom: '1px solid var(--border-default)',
                    }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <History size={12} /> Edit History
                        </span>
                        <button
                            onClick={() => setOpen(false)}
                            style={{ background: 'none', border: 'none', outline: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px', borderRadius: '2px', transition: '100ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            <X size={12} />
                        </button>
                    </div>

                    {/* History entries */}
                    <div style={{ maxHeight: '192px', overflowY: 'auto' }}>
                        {[...editHistory].reverse().map((entry, i) => (
                            <div key={i} style={{
                                padding: '8px 12px',
                                borderBottom: i < editHistory.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    {i === 0 ? 'Most recent previous version' : `Version ${editHistory.length - i}`}
                                    {' · '}{formatTs(entry.editedAt)}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-words', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                    {entry.isEncrypted && entry.ciphertext ? (
                                        <EncryptedMessage
                                            ciphertext={entry.ciphertext}
                                            messageIv={entry.messageIv}
                                            conversationId={conversationId}
                                            conversationType={conversationType || 'channel'}
                                            parentMessageId={null}
                                        />
                                    ) : entry.text && entry.text !== '[encrypted]' ? (
                                        entry.text
                                    ) : (
                                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            🔒 Previous version was encrypted
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </span>
    );
}
