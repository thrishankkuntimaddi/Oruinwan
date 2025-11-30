import React, { useState, useRef, useEffect } from "react";
import { Smile, MessageSquare, Share, MoreHorizontal, Pin, Copy, Trash2 } from "lucide-react";
import ReactionBadges from "./reactionBadges";
import ReactionPicker from "./reactionPicker";

/* ---------------------------------------------------------
   🔵 Slack-style Read Receipts (✔✔ icons)
--------------------------------------------------------- */
function ReadReceipts({ msg, currentUserId }) {
    if (!msg.backend) return null;

    const readBy = Array.isArray(msg.backend.readBy)
        ? msg.backend.readBy.map(String)
        : [];

    // remove self
    const others = readBy.filter((id) => id !== String(currentUserId));

    if (others.length === 0) return null;

    const display = others.slice(0, 3);
    const overflow = others.length - display.length;

    return (
        <div className="flex items-center gap-1 mt-1">
            {display.map((uid) => (
                <div
                    key={uid}
                    className="h-4 w-4 rounded-full bg-gray-300 text-[10px] flex items-center justify-center border border-white"
                    title="Read by user"
                >
                    ✔
                </div>
            ))}

            {overflow > 0 && (
                <div className="h-4 w-4 rounded-full bg-gray-200 text-[10px] px-1 flex items-center justify-center border border-white">
                    +{overflow}
                </div>
            )}
        </div>
    );
}

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
    reactions,
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

    return (
        <div
            className={`group flex items-start gap-2 px-5 py-1.5 hover:bg-gray-50 relative transition-colors ${isSelected ? "bg-blue-50/50" : ""} ${msg.isPinned ? "bg-yellow-50 border-l-4 border-yellow-400" : "border-l-4 border-transparent"}`}
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

            {/* Avatar */}
            <div className="flex-shrink-0 pt-0.5">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={msg.senderName} className="w-8 h-8 rounded-md object-cover" />
                ) : (
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white ${isMe ? "bg-blue-500" : "bg-gray-400"}`}>
                        {initial}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 group-hover:pr-20">
                {/* Header: Name + Time */}
                <div className="flex items-baseline gap-2">
                    <span className="font-bold text-gray-900 text-sm">{msg.senderName || "Unknown"}</span>
                    <span className="text-[10px] text-gray-500 hover:underline cursor-pointer">{formatTime(msg.ts)}</span>
                    {msg.isPinned && <Pin size={12} className="text-gray-400 rotate-45" />}
                </div>

                {/* Message Text */}
                <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                </div>

                {/* Sending/Failed States */}
                {msg.sending && <div className="text-xs text-gray-400 italic mt-1">Sending...</div>}
                {msg.failed && <div className="text-xs text-red-500 font-medium mt-1">Failed to send</div>}

                {/* Reactions */}
                {reactions[msg.id] && (
                    <div className="mt-1">
                        <ReactionBadges reactions={reactions[msg.id]} />
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

                {/* Read Receipts (My messages only) */}
                {isMe && <ReadReceipts msg={msg} currentUserId={currentUserId} />}
            </div>

            {/* Hover Toolbar */}
            <div className={`absolute -top-3 right-4 bg-white border border-gray-200 shadow-sm rounded-lg p-0.5 flex items-center gap-0.5 transition-opacity duration-200 ${showToolbar || openMsgMenuId === msg.id || showReactionPicker ? "opacity-100 visible" : "opacity-0 invisible"}`}>

                {/* Reaction Picker Trigger */}
                <div className="relative" ref={reactionPickerRef}>
                    <button
                        onClick={() => setShowReactionPicker(!showReactionPicker)}
                        className={`p-1.5 rounded-md transition-colors ${showReactionPicker ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
                        title="Add reaction"
                    >
                        <Smile size={16} />
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

                <button onClick={() => onOpenThread && onOpenThread(msg.id)} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors" title="Reply in thread"><MessageSquare size={16} /></button>
                <button onClick={() => forwardMessage(msg.id)} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors" title="Forward"><Share size={16} /></button>

                <div className="relative">
                    <button onClick={(e) => toggleMsgMenu(e, msg.id)} className={`p-1.5 rounded-md transition-colors ${openMsgMenuId === msg.id ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`} title="More actions"><MoreHorizontal size={16} /></button>
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
