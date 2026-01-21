import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Copy, Pin, Trash2, Smile, Share, Info } from "lucide-react";
import ReactionBadges from "./reactionBadges";
import ReactionPicker from "./reactionPicker";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import EncryptedMessage from "../../EncryptedMessage";



/* ---------------------------------------------------------
   DM MessageItem Component (Premium Feed Style)
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
    const isMe = msg.sender === "you" || msg.sender === "me";
    const isSystem = msg.sender === "system";
    const isSelected = selectedIds?.has(msg.id) || false;
    const [showToolbar, setShowToolbar] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionPickerRef = useRef(null);

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

    // System Message Rendering
    if (isSystem) {
        return (
            <div className="flex justify-center my-4 px-4">
                <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full text-center">
                    {msg.text}
                </div>
            </div>
        );
    }

    // Avatar Logic
    const avatarUrl = msg.senderAvatar || null;
    const initial = msg.senderName ? msg.senderName.charAt(0).toUpperCase() : "?";

    return (
        <div
            className={`group flex items - start gap - 1.5 px - 4 py - 1 hover: bg - gray - 50 / 50 dark: hover: bg - gray - 800 / 50 relative transition - colors ${isSelected ? "bg-blue-50/50 dark:bg-blue-900/20" : ""} w - full ${msg.isPinned ? "bg-blue-50/30 dark:bg-blue-900/10 border-l-4 border-blue-400 dark:border-blue-500" : "border-l-4 border-transparent"} `}
            onMouseEnter={() => setShowToolbar(true)}
            onMouseLeave={() => setShowToolbar(false)}
        >
            {/* Selection Checkbox */}
            {selectMode && (
                <div className="flex items-center justify-center pt-1 pr-2">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(msg.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                </div>
            )}

            {/* Avatar (Shrunk) */}
            <div className="flex-shrink-0 pt-0.5">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={msg.senderName} className="w-7 h-7 rounded object-cover" />
                ) : (
                    <div className={`w - 7 h - 7 rounded flex items - center justify - center text - [10px] font - medium text - white ${isMe ? "bg-blue-500/80" : "bg-gray-400/80 dark:bg-gray-600"} `}>
                        {initial}
                    </div>
                )}
            </div>

            {/* Content Column (Takes remaining width) */}
            <div className="flex flex-col items-start flex-1 min-w-0">

                {/* Message Row: Bubble ... Spacer ... Toolbar + Time */}
                <div className="flex items-start w-full relative">
                    {/* Message Bubble (Tightened) */}
                    <div className={`relative px - 3 py - 1.5 text - [14px] shadow - sm break-words whitespace - pre - wrap rounded - lg rounded - tl - none max - w - [85 %] ${isMe
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100"
                        } `}>

                        {/* Reply Preview - Shows which message this is replying to */}
                        {msg.repliedTo && (
                            <div className={`mb - 2 pb - 2 border - b flex items - start gap - 2 ${isMe ? "border-blue-400/30" : "border-gray-200 dark:border-gray-600"
                                } `}>
                                <div className={`w - 0.5 rounded - full flex - shrink - 0 self - stretch ${isMe ? "bg-blue-300" : "bg-gray-400 dark:bg-gray-500"
                                    } `}></div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text - [10px] font - semibold mb - 0.5 ${isMe ? "text-blue-100" : "text-gray-600 dark:text-gray-300"
                                        } `}>
                                        {msg.repliedTo.senderName}
                                    </div>
                                    <div className={`text - [11px] line - clamp - 2 leading - relaxed ${isMe ? "text-blue-50/90" : "text-gray-500 dark:text-gray-400"
                                        } `}>
                                        {msg.repliedTo.text}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Message Content - Encrypted or Plaintext */}
                        {msg.isEncrypted && msg.ciphertext && msg.messageIv ? (
                            <EncryptedMessage
                                ciphertext={msg.ciphertext}
                                messageIv={msg.messageIv}
                                conversationId={msg.dmSessionId || msg.conversationId}
                                conversationType="dm"
                                parentMessageId={msg.parentId || null}
                            />
                        ) : (
                            <ReactMarkdown
                                remarkPlugins={[remarkBreaks]}
                                components={{
                                    a: ({ node, children, ...props }) => <a {...props} className={`hover:underline ${isMe ? "text-white underline" : "text-blue-600 dark:text-blue-400"} `} target="_blank" rel="noopener noreferrer">{children}</a>,
                                    ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside ml-1" />,
                                    ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside ml-1" />,
                                    p: ({ node, ...props }) => <p {...props} className="mb-0" />, // Remove default margin
                                }}
                            >
                                {msg.text}
                            </ReactMarkdown>
                        )}
                    </div>

                    {/* Timestamp - Far right edge */}
                    <span className="absolute top-1 right-0 text-[10px] text-gray-400 dark:text-gray-500 select-none">
                        {formatTime(msg.ts)}
                    </span>

                    {/* Spacer to push Time/Toolbar to the right */}
                    <div className="flex-1"></div>

                    {/* Right Side: Toolbar */}
                    <div className="flex items-center gap-3 ml-2 mt-0 pl-2">

                        {/* Minimalist Toolbar - Aligned in the row, left of timestamp */}
                        <div className={`absolute top - 0.5 right - 20 bg - white dark: bg - gray - 800 border border - gray - 100 dark: border - gray - 700 shadow - sm rounded p - 0.5 flex items - center z - 10 transition - opacity ${showToolbar || openMsgMenuId === msg.id || showReactionPicker ? "opacity-100 visible" : "opacity-0 invisible"} `}>

                            {/* Reaction Picker Trigger */}
                            <div className="relative" ref={reactionPickerRef}>
                                <button
                                    onClick={() => setShowReactionPicker(!showReactionPicker)}
                                    className={`p - 1 rounded hover: bg - gray - 100 dark: hover: bg - gray - 700 ${showReactionPicker ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} `}
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

                            {/* Forward button (no threads in DMs) */}
                            <button onClick={() => forwardMessage && forwardMessage(msg.id)} className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Forward"><Share size={14} /></button>

                            {/* Menu Button */}
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleMsgMenu(e, msg.id);
                                    }}
                                    className={`p - 1 rounded ${openMsgMenuId === msg.id ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"} `}
                                    title="More"
                                >
                                    <MoreHorizontal size={14} />
                                </button>

                                {/* Dropdown Menu */}
                                {openMsgMenuId === msg.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-1 z-50 text-sm animate-fade-in origin-top-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (pinMessage) pinMessage(msg.id);
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300 transition-colors"
                                        >
                                            <Pin size={14} className="text-gray-400 dark:text-gray-500" /> {msg.isPinned ? "Unpin message" : "Pin message"}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyMessage(msg.id);
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300 transition-colors"
                                        >
                                            <Copy size={14} className="text-gray-400 dark:text-gray-500" /> Copy text
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (infoMessage) infoMessage(msg.id);
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300 transition-colors"
                                        >
                                            <Info size={14} className="text-gray-400 dark:text-gray-500" /> Message info
                                        </button>

                                        <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMessage(msg.id, 'me');
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-600 dark:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={14} /> Delete for me
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMessage(msg.id, 'everyone');
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-orange-600 dark:text-orange-400 transition-colors"
                                        >
                                            <Trash2 size={14} /> Delete for everyone
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Reactions Row */}
                {msg.reactions && msg.reactions.length > 0 && (
                    <div className="mt-1">
                        <ReactionBadges
                            reactions={msg.reactions}
                            currentUserId={currentUserId}
                            onReactionClick={(emoji) => addReaction(msg.id, emoji)}
                            channelMembers={null} // DMs don't have member list like channels
                        />
                    </div>
                )}

                {/* Status Indicators */}
                {(msg.sending || msg.failed) && (
                    <div className="flex justify-end w-full pr-1 mt-0.5">
                        {msg.sending && <span className="text-[10px] italic text-gray-400">Sending...</span>}
                        {msg.failed && <span className="text-[10px] text-red-500 font-bold">Failed</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

// Optimize with React.memo to prevent unnecessary re-renders
export default React.memo(DMMessageItem, (prevProps, nextProps) => {
    // Re-render only if these specific props change
    return (
        prevProps.msg.id === nextProps.msg.id &&
        prevProps.msg.text === nextProps.msg.text &&
        prevProps.msg.isPinned === nextProps.msg.isPinned &&
        prevProps.msg.sending === nextProps.msg.sending &&
        prevProps.msg.failed === nextProps.msg.failed &&
        prevProps.selectMode === nextProps.selectMode &&
        prevProps.selectedIds === nextProps.selectedIds &&
        prevProps.openMsgMenuId === nextProps.openMsgMenuId &&
        JSON.stringify(prevProps.msg.reactions) === JSON.stringify(nextProps.msg.reactions)
    );
});
