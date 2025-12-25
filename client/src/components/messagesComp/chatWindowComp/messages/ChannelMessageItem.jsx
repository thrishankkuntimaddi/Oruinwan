import React, { useState, useRef, useEffect } from "react";
import { Smile, MessageSquare, Share, MoreHorizontal, Pin, Copy, Trash2, Info } from "lucide-react";
import ReactionBadges from "./reactionBadges";
import ReactionPicker from "./reactionPicker";

/* ---------------------------------------------------------
   CHANNEL MessageItem Component (Slack Style)
--------------------------------------------------------- */
export default function ChannelMessageItem({
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
    const isSelected = selectedIds.has(msg.id);
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

    // ✨ System Message Rendering (e.g., "muza exited from #maker on Dec 24, 2025")
    // Must be AFTER all hooks to avoid React Hooks rules violation
    if (msg.type === 'system' || msg.backend?.type === 'system') {
        return (
            <div className="flex justify-center my-3">
                <div className="bg-gray-100/80 px-4 py-1.5 rounded-full text-xs text-gray-600 font-medium shadow-sm">
                    {msg.text}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`group flex items-start gap-3 px-4 py-0.5 hover:bg-gray-50/50 relative ${isSelected ? "bg-blue-50/30" : ""} ${msg.isPinned ? "bg-yellow-50/50 border-l-2 border-yellow-400" : "border-l-2 border-transparent"}`}
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

            {/* Deleted Message State */}
            {msg.deleted && (
                <div
                    className="group flex items-start gap-2 px-4 py-0.5 hover:bg-gray-50/50 relative"
                    onMouseEnter={() => setShowToolbar(true)} // Re-using showToolbar for this context
                    onMouseLeave={() => setShowToolbar(false)}
                >
                    <div className="flex-shrink-0 pt-1">
                        <div className="w-7 h-7 rounded bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">
                            <Trash2 size={12} />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-gray-400 text-xs italic py-1">
                            Message deleted by {msg.deletedByName || "Unknown"}
                        </div>
                    </div>
                </div>
            )}

            {/* Avatar (Shrunk) */}
            <div className="flex-shrink-0 pt-0.5">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={msg.senderName} className="w-7 h-7 rounded object-cover" />
                ) : (
                    <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-medium text-white ${isMe ? "bg-blue-500/80" : "bg-gray-400/80"}`}>
                        {initial}
                    </div>
                )}
            </div>

            {/* Content (Tightened) */}
            <div className="flex-1 min-w-0 group-hover:pr-24 relative">
                {/* Header: Name + Pin */}
                <div className="flex items-center gap-2 mb-0">
                    <span className="font-semibold text-gray-900 text-sm leading-tight">{msg.senderName || "Unknown"}</span>
                    {msg.isPinned && <Pin size={10} className="text-gray-400 rotate-45" />}
                </div>

                {/* Timestamp - Positioned at the far right edge */}
                <span className="absolute top-1 right-4 text-[10px] text-gray-400 select-none">
                    {formatTime(msg.ts)}
                </span>

                {/* Message Text (More compact line height) */}
                <div className="text-gray-800 text-[14px] leading-snug whitespace-pre-wrap break-words">
                    {msg.text}
                </div>

                {/* Sending/Failed States */}
                {msg.sending && <div className="text-xs text-gray-400 italic mt-1">Sending...</div>}
                {msg.failed && <div className="text-xs text-red-500 font-medium mt-1">Failed to send</div>}

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                    <div className="mt-1">
                        <ReactionBadges reactions={msg.reactions} />
                    </div>
                )}

                {/* Thread Reply Link */}
                {threadCounts && threadCounts[msg.id] > 0 && onOpenThread && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenThread(msg.id); }}
                        className="mt-2 flex items-center gap-2 group/thread cursor-pointer"
                    >
                        <div className="flex -space-x-1">
                            <div className="w-5 h-5 rounded bg-gray-200 border border-white"></div>
                            <div className="w-5 h-5 rounded bg-gray-300 border border-white"></div>
                        </div>
                        <span className="text-xs font-medium text-blue-600 group-hover/thread:underline">
                            {threadCounts[msg.id]} {threadCounts[msg.id] === 1 ? "reply" : "replies"}
                        </span>
                        <span className="text-xs text-gray-400 group-hover/thread:text-gray-600">
                            Last reply today at {formatTime(msg.ts)}
                        </span>
                    </div>
                )}


            </div>

            {/* Minimalist Hover Toolbar - Vertically aligned in the row, left of timestamp */}
            <div className={`absolute top-0.5 right-24 bg-white border border-gray-100 shadow-sm rounded p-0.5 flex items-center z-10 ${showToolbar || openMsgMenuId === msg.id || showReactionPicker ? "opacity-100" : "opacity-0 invisible"}`}>

                {/* Reaction Picker Trigger */}
                <div className="relative" ref={reactionPickerRef}>
                    <button
                        onClick={() => setShowReactionPicker(!showReactionPicker)}
                        className={`p-1 rounded hover:bg-gray-100 ${showReactionPicker ? "text-blue-600" : "text-gray-400"}`}
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

                <button onClick={() => onOpenThread && onOpenThread(msg.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Thread"><MessageSquare size={14} /></button>
                <button onClick={() => forwardMessage(msg.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Forward"><Share size={14} /></button>
                <button onClick={() => infoMessage(msg.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Message Info"><Info size={14} /></button>

                <div className="relative">
                    <button onClick={(e) => toggleMsgMenu(e, msg.id)} className={`p-1 rounded ${openMsgMenuId === msg.id ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-100"}`} title="More"><MoreHorizontal size={14} /></button>
                    {openMsgMenuId === msg.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">
                            <button onClick={() => { copyMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"><Copy size={14} /> Copy text</button>
                            <button onClick={() => { pinMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"><Pin size={14} /> {msg.isPinned ? "Unpin message" : "Pin message"}</button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button onClick={() => { deleteMessage(msg.id); toggleMsgMenu({ stopPropagation: () => { } }, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"><Trash2 size={14} /> Delete message</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
