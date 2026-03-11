import React, { useState, useRef, useEffect } from "react";
import api from '../../../../services/api';
import {
    Smile, MessageSquare, Share, MoreHorizontal, Pin, Copy, Trash2, Info, Pencil, Check, X,
    Hash, UserCheck, LogOut, UserPlus, UserMinus, Shield, ShieldOff,
    PenLine, FileText, Lock, PinIcon, Eraser, History
} from "lucide-react";
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

    // Step 3 — Local edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(msg.decryptedContent || msg.text || '');

    // Avatar Logic — always use a colorful avatar; fall back to DiceBear when no photo set
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
            channel_created: { Icon: Hash, color: 'bg-indigo-500', text: () => `${name(sd.userId, sd.userName)} created this channel` },
            member_joined: { Icon: UserCheck, color: 'bg-green-500', text: () => `${name(sd.userId, sd.userName)} joined #${sd.channelName || 'this channel'}` },
            member_left: { Icon: LogOut, color: 'bg-orange-400', text: () => `${name(sd.userId, sd.userName)} left #${sd.channelName || 'this channel'}` },
            member_invited: { Icon: UserPlus, color: 'bg-blue-500', text: () => `${name(sd.inviterId, sd.inviterName)} invited ${isMe(sd.invitedUserId) ? 'you' : (sd.invitedUserName || 'someone')} to #${sd.channelName || 'this channel'}` },
            member_removed: { Icon: UserMinus, color: 'bg-red-500', text: () => `${name(sd.removedById || sd.removedByUserId, sd.removedByName)} removed ${isMe(sd.removedUserId) ? 'you' : (sd.removedUserName || 'someone')}` },
            // admin events: backend stores a human-readable sentence in msg.text
            admin_assigned: { Icon: Shield, color: 'bg-purple-500', text: () => msg.text || `${name(sd.assignerId, sd.assignerName)} made ${isMe(sd.assignedUserId) ? 'you' : (sd.assignedUserName || 'someone')} an admin` },
            admin_demoted: { Icon: ShieldOff, color: 'bg-gray-500', text: () => msg.text || `${name(sd.demoterId, sd.demoterName)} removed ${isMe(sd.demotedUserId) ? 'your' : `${sd.demotedUserName || "someone"}'s`} admin role` },
            channel_renamed: { Icon: PenLine, color: 'bg-sky-500', text: () => `${name(sd.userId, sd.userName)} renamed the channel from #${sd.oldName} to #${sd.newName}` },
            channel_desc_changed: { Icon: FileText, color: 'bg-teal-500', text: () => `${name(sd.userId, sd.userName)} updated the channel description` },
            channel_privacy_changed: { Icon: Lock, color: 'bg-yellow-500', text: () => `${name(sd.userId, sd.userName)} made this channel ${sd.newPrivacy || 'private'}` },
            message_pinned: { Icon: PinIcon, color: 'bg-pink-500', text: () => `${name(sd.userId, sd.userName)} pinned a message${sd.messageSnippet ? `: "${sd.messageSnippet}"` : ''}` },
            message_unpinned: { Icon: PinIcon, color: 'bg-pink-400', text: () => `${name(sd.userId, sd.userName)} unpinned a message` },
            messages_cleared: { Icon: Eraser, color: 'bg-rose-500', text: () => `${name(sd.userId, sd.userName)} cleared the message history` },
        };

        const config = eventConfig[ev];
        const IconComp = config?.Icon || Info;
        const dotColor = config?.color || 'bg-gray-400';
        const displayText = config?.text?.() || msg.text || msg.payload?.text || 'System event';

        return (
            <div className="flex justify-center my-3 px-4">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 px-3 py-1.5 rounded-full text-xs text-gray-600 dark:text-gray-300 font-medium shadow-sm max-w-xl">
                    <span className={`flex-shrink-0 w-4 h-4 rounded-full ${dotColor} flex items-center justify-center`}>
                        <IconComp size={9} color="white" strokeWidth={2.5} />
                    </span>
                    <span className="truncate">{displayText}</span>
                </div>
            </div>
        );
    }

    // ✨ Deleted Message Rendering
    if (msg.isDeletedUniversally) {
        return (
            <div className="group flex items-start gap-2 px-4 py-2 opacity-60 hover:opacity-100 relative">
                <div className="flex-shrink-0 pt-1">
                    <div className="w-7 h-7 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <Trash2 size={12} className="text-gray-500 dark:text-gray-400" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-gray-400 text-xs italic py-1">
                        Message deleted by {
                            String(msg.deletedBy) === String(currentUserId)
                                ? "You"
                                : (msg.deletedByName || "Unknown")
                        }
                    </div>
                </div>
                {/* Delete icon to remove from view */}
                <button
                    onClick={() => deleteMessage(msg.id, 'me')}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                    title="Remove from view"
                >
                    <Trash2 size={12} className="text-gray-400" />
                </button>
            </div>
        );
    }

    return (
        <div
            className={`group flex items-start gap-3 px-4 py-0.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 relative ${isSelected ? "bg-blue-50/30 dark:bg-blue-900/20" : ""} ${msg.isPinned ? "bg-blue-50/30 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-500" : "border-l-2 border-transparent"}`}
            onMouseEnter={() => setShowToolbar(true)}
            onMouseLeave={() => setShowToolbar(false)}
        >
            {/* Selection Checkbox (Slim) */}
            {selectMode && (
                <div className="flex items-center justify-center pt-1 pr-1">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(msg.id)}
                        className="w-3.5 h-3.5 rounded-sm border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            )}

            {/* Avatar (Shrunk) - ✅ Added blue ring for user's messages */}
            <div className="flex-shrink-0 pt-0.5">
                <Avatar
                    src={avatarUrl}
                    fallback={initial}
                    alt={msg.senderName}
                    size="sm"
                    className={isMe ? "ring-2 ring-blue-500" : ""}
                />
            </div>

            {/* Content — always has right padding so toolbar never overlaps text */}
            <div className="flex-1 min-w-0 pr-24 relative">
                {/* Header: Name + Pin Info */}
                <div className="flex flex-col gap-0.5 mb-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">{msg.senderName || "Unknown"}</span>
                        {msg.isPinned && (
                            <span className="relative inline-flex group/pin">
                                <Pin size={10} className="text-blue-500 rotate-45" />
                                {msg.pinnedByName && (
                                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/pin:opacity-100 group-hover/pin:visible transition-opacity z-50">
                                        Pinned by {msg.pinnedByName}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    {msg.isPinned && msg.pinnedByName && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-600">
                            <Pin size={8} className="rotate-45" />
                            <span>Pinned by {msg.pinnedByName}</span>
                        </div>
                    )}
                </div>

                {/* Timestamp - Positioned at the far right edge */}
                <span className="absolute top-1 right-4 text-[10px] text-gray-400 dark:text-gray-500 select-none">
                    {formatTime(msg.ts)}
                </span>

                {/* Reply Preview - Shows which message this is replying to */}
                {msg.repliedTo && (
                    <div className="flex items-start gap-2 mb-2 px-1">
                        <div className="w-1 bg-blue-500 rounded-full flex-shrink-0 self-stretch"></div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <MessageSquare size={11} className="text-blue-500 flex-shrink-0" />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    {msg.repliedTo.senderName}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                {msg.repliedTo.payload?.text || "🔒 Encrypted message"}
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
                    <div className="text-gray-800 dark:text-gray-200 text-[14px] leading-relaxed break-all whitespace-pre-wrap max-w-[60%] message-content" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {msg.isDeleted ? (
                            <span className="text-gray-400 italic">Message deleted</span>
                        ) : isEditing ? (
                            <div className="flex flex-col gap-2 w-full max-w-[70%]">
                                <textarea
                                    className="w-full bg-gray-50 dark:bg-gray-700/60 border border-blue-400 dark:border-blue-500 rounded-md px-3 py-2 text-[14px] text-gray-800 dark:text-gray-200 outline-none resize-none focus:ring-2 focus:ring-blue-400/50 min-h-[60px]"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    autoFocus
                                    rows={Math.min(6, (editText.match(/\n/g) || []).length + 2)}
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleSaveEdit}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                                    >
                                        <Check size={12} /> Save
                                    </button>
                                    <button
                                        onClick={handleCancelEdit}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-md transition-colors"
                                    >
                                        <X size={12} /> Cancel
                                    </button>
                                    <span className="text-[10px] text-gray-400">Enter to save · Esc to cancel</span>
                                </div>
                            </div>
                        ) : msg.text ? (
                            <ReactMarkdown
                                remarkPlugins={[remarkBreaks]}
                                components={{
                                    a: ({ node, children, ...props }) => (
                                        <a
                                            {...props}
                                            className="text-blue-600 dark:text-blue-400 hover:underline"
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
                                conversationId={msg.channelId || msg.conversationId}
                                conversationType="channel"
                                parentMessageId={msg.parentId || null}
                            />
                        ) : (
                            <span className="text-gray-400 italic">No message content</span>
                        )}

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
                    <div className="flex gap-2 mt-1 flex-wrap">
                        {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                                acc[r.emoji] = acc[r.emoji] || [];
                                // Normalize userId to string (can be ObjectId or populated object)
                                const uid = (r.userId?._id || r.userId)?.toString();
                                acc[r.emoji].push(uid);
                                return acc;
                            }, {})
                        ).map(([emoji, users]) => (
                            <button
                                key={emoji}
                                onClick={() => toggleReaction(emoji)}
                                className={`px-2 py-0.5 rounded text-sm transition-colors ${users.includes(currentUserId?.toString())
                                    ? 'bg-blue-600/30 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300 border border-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {emoji} {users.length}
                            </button>
                        ))}
                    </div>
                )}

                {/* Sending/Failed States */}
                {msg.sending && <div className="text-xs text-gray-400 italic mt-1">Sending...</div>}
                {msg.failed && <div className="text-xs text-red-500 font-medium mt-1">Failed to send</div>}



                {/* Thread Reply Link — hide for deleted messages */}
                {count > 0 && onOpenThread && !msg.isDeleted && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenThread(msg.id); }}
                        className="mt-2 flex items-center gap-2 group/thread cursor-pointer"
                    >
                        <div className="flex -space-x-2"> {/* Increased overlap for better look */}
                            {msg.replyAvatars && msg.replyAvatars.length > 0 ? (
                                msg.replyAvatars.map((url, i) => (
                                    <img
                                        key={i}
                                        src={url}
                                        alt="Replier"
                                        className="w-5 h-5 rounded hover:z-10 relative bg-white dark:bg-gray-800 border border-white dark:border-gray-900 object-cover"
                                    />
                                ))
                            ) : (
                                /* Fallback if no avatars (e.g. backend not updated yet) */
                                <div className="flex -space-x-1">
                                    <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-600 border border-white dark:border-gray-900"></div>
                                    <div className="w-5 h-5 rounded bg-gray-300 dark:bg-gray-500 border border-white dark:border-gray-900"></div>
                                </div>
                            )}
                        </div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 group-hover/thread:underline">
                            {count} {count === 1 ? "reply" : "replies"}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 group-hover/thread:text-gray-600 dark:group-hover/thread:text-gray-300">
                            Last reply today at {formatTime(msg.lastReplyAt || msg.ts)}
                        </span>
                    </div>
                )}


            </div>

            {/* Minimalist Hover Toolbar — hidden entirely for deleted messages */}
            <div className={`absolute top-0.5 right-24 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded p-0.5 flex items-center z-10 ${!msg.isDeleted && (showToolbar || openMsgMenuId === msg.id || showReactionPicker) ? "opacity-100" : "opacity-0 invisible"}`}>

                {/* Reaction Picker Trigger */}
                <div className="relative" ref={reactionPickerRef}>
                    <button
                        onClick={() => setShowReactionPicker(!showReactionPicker)}
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${showReactionPicker ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}
                        title="React"
                    >
                        <Smile size={14} />
                    </button>
                    {showReactionPicker && (
                        <div className="absolute right-0 top-full mt-1 z-50">
                            <ReactionPicker
                                onSelect={(emoji) => {
                                    toggleReaction(emoji); // uses msg._id from closure, enforces one-per-user
                                    setShowReactionPicker(false);
                                }}
                            />
                        </div>
                    )}
                </div>

                <button onClick={() => onOpenThread && onOpenThread(msg.id)} className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Thread"><MessageSquare size={14} /></button>
                <button onClick={() => forwardMessage(msg.id)} className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Forward"><Share size={14} /></button>

                <div className="relative">
                    <button onClick={(e) => toggleMsgMenu(e, msg.id)} className={`p-1 rounded ${openMsgMenuId === msg.id ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="More"><MoreHorizontal size={14} /></button>
                    {openMsgMenuId === msg.id && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">

                            {/* Copy text */}
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(msg.text || msg.payload?.text || '');
                                    toggleMsgMenu({ stopPropagation: () => { } }, null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                                <Copy size={14} /> Copy text
                            </button>

                            {/* Reply */}
                            <button
                                onClick={() => {
                                    replyToMessage && replyToMessage(msg.id);
                                    toggleMsgMenu({ stopPropagation: () => { } }, null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                                <MessageSquare size={14} /> Reply
                            </button>

                            {/* Pin / Unpin */}
                            <button
                                onClick={async () => {
                                    try {
                                        await api.post(`/api/v2/messages/${msg._id || msg.id}/pin`, { pin: !msg.isPinned });
                                    } catch (err) { console.error('[ChannelMessageItem] Pin toggle failed:', err); }
                                    toggleMsgMenu({ stopPropagation: () => { } }, null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                                <Pin size={14} /> {msg.isPinned ? 'Unpin message' : 'Pin message'}
                            </button>

                            {/* Message info */}
                            <button
                                onClick={() => {
                                    infoMessage && infoMessage(msg.id);
                                    toggleMsgMenu({ stopPropagation: () => { } }, null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                                <Info size={14} /> Message info
                            </button>

                            {/* Edit — own messages only */}
                            {isMe && !msg.isDeleted && (
                                <button
                                    onClick={() => {
                                        setIsEditing(true);
                                        setEditText(msg.decryptedContent || msg.text || '');
                                        toggleMsgMenu({ stopPropagation: () => { } }, null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                                >
                                    <Pencil size={14} /> Edit message
                                </button>
                            )}

                            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

                            {/* Delete options */}
                            {(isMe || isAdmin) && (
                                <>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await deleteMessage(msg._id || msg.id, 'me');
                                            } catch (err) { console.error('Delete (me) failed:', err); }
                                            toggleMsgMenu({ stopPropagation: () => { } }, null);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"
                                    >
                                        <Trash2 size={14} /> Delete for me
                                    </button>
                                    {isMe && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await deleteMessage(msg._id || msg.id, 'everyone');
                                                } catch (err) { console.error('Delete (everyone) failed:', err); }
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-orange-600 dark:text-orange-400"
                                        >
                                            <Trash2 size={14} /> Delete for everyone
                                        </button>
                                    )}
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
        <span className="relative inline-flex items-center" ref={ref}>
            <button
                onClick={() => hasHistory && setOpen(v => !v)}
                className={`text-xs italic ml-1 flex items-center gap-1 transition-colors ${
                    hasHistory
                        ? 'text-indigo-400 hover:text-indigo-500 cursor-pointer'
                        : 'text-gray-400 cursor-default'
                }`}
                title={hasHistory ? 'View edit history' : `Edited ${formatTs(editedAt)}`}
            >
                <History size={10} />
                (edited)
            </button>

            {open && hasHistory && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <History size={12} /> Edit History
                        </span>
                        <button
                            onClick={() => setOpen(false)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={12} />
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {[...editHistory].reverse().map((entry, i) => (
                            <div key={i} className="px-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                                    {i === 0 ? 'Most recent previous version' : `Version ${editHistory.length - i}`}
                                    {' · '}{formatTs(entry.editedAt)}
                                </div>
                                <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap break-words">
                                    {entry.isEncrypted && entry.ciphertext ? (
                                        <EncryptedMessage
                                            ciphertext={entry.ciphertext}
                                            messageIv={entry.messageIv}
                                            conversationId={conversationId}
                                            conversationType={conversationType || 'channel'}
                                            parentMessageId={null}
                                        />
                                    ) : entry.text ? (
                                        entry.text
                                    ) : (
                                        <span className="italic text-gray-400">No content</span>
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
