import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Copy, Heart, Pin, Trash2, Smile } from "lucide-react";
import ReactionBadges from "./reactionBadges";
import ReactionPicker from "./reactionPicker";

/* ---------------------------------------------------------
   🔵 Read Receipts (✔✔ icons)
--------------------------------------------------------- */
function ReadReceipts({ msg, currentUserId, isMe }) {
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
        <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
            {display.map((uid) => (
                <div
                    key={uid}
                    className={`h-3 w-3 rounded-full text-[8px] flex items-center justify-center text-white ${isMe ? "bg-blue-300" : "bg-gray-400"}`}
                    title="Read"
                >
                    ✔
                </div>
            ))}
            {overflow > 0 && <span className={`text-[10px] ${isMe ? "text-blue-200" : "text-gray-400"}`}>+{overflow}</span>}
        </div>
    );
}

/* ---------------------------------------------------------
   DM MessageItem Component (Premium Feed Style)
--------------------------------------------------------- */
export default function DMMessageItem({
    msg,
    selectMode,
    selectedIds,
    toggleSelect,
    openMsgMenuId,
    toggleMsgMenu,
    reactions,
    formatTime,
    addReaction,
    copyMessage,
    deleteMessage,
    pinMessage, // Ensure this is passed
    currentUserId,
}) {
    const isMe = msg.sender === "you" || msg.sender === "me";
    const isSystem = msg.sender === "system";
    const isSelected = selectedIds.has(msg.id);
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
                <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full text-center">
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
            className={`group flex items-start gap-1.5 px-4 py-1 hover:bg-gray-50/50 relative transition-colors ${isSelected ? "bg-blue-50/50" : ""} w-full ${msg.isPinned ? "bg-yellow-50 border-l-4 border-yellow-400" : "border-l-4 border-transparent"}`}
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

            {/* Avatar (Top Aligned) */}
            <div className="flex-shrink-0 mt-0.5">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={msg.senderName} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${isMe ? "bg-blue-600" : "bg-gray-400"}`}>
                        {initial}
                    </div>
                )}
            </div>

            {/* Content Column (Takes remaining width) */}
            <div className="flex flex-col items-start flex-1 min-w-0">

                {/* Message Row: Bubble ... Spacer ... Toolbar + Time */}
                <div className="flex items-start w-full">
                    {/* Message Bubble */}
                    <div className={`relative px-4 py-2 text-sm shadow-sm break-words whitespace-pre-wrap rounded-2xl rounded-tl-none max-w-[75%] ${isMe
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                        }`}>
                        {msg.text}
                    </div>

                    {/* Spacer to push Time/Toolbar to the right */}
                    <div className="flex-1"></div>

                    {/* Right Side: Toolbar + Time */}
                    <div className="flex items-center gap-3 ml-2 mt-1.5 pl-2">

                        {/* Toolbar (Visible on hover or menu open) */}
                        <div className={`flex items-center gap-1 transition-opacity duration-200 ${showToolbar || openMsgMenuId === msg.id || showReactionPicker ? "opacity-100 visible" : "opacity-0 invisible"}`}>

                            {/* Reaction Picker Trigger */}
                            <div className="relative" ref={reactionPickerRef}>
                                <button
                                    onClick={() => setShowReactionPicker(!showReactionPicker)}
                                    className={`p-1 rounded-md transition-colors ${showReactionPicker ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
                                    title="Like"
                                >
                                    {showReactionPicker ? <Smile size={14} /> : <Heart size={14} />}
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

                            {/* Menu Button */}
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleMsgMenu(e, msg.id);
                                    }}
                                    className={`p-1 rounded-md transition-colors ${openMsgMenuId === msg.id ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                                    title="More actions"
                                >
                                    <MoreHorizontal size={14} />
                                </button>

                                {/* Dropdown Menu */}
                                {openMsgMenuId === msg.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl py-1 z-50 text-sm animate-fade-in origin-top-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (pinMessage) pinMessage(msg.id);
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors"
                                        >
                                            <Pin size={14} className="text-gray-400" /> {msg.isPinned ? "Unpin message" : "Pin message"}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyMessage(msg.id);
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors"
                                        >
                                            <Copy size={14} className="text-gray-400" /> Copy text
                                        </button>
                                        <div className="border-t border-gray-100 my-1"></div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMessage(msg.id);
                                                toggleMsgMenu({ stopPropagation: () => { } }, null);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} /> Delete message
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Time (Always visible) */}
                        <span className="text-[10px] text-gray-300 whitespace-nowrap font-medium min-w-[45px] text-right">
                            {formatTime(msg.ts)}
                        </span>
                    </div>
                </div>

                {/* Reactions Row */}
                {reactions[msg.id] && (
                    <div className="ml-1 mt-1">
                        <ReactionBadges reactions={reactions[msg.id]} />
                    </div>
                )}

                {/* Status Indicators */}
                {(msg.sending || msg.failed || isMe) && (
                    <div className="flex justify-end w-full pr-1 mt-0.5">
                        {msg.sending && <span className="text-[10px] italic text-gray-400">Sending...</span>}
                        {msg.failed && <span className="text-[10px] text-red-500 font-bold">Failed</span>}
                        {isMe && !msg.sending && !msg.failed && <ReadReceipts msg={msg} currentUserId={currentUserId} isMe={isMe} />}
                    </div>
                )}
            </div>
        </div>
    );
}
