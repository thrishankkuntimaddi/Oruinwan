import React, { useState, useRef, useEffect } from "react";
import api from '@services/api';
import { Smile, MessageSquare, Share, MoreHorizontal, Pin, Copy, Trash2, Info, Pencil, Check, X, Globe, Bookmark, Bell, CheckSquare } from "lucide-react";
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
   DM MessageItem Component (Matches Channel/Slack Style Exactly)
--------------------------------------------------------- */
function DMMessageItem({
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
    // Translation (from useTranslation hook in MessagesContainer)
    translationState = null,
    onTranslate,
    onClearTranslation,
    // Phase 1 — Bookmarks, Reminders, Convert to Task
    onRemind,
    onConvertToTask,
    isBookmarked = false,
    onBookmarkToggle,
}) {
    // dmSessionId is baked into msg by MessageEvent — used for E2EE encryption on edit
    const dmSessionId = msg.dmSessionId || null;
    // Check if message is from current user
    const senderId = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender;
    const isMe = senderId === currentUserId || msg.sender === "you" || msg.sender === "me";
    const isSelected = selectedIds?.has(msg.id) || false;
    const [showToolbar, setShowToolbar] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [menuPos, setMenuPos] = useState(null);
    const [reactionPos, setReactionPos] = useState(null);
    const reactionPickerRef = useRef(null);
    // Translate popover state
    const [translatePopover, setTranslatePopover] = useState(null);
    const [lastLangCode, setLastLangCode] = useState(null);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(msg.text || msg.decryptedContent || '');

    // Keep editText in sync with updated message text (e.g., from real-time socket edits)
    // Only update when NOT actively editing to avoid clobbering the user's in-progress changes
    useEffect(() => {
        if (!isEditing) {
            setEditText(msg.text || msg.decryptedContent || '');
        }
    }, [msg.text, msg.decryptedContent, isEditing]);


    // Avatar Logic — always produce a colorful avatar via DiceBear when no real photo
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

    // Save edit — encrypts new text with DM conversation key, then PATCHes the server
    // Using E2EE ensures both real-time updates AND page reloads show the correct text
    const handleSaveEdit = async () => {
        const trimmed = editText.trim();
        const currentText = msg.text || msg.decryptedContent || '';
        if (trimmed === currentText.trim()) {
            setIsEditing(false);
            return;
        }
        if (!trimmed) return; // Don't save empty message
        try {
            let patchBody = {};
            if (dmSessionId) {
                // E2EE path: encrypt the new text with the DM conversation key
                try {
                    const { encryptMessageForSending } = await import('../../../../services/messageEncryptionService');
                    const encrypted = await encryptMessageForSending(trimmed, dmSessionId, 'dm', null);
                    if (encrypted?.ciphertext && encrypted?.messageIv) {
                        patchBody = { ciphertext: encrypted.ciphertext, messageIv: encrypted.messageIv };
                    } else {
                        // Encryption not ready — fallback to plaintext
                        patchBody = { text: trimmed };
                    }
                } catch (encErr) {
                    console.warn('[DMMessageItem] Encryption failed, falling back to plaintext:', encErr);
                    patchBody = { text: trimmed };
                }
            } else {
                // No dmSessionId available — plaintext fallback
                patchBody = { text: trimmed };
            }
            await api.patch(`/api/v2/messages/${msg._id || msg.id}`, patchBody);
        } catch (err) {
            console.error('[DMMessageItem] Edit failed:', err);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditText(msg.text || '');
        setIsEditing(false);
    };

    // Reaction toggle — POST to add, DELETE to remove (one reaction per user; server auto-swaps emoji)
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
            console.error('[DMMessageItem] Reaction toggle failed:', err);
        }
    };

    // System Message Rendering
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

    // Deleted Message Rendering
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
                    username={msg.senderName}
                    fallback={initial}
                    alt={msg.senderName}
                    size="sm"
                    style={isMe ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : {}}
                />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0, paddingRight: '96px', position: 'relative' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.4 }}>{msg.senderName || 'Unknown'}</span>
                    {msg.isPinned && <Pin size={10} style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} title={msg.pinnedByName ? `Pinned by ${msg.pinnedByName}` : 'Pinned'} />}
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

                {/* Phase 7.1/7.4 — Rich message type rendering */}
                {!msg.isDeleted && msg.attachment && (
                    <div className="mt-0.5">
                        {msg.type === 'image' && <ImageMessage msg={msg} />}
                        {msg.type === 'video' && <VideoMessage msg={msg} />}
                        {msg.type === 'file' && <FileMessage msg={msg} />}
                        {msg.type === 'voice' && <VoiceMessage msg={msg} />}
                    </div>
                )}
                {/* Phase 7.4 — Contact card */}
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

                {/* Message Text */}
                {(!msg.attachment || msg.text) && (
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
                                    ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside ml-1" />,
                                    ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside ml-1" />,
                                    del: mentionRenderer(msg.senderName),
                                }}
                            >
                                {wrapMentions(msg.text)}
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



                {/* Phase 7.5 — Link preview card */}
                {!msg.isDeleted && msg.linkPreview?.url && (
                    <LinkPreviewMessage preview={msg.linkPreview} />
                )}

                {/* Edited + translation display + status */}
                {msg.editedAt && !msg.isDeleted && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}> (edited)</span>
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
                        <button onClick={() => onTranslate?.(msg._id || msg.id, msg.text || '', lastLangCode)} style={{ marginLeft: '4px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'inherit', outline: 'none' }}>Retry</button>
                    </div>
                )}

                {msg.sending && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>Sending...</div>}
                {msg.failed && <div style={{ fontSize: '11px', color: 'var(--state-danger)', fontWeight: 500, marginTop: '2px' }}>Failed to send</div>}

                {/* Reactions */}
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
            </div>

            {/* Hover Toolbar */}
            <div style={{
                position: 'absolute', top: '2px', right: '96px',
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                borderRadius: '2px', padding: '2px', display: 'flex', alignItems: 'center',
                zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                opacity: (showToolbar || openMsgMenuId === msg.id || showReactionPicker || !!translatePopover) ? 1 : 0,
                pointerEvents: (showToolbar || openMsgMenuId === msg.id || showReactionPicker || !!translatePopover) ? 'auto' : 'none',
                transition: 'opacity 100ms ease',
            }}>
                {/* Reaction Picker */}
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

                <button onClick={() => forwardMessage && forwardMessage(msg.id)} title="Forward" style={toolbarBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><Share size={14} /></button>

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
                        <div style={{
                            position: 'fixed', zIndex: 999, width: '200px',
                            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                            borderRadius: '2px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            paddingTop: '4px', paddingBottom: '4px',
                            right: menuPos.right, ...(menuPos.openUp ? { bottom: menuPos.bottom } : { top: menuPos.top })
                        }}>
                            {menuItem('Copy text',    <Copy size={13} />,         () => { copyMessage(msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {menuItem('Reply',        <MessageSquare size={13} />,() => { replyToMessage(msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {menuItem(msg.isPinned ? 'Unpin' : 'Pin', <Pin size={13} />, async () => { try { await api.post(`/api/v2/messages/${msg._id || msg.id}/pin`, { pin: !msg.isPinned }); } catch {} toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {menuItem('Message info',<Info size={13} />,          () => { infoMessage(msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {isMe && !msg.isDeleted && menuItem('Edit', <Pencil size={13} />, () => { setIsEditing(true); setEditText(msg.text || ''); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
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
                            {menuItem(
                                isBookmarked ? 'Remove Bookmark' : 'Save / Bookmark',
                                <Bookmark size={13} style={{ fill: isBookmarked ? 'currentColor' : 'none' }} />,
                                async () => { try { await api.post(`/api/v2/messages/${msg._id || msg.id}/bookmark`); onBookmarkToggle?.(msg._id || msg.id); } catch {} toggleMsgMenu({ stopPropagation: () => {} }, null); },
                                isBookmarked
                            )}
                            {onRemind && menuItem('Remind Me', <Bell size={13} />, () => { onRemind(msg._id || msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            {onConvertToTask && menuItem('Convert to Task', <CheckSquare size={13} />, async () => { await onConvertToTask(msg._id || msg.id); toggleMsgMenu({ stopPropagation: () => {} }, null); })}
                            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
                            {menuItem('Delete for me',       <Trash2 size={13} />, () => { deleteMessage(msg._id || msg.id, 'me'); toggleMsgMenu({ stopPropagation: () => {} }, null); }, false, true)}
                            {isMe && menuItem('Delete for everyone', <Trash2 size={13} />, () => { deleteMessage(msg._id || msg.id, 'everyone'); toggleMsgMenu({ stopPropagation: () => {} }, null); }, false, true)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Optimize with React.memo — include all fields that affect rendered output
export default React.memo(DMMessageItem, (prevProps, nextProps) => {
    return (
        prevProps.msg.id === nextProps.msg.id &&
        prevProps.msg.text === nextProps.msg.text &&
        prevProps.msg.decryptedContent === nextProps.msg.decryptedContent &&
        prevProps.msg.editedAt === nextProps.msg.editedAt &&
        prevProps.msg.isPinned === nextProps.msg.isPinned &&
        prevProps.msg.pinnedByName === nextProps.msg.pinnedByName &&
        prevProps.msg.isDeleted === nextProps.msg.isDeleted &&
        prevProps.msg.isDeletedUniversally === nextProps.msg.isDeletedUniversally &&
        prevProps.msg.sending === nextProps.msg.sending &&
        prevProps.msg.failed === nextProps.msg.failed &&
        prevProps.selectMode === nextProps.selectMode &&
        prevProps.selectedIds === nextProps.selectedIds &&
        prevProps.openMsgMenuId === nextProps.openMsgMenuId &&
        JSON.stringify(prevProps.msg.repliedTo) === JSON.stringify(nextProps.msg.repliedTo) &&
        JSON.stringify(prevProps.msg.reactions) === JSON.stringify(nextProps.msg.reactions) &&
        prevProps.msg.dmSessionId === nextProps.msg.dmSessionId
    );
});

