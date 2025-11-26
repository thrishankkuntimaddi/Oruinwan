import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { formatTime as fmtTime } from "./helpers/helpers";
import { Bold, Italic, Link, List, Smile, Send, X, Paperclip } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ThreadPanel({ parentMessage, onClose, socket, currentUserId }) {
    // We use a local state for the parent message in case we fetch a fresher version,
    // but we initialize it with the prop passed from the parent.
    const [parentMessageState, setParentMessageState] = useState(parentMessage);
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const repliesEndRef = useRef(null);

    const formatTime = (iso) => fmtTime(iso);

    // Update local state if prop changes
    useEffect(() => {
        setParentMessageState(parentMessage);
    }, [parentMessage]);

    const loadThread = useCallback(async () => {
        // If it's a dummy message (id starts with "ch-" or "dm-"), don't fetch from backend
        if (parentMessage.id && (String(parentMessage.id).startsWith("ch-") || String(parentMessage.id).startsWith("dm-"))) {
            setReplies([]); // No backend replies for dummy messages
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await axios.get(`${API_BASE}/api/messages/thread/${parentMessage.id}`, { headers });

            // If backend returns a parent, update it, otherwise keep the prop version
            if (res.data.parent) setParentMessageState(res.data.parent);
            setReplies(res.data.replies || []);
        } catch (err) {
            console.error("Load thread failed:", err);
        } finally {
            setLoading(false);
        }
    }, [parentMessage.id]);

    // Load thread on mount
    useEffect(() => {
        loadThread();
    }, [loadThread]);

    // Listen for new replies
    useEffect(() => {
        if (!socket) return;

        const handleNewReply = (reply) => {
            if (reply.replyTo === parentMessage.id || reply.replyTo?._id === parentMessage.id) {
                setReplies((prev) => {
                    if (prev.find((r) => r._id === reply._id)) return prev;
                    return [...prev, reply];
                });
            }
        };

        socket.on("receive-message", handleNewReply);
        return () => {
            socket.off("receive-message", handleNewReply);
        };
    }, [socket, parentMessage.id]);

    // Scroll to bottom on new reply
    useEffect(() => {
        repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [replies]);

    const handleSendReply = async () => {
        if (!newReply.trim() || sending) return;

        setSending(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            // Optimistic update
            const tempId = "temp-" + Date.now();
            const optimisticReply = {
                _id: tempId,
                text: newReply,
                senderId: currentUserId,
                createdAt: new Date().toISOString(),
                replyTo: parentMessage.id,
            };
            setReplies((prev) => [...prev, optimisticReply]);
            setNewReply("");

            const res = await axios.post(
                `${API_BASE}/api/messages/reply`,
                {
                    originalMessageId: parentMessage.id,
                    text: optimisticReply.text,
                },
                { headers }
            );

            // Replace temp with real
            setReplies((prev) =>
                prev.map((r) => (r._id === tempId ? res.data : r))
            );
        } catch (err) {
            console.error("Send reply failed:", err);
            alert("Failed to send reply");
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendReply();
        }
    };

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    return (
        <div className="w-[400px] h-full bg-white border-l shadow-xl flex flex-col animate-slide-in-right flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 text-base">Direction</h3>
                    <span className="text-xs text-gray-400">#{parentMessageState?.channelId?.name || "discussion"}</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                    title="Close"
                >
                    <X size={20} />
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <>
                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white flex flex-col">

                        {/* Parent Message (Highlighted & Compact) */}
                        {parentMessageState && (
                            <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/20">
                                <div className="flex items-start gap-2">
                                    <div
                                        className="h-7 w-7 bg-gray-200 rounded-md flex-shrink-0 bg-cover bg-center shadow-sm"
                                        style={{
                                            backgroundImage: `url(${parentMessageState.senderAvatar || parentMessageState.senderId?.profilePicture || "/default-avatar.png"})`,
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-xs text-gray-900">
                                                {parentMessageState.senderName || parentMessageState.senderId?.username || "Unknown"}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {formatTime(parentMessageState.ts || parentMessageState.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-800 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                            {parentMessageState.text}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Replies List */}
                        <div className="flex-1 px-4 py-2 space-y-5 mt-2">
                            {replies.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Smile size={32} className="text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium">No replies yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Be the first to reply to this thread!</p>
                                </div>
                            ) : (
                                replies.map((reply) => {
                                    const isMe = String(reply.senderId?._id || reply.senderId) === String(currentUserId);

                                    return (
                                        <div key={reply._id} className="flex items-start gap-3 group">
                                            <div
                                                className="h-8 w-8 bg-gray-200 rounded-md flex-shrink-0 bg-cover bg-center"
                                                style={{
                                                    backgroundImage: `url(${reply.senderId?.profilePicture || "/default-avatar.png"})`,
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-bold text-sm text-gray-900">
                                                        {reply.senderId?.username || "Unknown"}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {formatTime(reply.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                                    {reply.text}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={repliesEndRef} />
                        </div>
                    </div>

                    {/* Input Area (Compact & Feature-rich) */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        <div className="border border-gray-300 rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all bg-white">

                            {/* Textarea */}
                            <textarea
                                value={newReply}
                                onChange={(e) => setNewReply(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Reply..."
                                rows={1}
                                className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none bg-transparent max-h-32 min-h-[44px]"
                            />

                            {/* Toolbar */}
                            <div className="flex items-center justify-between px-2 pb-2 pt-1">
                                <div className="flex items-center gap-1">
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Bold">
                                        <Bold size={14} />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Italic">
                                        <Italic size={14} />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Link">
                                        <Link size={14} />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="List">
                                        <List size={14} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Add emoji">
                                        <Smile size={16} />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Attach file">
                                        <Paperclip size={16} />
                                    </button>
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!newReply.trim() || sending}
                                        className={`p-1.5 rounded-md transition-all flex items-center justify-center ${newReply.trim() && !sending
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                                            }`}
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
