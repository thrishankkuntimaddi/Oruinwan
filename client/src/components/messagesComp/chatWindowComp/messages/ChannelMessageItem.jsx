import React, { useState, useRef, useEffect } from "react";
import { Smile, MessageSquare, Share, MoreHorizontal, Pin, Copy, Trash2, Info } from "lucide-react";
import ReactionBadges from "./reactionBadges";
import ReactionPicker from "./reactionPicker";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import EncryptedMessage from "../../EncryptedMessage";

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

    // ✅ Fix: Properly check if message is from current user by comparing IDs
    const senderId = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender;
    const isMe = senderId === currentUserId || msg.sender === "you" || msg.sender === "me";
    const isSelected = selectedIds?.has(msg.id) || false;
    const [showToolbar, setShowToolbar] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionPickerRef = useRef(null);

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

    // Must be AFTER all hooks to avoid React Hooks rules violation
    if (msg.type === 'system' || msg.backend?.type === 'system') {
        return (
            <div className="flex justify-center my-3">
                <div className="bg-gray-100/80 dark:bg-gray-800/80 px-4 py-1.5 rounded-full text-xs text-gray-600 dark:text-gray-300 font-medium shadow-sm">
                    {msg.payload?.text}
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
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={msg.senderName}
                        className={`w-7 h-7 rounded object-cover ${isMe ? "ring-2 ring-blue-500" : ""}`}
                    />
                ) : (
                    <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-medium text-white ${isMe ? "bg-blue-500/80" : "bg-gray-400/80 dark:bg-gray-600"}`}>
                        {initial}
                    </div>
                )}
            </div>

            {/* Content (Tightened) */}
            <div className="flex-1 min-w-0 group-hover:pr-24 relative">
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

                {/* Message Text (More compact line height) */}
                <div className="text-gray-800 dark:text-gray-200 text-[14px] leading-snug whitespace-pre-wrap break-words message-content">
                    {/* Display decrypted text if available, otherwise show encrypted fallback */}
                    {msg.text ? (
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
                            conversationId={msg.channelId || msg.conversationId}
                            conversationType="channel"
                            parentMessageId={msg.parentId || null}
                        />
                    ) : (
                        <span className="text-gray-400 italic">No message content</span>
                    )}

                </div>

                {/* Sending/Failed States */}
                {msg.sending && <div className="text-xs text-gray-400 italic mt-1">Sending...</div>}
                {msg.failed && <div className="text-xs text-red-500 font-medium mt-1">Failed to send</div>}

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                    <div className="mt-1">
                        <div className="mt-1">
                            <ReactionBadges
                                reactions={msg.reactions}
                                currentUserId={currentUserId}
                                onReactionClick={(emoji) => addReaction(msg.id, emoji)}
                                channelMembers={channelMembers}
                            />
                        </div>
                    </div>
                )}

                {/* Thread Reply Link */}
                {count > 0 && onOpenThread && (
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
                                        className="w-5 h-5 rounded hover:z-10 relative bg-white border border-white object-cover"
                                    />
                                ))
                            ) : (
                                /* Fallback if no avatars (e.g. backend not updated yet) */
                                <div className="flex -space-x-1">
                                    <div className="w-5 h-5 rounded bg-gray-200 border border-white"></div>
                                    <div className="w-5 h-5 rounded bg-gray-300 border border-white"></div>
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

            {/* Minimalist Hover Toolbar - Vertically aligned in the row, left of timestamp */}
            <div className={`absolute top-0.5 right-24 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded p-0.5 flex items-center z-10 ${showToolbar || openMsgMenuId === msg.id || showReactionPicker ? "opacity-100" : "opacity-0 invisible"}`}>

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
                                    addReaction(msg.id, emoji);
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
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">
                            <button onClick={() => { copyMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Copy size={14} /> Copy text</button>
                            <button onClick={() => { replyToMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><MessageSquare size={14} /> Reply</button>
                            <button onClick={() => { pinMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Pin size={14} /> {msg.isPinned ? "Unpin message" : "Pin message"}</button>
                            <button onClick={() => { infoMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Info size={14} /> Message info</button>
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                            {/* Show both delete options for own messages OR if admin */}
                            {(isMe || isAdmin) && (
                                <>
                                    <button onClick={() => { deleteMessage(msg.id, 'me'); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"><Trash2 size={14} /> Delete for me</button>
                                    <button onClick={() => { deleteMessage(msg.id, 'everyone'); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-orange-600 dark:text-orange-400"><Trash2 size={14} /> Delete for everyone</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Optimize with React.memo to prevent unnecessary re-renders
// ⚠️ TEMPORARILY DISABLED FOR DEBUGGING - Testing if memo blocks real-time updates
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
