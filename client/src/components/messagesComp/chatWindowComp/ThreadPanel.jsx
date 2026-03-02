import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { formatTime as fmtTime } from "./helpers/helpers";
import { useToast } from "../../../contexts/ToastContext";
import { Smile, X } from "lucide-react";
import FooterInput from "./footer/footerInput";
import { API_BASE } from "../../../services/api";
import { encryptMessageForSending, batchDecryptMessages } from "../../../services/messageEncryptionService";

export default function ThreadPanel({ parentMessage, channelId, conversationType = 'channel', onClose, socket, currentUserId, showHeader = true, className = "" }) {
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
        if (!channelId) {
            console.error('[THREAD][FATAL] Cannot load thread without channelId');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            // Use _id as primary, id as fallback
            const messageId = parentMessage._id || parentMessage.id;

            const res = await axios.get(`${API_BASE}/api/v2/messages/thread/${messageId}`, { headers });

            // ✅ Use channelId from props
            console.log(`[THREAD][FETCH][DECRYPT] Loaded ${res.data.replies?.length || 0} replies for thread ${messageId}`);
            console.log(`[THREAD][FETCH][DECRYPT] Decrypting with context:`, {
                channelId,
                conversationType,
                replyCount: res.data.replies?.length || 0
            });

            // Decrypt parent message if returned
            let decryptedParent = res.data.parent;
            if (res.data.parent && channelId) {
                try {
                    const decryptedParents = await batchDecryptMessages(
                        [res.data.parent],
                        channelId,
                        conversationType,
                        null
                    );
                    decryptedParent = decryptedParents[0] || res.data.parent;
                    console.log(`[THREAD][FETCH][DECRYPT] Parent message decrypted`);
                } catch (err) {
                    console.error('[THREAD][FETCH][DECRYPT] Failed to decrypt parent:', err);
                }
            }

            // Decrypt all replies
            let decryptedReplies = res.data.replies || [];
            if (decryptedReplies.length > 0 && channelId) {
                // ✅ NORMALIZE: Add id field for batchDecryptMessages compatibility
                const normalizedReplies = decryptedReplies.map(reply => ({
                    ...reply,
                    id: reply._id || reply.id,  // Required by batchDecryptMessages
                    isThreadEncrypted: false  // Thread replies use conversation key, not thread key
                }));

                // ✅ FILTER: Only decrypt valid encrypted replies
                const validReplies = normalizedReplies.filter((reply, idx) => {
                    const isValid = reply?._id &&
                        reply.payload?.ciphertext &&
                        reply.payload?.messageIv;

                    if (!isValid) {
                        console.log(`[THREAD][DECRYPT][SKIP] Reply ${idx + 1} invalid:`, {
                            hasId: !!reply?._id,
                            hasCiphertext: !!reply?.payload?.ciphertext,
                            hasIv: !!reply?.payload?.messageIv,
                            reply: reply
                        });
                    }
                    return isValid;
                });

                console.log(`[THREAD][NORMALIZE] Filtered ${validReplies.length}/${decryptedReplies.length} valid encrypted replies`);

                if (validReplies.length > 0) {
                    try {
                        const messageId = parentMessage._id || parentMessage.id;
                        console.log(`[THREAD][DECRYPT][INPUT] Batch decrypting ${validReplies.length} replies with parent ${messageId}:`,
                            validReplies.map(r => r._id)
                        );

                        // Thread replies do NOT use userJoinedAt filtering — access is inherited from the parent message
                        decryptedReplies = await batchDecryptMessages(
                            validReplies,  // ✅ Only valid replies
                            channelId,
                            conversationType,
                            null  // Threads don't filter by joinedAt
                        );
                        console.log(`[THREAD][DECRYPT][SUCCESS] Decrypted ${decryptedReplies.length} replies successfully`);
                    } catch (err) {
                        console.error('[THREAD][FETCH][DECRYPT] Failed to decrypt replies:', err);
                        // Fall back to original array if decrypt fails
                        decryptedReplies = validReplies;
                    }
                } else {
                    console.log(`[THREAD][DECRYPT][SKIP] No valid encrypted replies to decrypt`);
                    decryptedReplies = [];
                }
            } else if (decryptedReplies.length === 0) {
                console.log(`[THREAD][DECRYPT][SKIP] No replies to decrypt`);
            } else {
                console.log(`[THREAD][DECRYPT][SKIP] Missing channelId, cannot decrypt`);
            }

            // Update state with decrypted data
            if (decryptedParent) setParentMessageState(decryptedParent);
            setReplies(decryptedReplies);
        } catch (err) {
            console.error("Load thread failed:", err);
        } finally {
            setLoading(false);
        }
    }, [parentMessage._id, parentMessage.id, channelId, conversationType]);

    // Load thread on mount
    useEffect(() => {
        loadThread();
    }, [loadThread]);

    // Listen for new replies
    useEffect(() => {
        if (!socket) return;

        const handleNewReply = async (data) => {
            // Backend emits 'thread-reply' with { parentId, reply, clientTempId }
            const reply = data.reply || data.message || data;
            const replyParentId = reply.parentId || data.parentId || reply.replyTo;
            const messageId = parentMessage._id || parentMessage.id;

            // ✅ Extract clientTempId from data payload (sent by backend)
            const socketClientTempId = data.clientTempId || reply.clientTempId;

            console.log(`[THREAD][REALTIME] Received thread reply:`, {
                replyId: reply._id,
                replyParentId,
                currentThreadParent: messageId,
                isMatch: replyParentId === messageId,
                hasClientTempId: !!socketClientTempId,
                clientTempId: socketClientTempId,
                isEncrypted: !!reply.payload?.ciphertext
            });

            // Only process if reply belongs to THIS thread
            if (replyParentId !== messageId) {
                console.log(`[THREAD][REALTIME] Parent mismatch, ignoring`);
                return;
            }

            // ✅ NORMALIZE: Add id field for batchDecryptMessages compatibility
            const normalizedReply = {
                ...reply,
                id: reply._id || reply.id,  // Required by batchDecryptMessages
                isThreadEncrypted: false,  // Thread replies use conversation key, not thread key
                clientTempId: socketClientTempId // ✅ Attach clientTempId for reconciliation
            };

            // ✅ DECRYPT realtime reply before adding to state
            let decryptedReply = normalizedReply;

            // ✅ VALIDATE reply before attempting decrypt
            const canDecrypt = normalizedReply?._id &&
                normalizedReply.payload?.ciphertext &&
                normalizedReply.payload?.messageIv &&
                channelId;

            if (canDecrypt) {
                try {
                    const messageId = parentMessage._id || parentMessage.id;
                    console.log(`[THREAD][DECRYPT][INPUT] Realtime reply ${normalizedReply._id} valid, decrypting with parent ${messageId}...`);
                    // Thread replies do NOT use userJoinedAt filtering — access is inherited from the parent message
                    const decrypted = await batchDecryptMessages(
                        [normalizedReply],
                        channelId,
                        conversationType,
                        null  // Threads don't filter by joinedAt
                    );
                    decryptedReply = decrypted[0] || normalizedReply;
                    console.log(`[THREAD][REALTIME][DECRYPT] Successfully decrypted reply`);
                } catch (err) {
                    console.error('[THREAD][REALTIME][DECRYPT] Failed to decrypt reply:', err);
                    // Fall back to encrypted version (will show ciphertext in UI)
                }
            } else {
                console.log(`[THREAD][DECRYPT][SKIP] Reply cannot be decrypted:`, {
                    hasId: !!normalizedReply?._id,
                    hasCiphertext: !!normalizedReply?.payload?.ciphertext,
                    hasIv: !!normalizedReply?.payload?.messageIv,
                    hasChannelId: !!channelId
                });
            }

            setReplies((prev) => {
                // 1. Check strict duplicate by ID
                if (prev.find((r) => r._id === decryptedReply._id)) {
                    console.log(`[THREAD][REALTIME] Reply already exists (duplicate), skipping`);
                    return prev;
                }

                // 2. Check for matching optimistic message using clientTempId (most reliable)
                const optimisticMatchIndex = decryptedReply.clientTempId
                    ? prev.findIndex(r => r._id === decryptedReply.clientTempId || r.clientTempId === decryptedReply.clientTempId)
                    : -1;

                if (optimisticMatchIndex !== -1) {
                    console.log(`[THREAD][REALTIME][RECONCILE] Replacing optimistic reply:`, {
                        optimisticId: prev[optimisticMatchIndex]._id,
                        realId: decryptedReply._id,
                        clientTempId: decryptedReply.clientTempId
                    });
                    const newReplies = [...prev];
                    newReplies[optimisticMatchIndex] = decryptedReply;
                    return newReplies;
                }

                // 3. No optimistic match - this is a reply from another user
                console.log(`[THREAD][REALTIME] Adding new reply from other user`);
                return [...prev, decryptedReply];
            });
        };

        socket.on("thread-reply", handleNewReply);

        return () => {
            socket.off("thread-reply", handleNewReply);
        };
    }, [socket, parentMessage._id, parentMessage.id, channelId, conversationType]);

    // Scroll to bottom on new reply
    useEffect(() => {
        repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [replies]);

    const handleSendReply = async (text) => {
        if (!text || !text.trim() || sending) return;

        const replyText = text.trim();

        setSending(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const messageId = parentMessage._id || parentMessage.id;

            // ✅ Use channelId from props
            console.log(`[THREAD][SEND][E2EE] Encrypting reply for parent ${messageId}`);
            console.log(`[THREAD][SEND][CTX] Using channel context:`, {
                channelId,
                conversationType,
                parentId: messageId
            });

            // Encrypt the reply using the same flow as normal messages
            const encryptedPayload = await encryptMessageForSending(
                replyText,
                channelId,
                conversationType
            );

            if (!encryptedPayload) {
                console.error('[THREAD][SEND][E2EE] Encryption failed');
                showToast('Failed to encrypt message', 'error');
                setSending(false);
                return;
            }

            console.log(`[THREAD][SEND][E2EE] Encryption successful, sending to backend`);

            // Optimistic update (with plaintext for UI display)
            const tempId = "temp-" + Date.now();
            const optimisticReply = {
                _id: tempId,
                payload: { text: replyText }, // Plaintext for UI (will be replaced)
                text: replyText, // Fallback for compatibility
                sender: { _id: currentUserId, username: "You", profilePicture: null },
                senderId: currentUserId,
                createdAt: new Date().toISOString(),
                parentId: messageId,
                clientTempId: tempId
            };
            setReplies((prev) => [...prev, optimisticReply]);

            // Send encrypted payload to backend
            const res = await axios.post(
                `${API_BASE}/api/v2/messages/thread/${messageId}`,
                {
                    ciphertext: encryptedPayload.ciphertext,
                    messageIv: encryptedPayload.messageIv,
                    attachments: [],
                    clientTempId: tempId
                },
                { headers }
            );

            console.log(`[THREAD][SEND][E2EE] Reply created successfully: ${res.data.reply._id}`);

            // ✅ DECRYPT server response before replacing optimistic reply
            console.log(`[THREAD][NORMALIZE] Normalizing server response:`, {
                replyId: res.data.reply._id,
                hasCiphertext: !!res.data.reply.payload?.ciphertext,
                hasIv: !!res.data.reply.payload?.messageIv,
                isEncrypted: res.data.reply.payload?.isEncrypted
            });

            // ✅ NORMALIZE: Add id field for batchDecryptMessages compatibility
            const normalizedServerReply = {
                ...res.data.reply,
                id: res.data.reply._id || res.data.reply.id,  // Required by batchDecryptMessages
                isThreadEncrypted: false  // Thread replies use conversation key, not thread key
            };

            // Decrypt the reply from server
            let decryptedServerReply = normalizedServerReply;

            // ✅ VALIDATE server response before attempting decrypt
            const serverReplyValid = normalizedServerReply?._id &&
                normalizedServerReply.payload?.ciphertext &&
                normalizedServerReply.payload?.messageIv &&
                channelId;

            if (serverReplyValid) {
                try {
                    const messageId = parentMessage._id || parentMessage.id;
                    console.log(`[THREAD][DECRYPT][INPUT] Server response valid, decrypting ${normalizedServerReply._id} with parent ${messageId}`);
                    // Thread replies do NOT use userJoinedAt filtering — access is inherited from the parent message
                    const decrypted = await batchDecryptMessages(
                        [normalizedServerReply],
                        channelId,
                        conversationType,
                        null  // Threads don't filter by joinedAt
                    );
                    decryptedServerReply = decrypted[0] || normalizedServerReply;
                    console.log(`[THREAD][DECRYPT][SUCCESS] Server reply decrypted successfully`);
                } catch (err) {
                    console.error('[THREAD][DECRYPT] Failed to decrypt server reply:', err);
                    // Fall back to encrypted version
                }
            } else {
                console.log(`[THREAD][DECRYPT][SKIP] Server reply cannot be decrypted:`, {
                    hasId: !!normalizedServerReply?._id,
                    hasCiphertext: !!normalizedServerReply?.payload?.ciphertext,
                    hasIv: !!normalizedServerReply?.payload?.messageIv,
                    hasChannelId: !!channelId
                });
            }

            // Replace temp with DECRYPTED real message
            setReplies((prev) =>
                prev.map((r) => (r._id === tempId ? decryptedServerReply : r))
            );
        } catch (err) {
            console.error("[THREAD][SEND][E2EE] Send reply failed:", err);
            showToast(err.response?.data?.message || "Failed to send reply", "error");
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
        <div className={`h-full bg-white dark:bg-gray-900 border-l dark:border-gray-800 shadow-xl flex flex-col animate-slide-in-right flex-shrink-0 ${className || 'w-[400px]'}`}>
            {/* Critical Error: Missing channelId */}
            {!channelId ? (
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                        <p className="text-red-600 font-bold mb-2">Thread Error</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Unable to load thread: missing channel context</p>
                        <button
                            onClick={onClose}
                            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : (
                <>
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
                                                    {parentMessageState.decryptedContent || parentMessageState.payload?.text || parentMessageState.text}
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
                                                            {reply.decryptedContent || reply.payload?.text || reply.text}
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
                                showAI={true} // Enable AI button for thread replies
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
                </>
            )}
        </div>
    );
}

