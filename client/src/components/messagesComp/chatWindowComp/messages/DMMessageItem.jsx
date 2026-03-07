import React, { useState, useRef, useEffect } from "react";
import api from '../../../../services/api';
import { Smile, MessageSquare, Share, MoreHorizontal, Pin, Copy, Trash2, Info, Pencil, Check, X } from "lucide-react";
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
}) {
    // Check if message is from current user
    const senderId = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender;
    const isMe = senderId === currentUserId || msg.sender === "you" || msg.sender === "me";
    const isSelected = selectedIds?.has(msg.id) || false;
    const [showToolbar, setShowToolbar] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionPickerRef = useRef(null);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(msg.text || '');

    // Avatar Logic
    const avatarUrl = msg.senderAvatar || null;
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

    // Save edit — calls PATCH API; socket broadcasts message:edited to update all clients
    const handleSaveEdit = async () => {
        const trimmed = editText.trim();
        if (trimmed === (msg.text || '').trim()) {
            setIsEditing(false);
            return;
        }
        if (!trimmed) return; // Don't save empty message
        try {
            await api.patch(`/api/v2/messages/${msg._id || msg.id}`, { text: trimmed });
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

    // System Message Rendering — reads from systemEvent + systemData
    if (msg.type === 'system' || msg.backend?.type === 'system') {
        const sd = msg.systemData || msg.backend?.systemData || {};
        const ev = msg.systemEvent || msg.backend?.systemEvent || '';
        const isMe = (id) => String(id) === String(currentUserId);
        const name = (id, fallback) => isMe(id) ? 'You' : (fallback || 'Someone');
        const textMap = {
            member_joined: () => `${name(sd.userId, sd.userName)} joined #${sd.channelName || 'this channel'}`,
            member_left: () => `${name(sd.userId, sd.userName)} left #${sd.channelName || 'this channel'}`,
            member_invited: () => `${name(sd.inviterId, sd.inviterName)} invited ${isMe(sd.invitedUserId) ? 'you' : (sd.invitedUserName || 'someone')} to #${sd.channelName || 'this channel'}`,
            member_removed: () => `${name(sd.removedById, sd.removedByName)} removed ${isMe(sd.removedUserId) ? 'you' : (sd.removedUserName || 'someone')}`,
            channel_created: () => `${name(sd.userId, sd.userName)} created this channel`,
            channel_renamed: () => `${name(sd.userId, sd.userName)} renamed the channel from #${sd.oldName} to #${sd.newName}`,
            admin_assigned: () => `${name(sd.assignerId, sd.assignerName)} made ${isMe(sd.assignedUserId) ? 'you' : (sd.assignedUserName || 'someone')} an admin`,
            admin_demoted: () => `${name(sd.demoterId, sd.demoterName)} removed ${isMe(sd.demotedUserId) ? 'your' : `${sd.demotedUserName || 'someone'}'s`} admin role`,
            messages_cleared: () => `${name(sd.userId, sd.userName)} cleared the message history`,
        };
        const displayText = textMap[ev]?.() || msg.payload?.text || msg.text || 'System event';
        return (
            <div className="flex justify-center my-3">
                <div className="bg-gray-100/80 dark:bg-gray-800/80 px-4 py-1.5 rounded-full text-xs text-gray-600 dark:text-gray-300 font-medium shadow-sm">
                    {displayText}
                </div>
            </div>
        );
    }

    // Deleted Message Rendering
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
                <button
                    onClick={() => deleteMessage(msg._id || msg.id, 'me')}
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
            {/* Selection Checkbox */}
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

            {/* Avatar - with blue ring for current user */}
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

                {/* Reply Preview */}
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
                    <div className="text-gray-800 dark:text-gray-200 text-[14px] leading-relaxed whitespace-pre-wrap break-words max-w-[70%] message-content">
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
                                }}
                            >
                                {msg.text}
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
                            <span className="text-gray-400 italic">No message content</span>
                        )}
                    </div>
                )}

                {/* (edited) badge */}
                {msg.editedAt && !msg.isDeleted && (
                    <span className="text-xs text-gray-400 italic"> (edited)</span>
                )}

                {/* Phase 7.5 — Link preview card */}
                {!msg.isDeleted && msg.linkPreview?.url && (
                    <LinkPreviewMessage preview={msg.linkPreview} />
                )}

                {/* Sending/Failed States */}
                {msg.sending && <div className="text-xs text-gray-400 italic mt-1">Sending...</div>}
                {msg.failed && <div className="text-xs text-red-500 font-medium mt-1">Failed to send</div>}

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                        {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                                acc[r.emoji] = acc[r.emoji] || [];
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
            </div>

            {/* Hover Toolbar */}
            <div className={`absolute top-0.5 right-24 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded p-0.5 flex items-center z-10 ${showToolbar || openMsgMenuId === msg.id || showReactionPicker ? "opacity-100" : "opacity-0 invisible"}`}>
                {/* Reaction Picker */}
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
                                    toggleReaction(emoji);
                                    setShowReactionPicker(false);
                                }}
                            />
                        </div>
                    )}
                </div>

                <button onClick={() => forwardMessage && forwardMessage(msg.id)} className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Forward"><Share size={14} /></button>

                <div className="relative">
                    <button onClick={(e) => toggleMsgMenu(e, msg.id)} className={`p-1 rounded ${openMsgMenuId === msg.id ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="More"><MoreHorizontal size={14} /></button>
                    {openMsgMenuId === msg.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">
                            <button onClick={() => { copyMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Copy size={14} /> Copy text</button>
                            <button onClick={() => { replyToMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><MessageSquare size={14} /> Reply</button>
                            <button onClick={async () => { try { await api.post(`/api/v2/messages/${msg._id || msg.id}/pin`, { pin: !msg.isPinned }); } catch (err) { console.error('[DMMessageItem] Pin toggle failed:', err); } toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Pin size={14} /> {msg.isPinned ? "Unpin message" : "Pin message"}</button>
                            <button onClick={() => { infoMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Info size={14} /> Message info</button>

                            {/* Edit — own messages only */}
                            {isMe && !msg.isDeleted && (
                                <button
                                    onClick={() => {
                                        setIsEditing(true);
                                        setEditText(msg.text || '');
                                        toggleMsgMenu({ stopPropagation: () => { } }, null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                                >
                                    <Pencil size={14} /> Edit message
                                </button>
                            )}

                            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                            <button onClick={() => { deleteMessage(msg._id || msg.id, 'me'); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"><Trash2 size={14} /> Delete for me</button>
                            {isMe && (
                                <button onClick={() => { deleteMessage(msg._id || msg.id, 'everyone'); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-orange-600 dark:text-orange-400"><Trash2 size={14} /> Delete for everyone</button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Optimize with React.memo — include editedAt so edited messages re-render correctly
export default React.memo(DMMessageItem, (prevProps, nextProps) => {
    return (
        prevProps.msg.id === nextProps.msg.id &&
        prevProps.msg.text === nextProps.msg.text &&
        prevProps.msg.editedAt === nextProps.msg.editedAt &&
        prevProps.msg.isPinned === nextProps.msg.isPinned &&
        prevProps.msg.isDeleted === nextProps.msg.isDeleted &&
        prevProps.msg.isDeletedUniversally === nextProps.msg.isDeletedUniversally &&
        prevProps.msg.sending === nextProps.msg.sending &&
        prevProps.msg.failed === nextProps.msg.failed &&
        prevProps.selectMode === nextProps.selectMode &&
        prevProps.selectedIds === nextProps.selectedIds &&
        prevProps.openMsgMenuId === nextProps.openMsgMenuId &&
        JSON.stringify(prevProps.msg.reactions) === JSON.stringify(nextProps.msg.reactions)
    );
});
