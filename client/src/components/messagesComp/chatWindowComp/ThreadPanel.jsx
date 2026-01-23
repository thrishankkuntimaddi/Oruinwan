import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { formatTime as fmtTime } from "./helpers/helpers";
import { useToast } from "../../../contexts/ToastContext";
import { Smile, X } from "lucide-react";
import FooterInput from "./footer/footerInput";
import { API_BASE } from "../../../services/api";

export default function ThreadPanel({ parentMessage, onClose, socket, currentUserId, showHeader = true }) {
    const { showToast } = useToast();
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
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            // Use _id as primary, id as fallback
            const messageId = parentMessage._id || parentMessage.id;

            const res = await axios.get(`${API_BASE}/api/messages/thread/${messageId}`, { headers });

            // If backend returns a parent, update it, otherwise keep the prop version
            if (res.data.parent) setParentMessageState(res.data.parent);
            setReplies(res.data.replies || []);
        } catch (err) {
            console.error("Load thread failed:", err);
        } finally {
            setLoading(false);
        }
    }, [parentMessage._id, parentMessage.id]);

    // Load thread on mount
    useEffect(() => {
        loadThread();
    }, [loadThread]);

    // Listen for new replies
    useEffect(() => {
        if (!socket) return;

        const handleNewReply = (data) => {
            // Backend emits 'thread-reply' with { parentId, reply }
            const reply = data.reply || data; // Handle both structures if needed
            const messageId = parentMessage._id || parentMessage.id;

            if ((data.parentId === messageId) || (reply.replyTo === messageId) || (reply.threadParent === messageId)) {
                setReplies((prev) => {
                    // 1. Check strict duplicate by ID
                    if (prev.find((r) => r._id === reply._id)) return prev;

                    // 2. Check for matching optimistic message (same text, same sender, temp ID)
                    // This handles the race condition where socket arrives before API response
                    const optimisticMatchIndex = prev.findIndex(r => {
                        const rText = r.payload?.text || r.text;
                        const replyText = reply.payload?.text || reply.text;
                        return typeof r._id === 'string' && r._id.startsWith("temp-") &&
                            rText === replyText &&
                            (r.sender?._id === reply.sender?._id || r.senderId === reply.sender?._id);
                    });

                    if (optimisticMatchIndex !== -1) {
                        const newReplies = [...prev];
                        newReplies[optimisticMatchIndex] = reply;
                        return newReplies;
                    }

                    return [...prev, reply];
                });
            }
        };

        socket.on("thread-reply", handleNewReply);
        // Also listen for standard receive-message if it's a thread reply (fallback)
        socket.on("receive-message", handleNewReply);

        return () => {
            socket.off("thread-reply", handleNewReply);
            socket.off("receive-message", handleNewReply);
        };
    }, [socket, parentMessage._id, parentMessage.id]);

    // Scroll to bottom on new reply
    useEffect(() => {
        repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [replies]);

    const handleSendReply = async (text) => {
        if (!text || !text.trim() || sending) return;

        const replyText = text; // FooterInput passes the text

        setSending(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const messageId = parentMessage._id || parentMessage.id;

            // Optimistic update
            const tempId = "temp-" + Date.now();
            const optimisticReply = {
                _id: tempId,
                payload: { text: replyText }, // Match server structure
                text: replyText, // Fallback for compatibility
                sender: { _id: currentUserId, username: "You", profilePicture: null }, // Mock sender structure
                senderId: currentUserId, // Fallback
                createdAt: new Date().toISOString(),
                threadParent: messageId,
            };
            setReplies((prev) => [...prev, optimisticReply]);
            // setNewReply(""); // Handled by FooterInput

            const res = await axios.post(
                `${API_BASE}/api/messages/thread/${messageId}`,
                {
                    text: optimisticReply.text,
                },
                { headers }
            );

            // Replace temp with real
            setReplies((prev) =>
                prev.map((r) => (r._id === tempId ? res.data.reply : r))
            );
        } catch (err) {
            console.error("Send reply failed:", err);
            showToast("Failed to send reply", "error");
        } finally {
            setSending(false);
        }
    };
    // Removed manual handleKeyDown as FooterInput handles it

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    return (
        <div className="w-[400px] h-full bg-white dark:bg-gray-900 border-l dark:border-gray-800 shadow-xl flex flex-col animate-slide-in-right flex-shrink-0">
            {/* Header (Optional) */}
            {showHeader && (
                <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Thread</h3>
                        <span className="text-xs text-gray-400">#{parentMessageState?.channelId?.name || "discussion"}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <>
                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 flex flex-col">

                        {/* Parent Message (Highlighted & Compact) */}
                        {parentMessageState && (
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-blue-50/20 dark:bg-blue-900/10">
                                <div className="flex items-start gap-2">
                                    <div
                                        className="h-7 w-7 bg-gray-200 rounded-md flex-shrink-0 bg-cover bg-center shadow-sm"
                                        style={{
                                            backgroundImage: parentMessageState.sender?.profilePicture || parentMessageState.senderAvatar || parentMessageState.senderId?.profilePicture
                                                ? `url(${parentMessageState.sender?.profilePicture || parentMessageState.senderAvatar || parentMessageState.senderId?.profilePicture})`
                                                : 'none',
                                            backgroundColor: !(parentMessageState.sender?.profilePicture || parentMessageState.senderAvatar || parentMessageState.senderId?.profilePicture)
                                                ? '#6366f1' : undefined
                                        }}
                                    >
                                        {!(parentMessageState.sender?.profilePicture || parentMessageState.senderAvatar || parentMessageState.senderId?.profilePicture) && (
                                            <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                                                {(parentMessageState.senderName || 'U').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                                                {parentMessageState.sender?.username || parentMessageState.senderName || parentMessageState.senderId?.username || "Unknown"}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {formatTime(parentMessageState.ts || parentMessageState.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-800 dark:text-gray-200 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                            {parentMessageState.payload?.text || parentMessageState.text}
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
                                    // Handle different sender structures (backend vs flattened)
                                    const senderName = reply.sender?.username || reply.senderName || reply.senderId?.username || "Unknown";
                                    const senderPic = reply.sender?.profilePicture || reply.senderAvatar || reply.senderId?.profilePicture || "/default-avatar.svg";

                                    return (
                                        <div key={reply._id} className="flex items-start gap-3 group">
                                            <div
                                                className="h-8 w-8 bg-gray-200 rounded-md flex-shrink-0 bg-cover bg-center"
                                                style={{
                                                    backgroundImage: `url(${senderPic})`,
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                                        {senderName}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {formatTime(reply.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                                    {reply.payload?.text || reply.text}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={repliesEndRef} />
                        </div>
                    </div>

                    {/* Input Area (New FooterInput) */}
                    <FooterInput
                        newMessage={newReply}
                        setNewMessage={setNewReply}
                        onSend={handleSendReply}
                        onChange={(e) => setNewReply(e.target.value)}
                        showAI={false} // Disable AI button
                        showVoice={false} // Disable Voice button
                        blocked={false}
                        recording={false} // Simplified for thread for now, or hoist state if needed
                        setRecording={() => { }}
                        showAttach={false} // Default state
                        setShowAttach={() => { }} // Simple handlers or useState if attachment needed
                        showEmoji={false}
                        setShowEmoji={() => { }}
                        onPickEmoji={(emoji) => setNewReply(prev => prev + emoji.native)}
                    />
                </>
            )}
        </div>
    );
}
