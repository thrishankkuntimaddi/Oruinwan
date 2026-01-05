// Simplified DM Chat Window - No threads, simpler UI
import React, { useEffect, useRef, useState } from "react";
import { Phone, Video, MoreVertical, X, Loader2 } from "lucide-react";
import { io } from "socket.io-client";
import api from "../../services/api";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import DMMessageItem from "./chatWindowComp/messages/DMMessageItem";
import { groupByDate } from "./chatWindowComp/helpers/helpers";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

export default function DMChatWindow({ chat, onClose, onDeleteChat }) {
    const { accessToken } = useAuth();
    const { showToast } = useToast();

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const pendingMessagesRef = useRef({});

    const currentUserId = accessToken ? jwtDecode(accessToken).sub : null;

    // Generate temp ID for optimistic UI
    const generateTempId = () => `temp_${Date.now()}_${Math.random()}`;

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Socket connection
    useEffect(() => {
        if (!accessToken || !chat) return;

        // Helper function to check and refresh token if needed
        const ensureValidToken = async () => {
            let token = accessToken;

            try {
                // Check if token is expired or about to expire
                const decoded = jwtDecode(token);
                const now = Date.now() / 1000;

                // If token expires in less than 60 seconds, refresh it proactively
                if (decoded.exp && decoded.exp - now < 60) {

                    try {
                        const response = await api.post('/api/auth/refresh', {}, {
                            withCredentials: true
                        });

                        token = response.data.accessToken;
                        localStorage.setItem('accessToken', token);
                    } catch (refreshError) {
                        console.error('❌ [DMChatWindow] Failed to refresh token:', refreshError);
                        showToast("Session expired. Please login again.", "error");
                        return null;
                    }
                }
            } catch (err) {
                console.error('[DMChatWindow] Token decode error:', err);
                // If token is malformed, try to continue anyway and let server reject
            }

            return token;
        };

        // Connect socket with valid token
        const connectSocket = async () => {
            const validToken = await ensureValidToken();
            if (!validToken) return;

            const socket = io(API_BASE, {
                auth: { token: validToken },
                transports: ["websocket"],
            });

            socketRef.current = socket;

            socket.on("connect", () => {
                setConnected(true);

                // Join DM room if it's not a new DM
                if (!chat.isNew && chat.id) {
                    socket.emit("join-dm", { dmSessionId: chat.id });
                }
            });

            socket.on("disconnect", () => {
                setConnected(false);
            });

            // Listen for new messages
            socket.on("new-message", ({ message, clientTempId }) => {

                // Remove pending optimistic message if exists
                if (clientTempId && pendingMessagesRef.current[clientTempId]) {
                    delete pendingMessagesRef.current[clientTempId];
                    setMessages(prev => prev.filter(m => m.id !== clientTempId));
                }

                // Add real message
                const formattedMsg = {
                    id: message._id,
                    sender: message.sender._id === currentUserId ? "you" : "them",
                    senderName: message.sender.username,
                    senderAvatar: message.sender.profilePicture,
                    text: message.text,
                    ts: message.createdAt,
                    backend: message,
                };

                setMessages(prev => [...prev, formattedMsg]);
            });

            socket.on("message-sent", ({ message, clientTempId }) => {
                // Replace optimistic message with real one
                if (clientTempId && pendingMessagesRef.current[clientTempId]) {
                    delete pendingMessagesRef.current[clientTempId];

                    const formattedMsg = {
                        id: message._id,
                        sender: "you",
                        senderName: message.sender.username,
                        senderAvatar: message.sender.profilePicture,
                        text: message.text,
                        ts: message.createdAt,
                        backend: message,
                    };

                    setMessages(prev => prev.map(m =>
                        m.id === clientTempId ? formattedMsg : m
                    ));
                }
            });

            socket.on("send-error", ({ clientTempId, message: errorMsg }) => {
                console.error("❌ Send error:", errorMsg);

                if (clientTempId) {
                    setMessages(prev => prev.map(m =>
                        m.id === clientTempId ? { ...m, failed: true, sending: false } : m
                    ));
                    delete pendingMessagesRef.current[clientTempId];
                }

                showToast(errorMsg || "Failed to send message", "error");
            });
        };

        // Call the async connect function
        connectSocket();

        return () => {
            const socket = socketRef.current;
            if (socket) {
                socket.disconnect();
            }
        };
    }, [accessToken, chat, currentUserId, showToast]);

    // Load message history
    useEffect(() => {
        const loadMessages = async () => {
            if (!chat || chat.isNew) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const response = await api.get(`/api/messages/dm/${chat.id}`);
                const msgs = response.data.messages || [];

                const formatted = msgs.map(msg => ({
                    id: msg._id,
                    sender: msg.sender._id === currentUserId ? "you" : "them",
                    senderName: msg.sender.username,
                    senderAvatar: msg.sender.profilePicture,
                    text: msg.text,
                    ts: msg.createdAt,
                    backend: msg,
                }));

                setMessages(formatted);
            } catch (error) {
                console.error("Failed to load messages:", error);
                showToast("Failed to load messages", "error");
            } finally {
                setLoading(false);
            }
        };

        loadMessages();
    }, [chat, currentUserId, showToast]);

    const sendMessage = () => {
        if (!newMessage.trim() || !connected) return;

        const socket = socketRef.current;
        const clientTempId = generateTempId();

        // Optimistic UI
        const optimisticMsg = {
            id: clientTempId,
            sender: "you",
            text: newMessage.trim(),
            ts: new Date().toISOString(),
            sending: true,
        };

        setMessages(prev => [...prev, optimisticMsg]);
        pendingMessagesRef.current[clientTempId] = optimisticMsg;

        // Send to server
        socket.emit("send-message", {
            text: newMessage.trim(),
            clientTempId,
            workspaceId: chat.workspaceId,
            dmSessionId: !chat.isNew ? chat.id : null,
            receiverId: chat.isNew ? chat.id : null,
        });

        setNewMessage("");

        // Timeout for failed sends
        setTimeout(() => {
            if (pendingMessagesRef.current[clientTempId]) {
                setMessages(prev => prev.map(m =>
                    m.id === clientTempId ? { ...m, failed: true, sending: false } : m
                ));
                delete pendingMessagesRef.current[clientTempId];
            }
        }, 10000);
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const grouped = groupByDate(messages);

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {chat.avatar ? (
                            <img src={chat.avatar} alt={chat.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            chat.name?.charAt(0)?.toUpperCase() || "U"
                        )}
                    </div>

                    {/* Name and Status */}
                    <div>
                        <h2 className="font-semibold text-gray-900">
                            {chat.name || chat.username || chat.email?.split('@')[0] || "Unknown User"}
                        </h2>
                        <p className="text-xs text-gray-500">{chat.status || "offline"}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Phone size={20} className="text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Video size={20} className="text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical size={20} className="text-gray-600" />
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <X size={20} className="text-gray-600" />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                        <p className="text-sm text-gray-500">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-3xl">💬</span>
                        </div>
                        <p className="text-lg font-medium text-gray-500">No messages yet</p>
                        <p className="text-sm text-gray-400 mt-1">Send a message to start the conversation</p>
                    </div>
                ) : (
                    <>
                        {grouped.map((grp) => (
                            <div key={grp.label} className="mb-4">
                                {/* Date Header */}
                                <div className="flex justify-center mb-3">
                                    <div className="text-xs text-gray-500 px-3 py-1 bg-gray-100 rounded-full">
                                        {grp.label}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="space-y-2">
                                    {grp.items.map((msg) => (
                                        <DMMessageItem
                                            key={msg.id}
                                            msg={msg}
                                            currentUserId={currentUserId}
                                            chatType="dm"
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Footer */}
            <div className="border-t border-gray-200 p-4">
                <div className="flex items-end gap-2">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        style={{ maxHeight: "120px" }}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || !connected}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        Send
                    </button>
                </div>
                {!connected && (
                    <p className="text-xs text-red-500 mt-2">Disconnected. Trying to reconnect...</p>
                )}
            </div>
        </div>
    );
}
