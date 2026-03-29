// Phase 1 — Bookmarks Panel
// Slide-in panel showing all messages the current user has bookmarked

import React, { useEffect, useState, useCallback } from "react";
import { X, Bookmark, Hash, MessageCircle, Loader2, ExternalLink } from "lucide-react";
import api from '@services/api';
import ReactMarkdown from "react-markdown";

function fmtDate(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {function} [props.onJumpToMessage] - Called with messageId to navigate
 */
export default function BookmarksPanel({ open, onClose, onJumpToMessage }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/messages/bookmarks");
            setMessages(res.data.messages || []);
        } catch (err) {
            setError("Failed to load bookmarks");
        } finally {
            setLoading(false);
        }
    }, [open]);

    useEffect(() => { load(); }, [load]);

    const handleRemoveBookmark = useCallback(async (messageId) => {
        try {
            await api.post(`/api/messages/${messageId}/bookmark`);
            setMessages(prev => prev.filter(m => m._id !== messageId));
        } catch { /* silent */ }
    }, []);

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-80 z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Bookmark size={18} className="text-yellow-500 fill-yellow-400" />
                        <h2 className="font-semibold text-gray-900 text-base">Saved Messages</h2>
                        {messages.length > 0 && (
                            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                                {messages.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center h-32 gap-2 text-gray-400">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    )}
                    {error && (
                        <div className="p-5 text-center text-sm text-red-500">{error}</div>
                    )}
                    {!loading && !error && messages.length === 0 && (
                        <div className="p-8 text-center">
                            <Bookmark size={32} className="mx-auto mb-3 text-gray-300" />
                            <p className="text-sm text-gray-500 font-medium">No saved messages</p>
                            <p className="text-xs text-gray-400 mt-1">Bookmark messages to find them here</p>
                        </div>
                    )}
                    {!loading && messages.map(msg => (
                        <div
                            key={msg._id}
                            className="group px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                        >
                            {/* Context: sender + channel */}
                            <div className="flex items-center gap-2 mb-2">
                                {msg.sender?.profilePicture ? (
                                    <img
                                        src={msg.sender.profilePicture}
                                        alt=""
                                        className="w-6 h-6 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center text-xs text-violet-600 font-semibold">
                                        {(msg.sender?.username || "U")[0].toUpperCase()}
                                    </div>
                                )}
                                <span className="text-xs font-semibold text-gray-700">
                                    {msg.sender?.username || "Unknown"}
                                </span>
                                {msg.channel && (
                                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                        <Hash size={10} />
                                        {msg.channel.name || "Channel"}
                                    </span>
                                )}
                                {msg.dm && (
                                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                        <MessageCircle size={10} />
                                        DM
                                    </span>
                                )}
                            </div>

                            {/* Message content */}
                            <div className="text-sm text-gray-700 leading-relaxed line-clamp-4 prose prose-sm max-w-none">
                                <ReactMarkdown>{msg.text || "(attachment)"}</ReactMarkdown>
                            </div>

                            {/* Timestamp + actions */}
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-400">{fmtDate(msg.createdAt)}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {onJumpToMessage && (
                                        <button
                                            onClick={() => onJumpToMessage(msg._id)}
                                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                                            title="Jump to message"
                                        >
                                            <ExternalLink size={13} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleRemoveBookmark(msg._id)}
                                        className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                                        title="Remove bookmark"
                                    >
                                        <Bookmark size={13} className="fill-current" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
