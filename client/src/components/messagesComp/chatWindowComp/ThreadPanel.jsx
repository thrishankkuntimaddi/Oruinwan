// client/src/components/messagesComp/chatWindowComp/ThreadPanel.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { formatTime as fmtTime } from "./helpers/helpers.js";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ThreadPanel({ parentMessageId, onClose, socket, currentUserId }) {
    const [parentMessage, setParentMessage] = useState(null);
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const repliesEndRef = useRef(null);

    const formatTime = (iso) => fmtTime(iso);

    const loadThread = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await axios.get(`${API_BASE}/api/messages/thread/${parentMessageId}`, { headers });

            setParentMessage(res.data.parent);
            setReplies(res.data.replies || []);
        } catch (err) {
            console.error("Load thread failed:", err);
            alert(err?.response?.data?.message || "Failed to load thread");
        } finally {
            setLoading(false);
        }
    }, [parentMessageId]);

    // Load thread on mount
    useEffect(() => {
        loadThread();
    }, [loadThread]);

    // Listen for new thread replies via socket
    useEffect(() => {
        if (!socket) return;

        const handleThreadReply = ({ parentId, reply }) => {
            if (String(parentId) === String(parentMessageId)) {
                setReplies((prev) => {
                    // Avoid duplicates
                    if (prev.some((r) => String(r._id) === String(reply._id))) return prev;
                    return [...prev, reply];
                });
            }
        };

        socket.on("thread-reply", handleThreadReply);

        return () => {
            socket.off("thread-reply", handleThreadReply);
        };
    }, [socket, parentMessageId]);

    // Auto-scroll to bottom when new replies arrive
    useEffect(() => {
        repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [replies]);

    const handleSendReply = async () => {
        if (!newReply.trim() || sending) return;

        setSending(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const res = await axios.post(
                `${API_BASE}/api/messages/thread/${parentMessageId}`,
                { text: newReply.trim() },
                { headers }
            );

            // Add optimistically (socket will also send it, but we filter duplicates)
            setReplies((prev) => [...prev, res.data.reply]);
            setNewReply("");
        } catch (err) {
            console.error("Send reply failed:", err);
            alert(err?.response?.data?.message || "Failed to send reply");
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

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-lg flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-lg">Thread</h3>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                >
                    ✕
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500">Loading thread...</p>
                </div>
            ) : (
                <>
                    {/* Parent Message */}
                    {parentMessage && (
                        <div className="px-4 py-3 border-b bg-blue-50">
                            <div className="flex items-start gap-3">
                                <div
                                    className="h-10 w-10 bg-gray-300 rounded-full flex-shrink-0"
                                    style={{
                                        backgroundImage: `url(${parentMessage.senderId?.profilePicture || "/default-avatar.png"})`,
                                        backgroundSize: "cover",
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-semibold text-sm">
                                            {parentMessage.senderId?.username || "Unknown"}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {formatTime(parentMessage.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                                        {parentMessage.text}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Replies */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                        {replies.length === 0 ? (
                            <p className="text-center text-gray-500 text-sm mt-8">
                                No replies yet. Start the conversation!
                            </p>
                        ) : (
                            replies.map((reply) => {
                                const isMe = String(reply.senderId?._id || reply.senderId) === String(currentUserId);

                                return (
                                    <div key={reply._id} className="flex items-start gap-3">
                                        <div
                                            className="h-8 w-8 bg-gray-300 rounded-full flex-shrink-0"
                                            style={{
                                                backgroundImage: `url(${reply.senderId?.profilePicture || "/default-avatar.png"})`,
                                                backgroundSize: "cover",
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-semibold text-sm">
                                                    {reply.senderId?.username || "Unknown"}
                                                    {isMe && <span className="text-xs text-gray-500 ml-1">(you)</span>}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {formatTime(reply.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                                                {reply.text}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={repliesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t p-3">
                        <div className="flex gap-2">
                            <textarea
                                value={newReply}
                                onChange={(e) => setNewReply(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Reply to thread..."
                                rows={2}
                                className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleSendReply}
                                disabled={!newReply.trim() || sending}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? "..." : "Send"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Press Enter to send, Shift+Enter for new line
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
