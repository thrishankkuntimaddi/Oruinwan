// Simplified DM Chat Window - No threads, simpler UI
import React, { useEffect, useRef, useState } from "react";
import { Phone, Video, MoreVertical, X, Loader2 } from "lucide-react";
import api from "../../services/api";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../contexts/SocketContext";
import DMMessageItem from "./chatWindowComp/messages/DMMessageItem";
import { groupByDate } from "./chatWindowComp/helpers/helpers";
import conversationKeyService from "../../services/conversationKeyService"; // DM ONLY
import { encryptMessageForSending } from "../../services/messageEncryptionService"; // DM ONLY

export default function DMChatWindow({ chat, onClose, onDeleteChat }) {
    const { accessToken } = useAuth();
    const { showToast } = useToast();
    const { socket: sharedSocket, isConnected: sharedSocketConnected } = useSocket();

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
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

    // Socket setup using shared socket from SocketContext
    useEffect(() => {
        if (!chat || !sharedSocket) return;

        console.log(`🔌 [DMChatWindow] Setting up socket for DM: ${chat.id}`);

        socketRef.current = sharedSocket;

        // Listen for new messages
        const handleNewMessage = ({ message, clientTempId }) => {
            console.log(`📩 [DMChatWindow] Received new-message event:`, message);

            // Remove pending optimistic message if exists
            if (clientTempId && pendingMessagesRef.current[clientTempId]) {
                delete pendingMessagesRef.current[clientTempId];
                setMessages(prev => prev.filter(m => m.id !== clientTempId));
            }

            // Add real message
            const formattedMsg = {
                id: message._id,

                // keep sender object, don't flatten too early
                sender: message.sender,

                senderName: message.sender.username,
                senderAvatar: message.sender.profilePicture,

                // ✅ KEEP PAYLOAD (THIS IS THE FIX)
                payload: message.payload,

                ts: message.createdAt,
                backend: message,
            };


            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === formattedMsg.id)) return prev;
                return [...prev, formattedMsg];
            });
        };

        const handleMessageSent = ({ message, clientTempId }) => {
            console.log(`✅ [DMChatWindow] Message sent confirmed:`, message);

            // Replace optimistic message with real one
            if (clientTempId && pendingMessagesRef.current[clientTempId]) {
                delete pendingMessagesRef.current[clientTempId];

                const formattedMsg = {
                    id: message._id,
                    sender: "you",
                    senderName: message.sender.username,
                    senderAvatar: message.sender.profilePicture,
                    payload: message.payload,
                    ts: message.createdAt,
                    backend: message,
                };

                setMessages(prev => prev.map(m =>
                    m.id === clientTempId ? formattedMsg : m
                ));
            }
        };

        const handleSendError = ({ clientTempId, message: errorMsg }) => {
            console.error("❌ [DMChatWindow] Send error:", errorMsg);

            if (clientTempId) {
                setMessages(prev => prev.map(m =>
                    m.id === clientTempId ? { ...m, failed: true, sending: false } : m
                ));
                delete pendingMessagesRef.current[clientTempId];
            }

            showToast(errorMsg || "Failed to send message", "error");
        };

        // Register event listeners
        sharedSocket.on("new-message", handleNewMessage);
        sharedSocket.on("message-sent", handleMessageSent);
        sharedSocket.on("send-error", handleSendError);

        // Join DM room if socket is already connected
        if (sharedSocket.connected && !chat.isNew && chat.id) {
            console.log(`🚪 [DMChatWindow] Joining DM room: ${chat.id}`);
            sharedSocket.emit("join-dm", { dmSessionId: chat.id });
        }

        // Cleanup function
        return () => {
            console.log(`🧹 [DMChatWindow] Cleaning up socket listeners for DM: ${chat.id}`);
            sharedSocket.off("new-message", handleNewMessage);
            sharedSocket.off("message-sent", handleMessageSent);
            sharedSocket.off("send-error", handleSendError);
            // Don't disconnect - it's a shared socket
        };
    }, [chat, sharedSocket, currentUserId, showToast]);

    // Handle socket connection changes
    useEffect(() => {
        if (!sharedSocket || !chat) return;

        const handleConnect = () => {
            console.log(`🔗 [DMChatWindow] Socket connected`);

            // Join DM room when socket connects
            if (!chat.isNew && chat.id) {
                console.log(`🚪 [DMChatWindow] Joining DM room on connect: ${chat.id}`);
                sharedSocket.emit("join-dm", { dmSessionId: chat.id });
            }
        };

        const handleDisconnect = () => {
            console.log(`🔌 [DMChatWindow] Socket disconnected`);
        };

        sharedSocket.on("connect", handleConnect);
        sharedSocket.on("disconnect", handleDisconnect);

        // If already connected, join the room
        if (sharedSocket.connected && !chat.isNew && chat.id) {
            handleConnect();
        }

        return () => {
            sharedSocket.off("connect", handleConnect);
            sharedSocket.off("disconnect", handleDisconnect);
        };
    }, [sharedSocket, chat]);

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

                    sender: msg.sender,

                    senderName: msg.sender.username,
                    senderAvatar: msg.sender.profilePicture,

                    // ✅ KEEP PAYLOAD
                    payload: msg.payload,

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

    const sendMessage = async () => {
        if (!newMessage.trim() || !sharedSocketConnected || !socketRef.current) return;

        const socket = socketRef.current;
        const clientTempId = generateTempId();

        // Optimistic UI
        const optimisticMsg = {
            id: clientTempId,
            sender: { _id: currentUserId },
            payload: {
                text: newMessage.trim(),
                isEncrypted: false, // local only
            },
            ts: new Date().toISOString(),
            sending: true,
        };

        setMessages(prev => [...prev, optimisticMsg]);
        pendingMessagesRef.current[clientTempId] = optimisticMsg;

        console.log(`📤 [DMChatWindow] Sending message to DM:`, chat.id);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ✅ DM ONLY — FIRST MESSAGE KEY BINDING
        // CRITICAL: Conversation keys MUST use real DMSession._id
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CASE A: NEW DM (chat.isNew === true)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (chat.isNew) {
            console.log(`🆕 [DM ONLY] First message to new DM - sending unencrypted to create DMSession`);

            // ❌ DO NOT create conversation key yet
            // ❌ DO NOT encrypt the message yet
            // ✅ Send plaintext first message to get real dmSessionId from server

            try {
                const messagePayload = {
                    text: newMessage.trim(),
                    clientTempId,
                    workspaceId: chat.workspaceId,
                    receiverId: chat.id, // receiverId for new DM
                    // NO ciphertext, NO isEncrypted - server creates DMSession
                };

                socket.emit("send-message", messagePayload);
                setNewMessage("");

                console.log(`✉️ [DM ONLY] Sent first message (unencrypted) to create DMSession`);

                // Timeout for failed sends
                setTimeout(() => {
                    if (pendingMessagesRef.current[clientTempId]) {
                        setMessages(prev => prev.map(m =>
                            m.id === clientTempId ? { ...m, failed: true, sending: false } : m
                        ));
                        delete pendingMessagesRef.current[clientTempId];
                        showToast("Message send timeout", "error");
                    }
                }, 10000);

            } catch (sendError) {
                console.error(`❌ [DM ONLY] Send failed:`, sendError);
                setMessages(prev => prev.map(m =>
                    m.id === clientTempId ? { ...m, failed: true, sending: false } : m
                ));
                delete pendingMessagesRef.current[clientTempId];
                showToast("Failed to send message", "error");
            }

            return; // Exit early for new DMs
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CASE B: EXISTING DM (chat.isNew === false)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`🔑 [DM ONLY] Existing DM - ensuring conversation key with real dmSessionId: ${chat.id}`);

        let encryptedPayload = null;

        try {
            // Get DM participants
            let participantIds = [];
            if (chat.participants && Array.isArray(chat.participants)) {
                participantIds = chat.participants.map(p => p._id || p);
            } else {
                // Fallback: fetch from API
                const dmResponse = await api.get(`/api/messages/dm/${chat.workspaceId}/${chat.id}`);
                const messages = dmResponse.data.messages || [];
                // Extract unique participants from messages
                const uniqueParticipants = new Set();
                messages.forEach(msg => {
                    if (msg.sender && msg.sender._id) uniqueParticipants.add(msg.sender._id);
                });
                participantIds = Array.from(uniqueParticipants);
                if (participantIds.length === 0) {
                    participantIds = [currentUserId]; // At minimum include self
                }
            }

            console.log(`📤 [DM ONLY] Ensuring conversation key for ${participantIds.length} participants`);

            // ✅ Use REAL DMSession._id (chat.id) - NEVER temp IDs
            const conversationKey = await conversationKeyService.ensureConversationKey(
                chat.id, // REAL dmSessionId from server
                'dm',
                chat.workspaceId,
                participantIds
            );

            console.log(`✅ [DM ONLY] Conversation key ready`);

            // Encrypt message with conversation key
            console.log(`🔐 [DM ONLY] Encrypting message`);
            encryptedPayload = await encryptMessageForSending(
                newMessage.trim(),
                chat.id, // REAL dmSessionId
                'dm',
                null // no replyTo for DMs
            );
            console.log(`✅ [DM ONLY] Message encrypted`);

        } catch (cryptoError) {
            console.error(`❌ [DM ONLY] Encryption failed:`, cryptoError);
            showToast("Failed to encrypt message", "error");
            // Remove optimistic UI message
            setMessages(prev => prev.filter(m => m.id !== clientTempId));
            delete pendingMessagesRef.current[clientTempId];
            setNewMessage("");
            return;
        }

        // Send encrypted message to server
        try {
            const messagePayload = {
                text: newMessage.trim(),
                clientTempId,
                workspaceId: chat.workspaceId,
                dmSessionId: chat.id, // REAL dmSessionId
            };

            // Add encrypted payload if available
            if (encryptedPayload) {
                messagePayload.ciphertext = encryptedPayload.ciphertext;
                messagePayload.messageIv = encryptedPayload.messageIv;
                messagePayload.isEncrypted = true;
                console.log(`✉️ [DM ONLY] Sending encrypted message`);
            }

            socket.emit("send-message", messagePayload);
            setNewMessage("");

            // Timeout for failed sends
            setTimeout(() => {
                if (pendingMessagesRef.current[clientTempId]) {
                    setMessages(prev => prev.map(m =>
                        m.id === clientTempId ? { ...m, failed: true, sending: false } : m
                    ));
                    delete pendingMessagesRef.current[clientTempId];
                    showToast("Message send timeout", "error");
                }
            }, 10000);
        } catch (sendError) {
            console.error(`❌ [DM ONLY] Send failed:`, sendError);
            setMessages(prev => prev.map(m =>
                m.id === clientTempId ? { ...m, failed: true, sending: false } : m
            ));
            delete pendingMessagesRef.current[clientTempId];
            showToast("Failed to send message", "error");
        }
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
                        disabled={!newMessage.trim() || !sharedSocketConnected}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        Send
                    </button>
                </div>
                {!sharedSocketConnected && (
                    <p className="text-xs text-red-500 mt-2">Disconnected. Trying to reconnect...</p>
                )}
            </div>
        </div>
    );
}
