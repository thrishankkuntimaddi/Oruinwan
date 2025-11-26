import React, { useState } from "react";
import { Smile, MoreHorizontal, Copy, Trash2 } from "lucide-react";
import MessageMenu from "./messageMenu";
import ReactionBadges from "./reactionBadges";

/* ---------------------------------------------------------
   🔵 Read Receipts (✔✔ icons)
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
                    className="h-3 w-3 rounded-full bg-blue-400 text-[8px] flex items-center justify-center text-white"
                    title="Read"
                >
                    ✔
                </div>
            ))}
            {overflow > 0 && <span className="text-[10px] text-gray-400">+{overflow}</span>}
        </div>
    );
}

/* ---------------------------------------------------------
   DM MessageItem Component (List Style - All Left)
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
    currentUserId,
}) {
    const isMe = msg.sender === "you" || msg.sender === "me";
    const isSelected = selectedIds.has(msg.id);
    const [showToolbar, setShowToolbar] = useState(false);

    // Avatar Logic
    const avatarUrl = msg.senderAvatar || null;
    const initial = msg.senderName ? msg.senderName.charAt(0).toUpperCase() : "?";

    return (
        <div
            className={`group flex items-start gap-2 px-5 py-1.5 hover:bg-gray-50 relative transition-colors ${isSelected ? "bg-blue-50/50" : ""}`}
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
                </div>

                {/* Message Text */}
                <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                </div>

                {/* Reactions */}
                {reactions[msg.id] && (
                    <div className="mt-1">
                        <ReactionBadges reactions={reactions[msg.id]} />
                    </div>
                )}

                {/* Footer: Status */}
                <div className="flex items-center gap-2 mt-0.5">
                    {msg.sending && <span className="text-[10px] text-gray-400 italic">Sending...</span>}
                    {msg.failed && <span className="text-[10px] text-red-400 font-bold">Failed</span>}
                    {isMe && <ReadReceipts msg={msg} currentUserId={currentUserId} />}
                </div>
            </div>

            {/* Hover Toolbar */}
            <div className={`absolute -top-3 right-4 bg-white border border-gray-200 shadow-sm rounded-lg p-0.5 flex items-center gap-0.5 transition-opacity duration-200 ${showToolbar || openMsgMenuId === msg.id ? "opacity-100 visible" : "opacity-0 invisible"}`}>
                <button onClick={() => addReaction(msg.id, "👍")} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors" title="Add reaction"><Smile size={16} /></button>

                <div className="relative">
                    <button onClick={(e) => toggleMsgMenu(e, msg.id)} className={`p-1.5 rounded-md transition-colors ${openMsgMenuId === msg.id ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`} title="More actions"><MoreHorizontal size={16} /></button>
                    {openMsgMenuId === msg.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">
                            <button onClick={() => { copyMessage(msg.id); toggleMsgMenu(null, null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"><Copy size={14} /> Copy text</button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button onClick={() => { deleteMessage(msg.id); toggleMsgMenu(null, null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete message</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
