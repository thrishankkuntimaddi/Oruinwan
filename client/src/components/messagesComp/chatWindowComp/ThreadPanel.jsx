import React, { useState, useEffect, useRef, useCallback } from "react";
import api from '@services/api';
import { formatTime as fmtTime } from "./helpers/helpers";
import { useToast } from "../../../contexts/ToastContext";
import { Smile, X, Bell, BellOff } from "lucide-react";
import FooterInput from "./footer/footerInput";
import { API_BASE } from '@services/api';
import { encryptMessageForSending, batchDecryptMessages } from "../../../services/messageEncryptionService";
import { useThreadFollow } from "../../../hooks/useThreadFollow";
import { getAvatarUrl } from "../../../utils/avatarUtils";

export default function ThreadPanel({ parentMessage, channelId, conversationType = 'channel', onClose, socket, currentUserId, showHeader = true, className = "" }) {
    const { showToast } = useToast();

    // We use a local state for the parent message in case we fetch a fresher version,
    // but we initialize it with the prop passed from the parent.
    const [parentMessageState, setParentMessageState] = useState(parentMessage);
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [parentExpanded, setParentExpanded] = useState(false);
    // Bootstrap follow status from getThread response (avoids extra round-trip)
    const [initialFollowStatus, setInitialFollowStatus] = useState({ following: false, followerCount: 0 });
    const repliesEndRef = useRef(null);



    const formatTime = (iso) => fmtTime(iso);

    // Thread follow state — bootstrapped from getThread response
    const messageId = parentMessage._id || parentMessage.id;
    const { following, followerCount, toggle: toggleFollow, loading: followLoading, markAsFollowing } =
        useThreadFollow(messageId, initialFollowStatus);

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

            const res = await api.get(`/api/v2/messages/thread/${messageId}`);

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
            // Bootstrap follow status from the API response (no extra round-trip)
            if (res.data.followStatus) {
                setInitialFollowStatus(res.data.followStatus);
            }
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
            const res = await api.post(`/api/v2/messages/thread/${messageId}`, {
                    ciphertext: encryptedPayload.ciphertext,
                    messageIv: encryptedPayload.messageIv,
                    attachments: [],
                    clientTempId: tempId
                });

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

            // Auto-follow: instantly reflect follow state after sending a reply
            markAsFollowing();
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

    const FONT = 'Inter, system-ui, -apple-system, sans-serif';

    return (
        <div style={{
            height: '100%',
            backgroundColor: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-accent)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
            width: className || '380px',
            fontFamily: FONT,
        }}>
            {/* Critical Error: Missing channelId */}
            {!channelId ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--state-danger)', fontWeight: 600, marginBottom: '6px', fontSize: '13px', fontFamily: FONT }}>Thread Error</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: FONT }}>Unable to load thread: missing channel context</p>
                        <button
                            onClick={onClose}
                            style={{
                                marginTop: '12px', padding: '6px 16px',
                                backgroundColor: 'var(--bg-active)', color: 'var(--text-secondary)',
                                border: '1px solid var(--border-default)', borderRadius: '2px',
                                cursor: 'pointer', fontSize: '12px', fontFamily: FONT, outline: 'none',
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Header */}
                    {showHeader && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '11px 16px',
                            borderBottom: '1px solid var(--border-default)',
                            backgroundColor: 'var(--bg-surface)',
                            flexShrink: 0,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', fontFamily: FONT, flexShrink: 0 }}>Thread</h3>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{parentMessageState?.channelId?.name || 'discussion'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                {/* Follow / Unfollow toggle */}
                                <button
                                    onClick={toggleFollow}
                                    disabled={followLoading}
                                    title={following ? `Unfollow thread (${followerCount} follower${followerCount !== 1 ? 's' : ''})` : 'Follow thread to get reply notifications'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '4px 10px', borderRadius: '2px', outline: 'none',
                                        fontSize: '11px', fontWeight: 500, cursor: followLoading ? 'not-allowed' : 'pointer',
                                        transition: '100ms ease', fontFamily: FONT,
                                        backgroundColor: following ? 'rgba(184,149,106,0.12)' : 'transparent',
                                        color: following ? 'var(--accent)' : 'var(--text-muted)',
                                        border: following ? '1px solid var(--border-accent)' : '1px solid transparent',
                                        opacity: followLoading ? 0.5 : 1,
                                    }}
                                    onMouseEnter={e => { if (!followLoading && !following) { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                                    onMouseLeave={e => { if (!followLoading && !following) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                                >
                                    {following
                                        ? <><BellOff size={12} /> <span>Following{followerCount > 0 ? ` (${followerCount})` : ''}</span></>
                                        : <><Bell size={12} /> <span>Follow</span></>}
                                </button>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '5px', borderRadius: '2px', outline: 'none', border: 'none',
                                        background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                                        display: 'flex', transition: '100ms ease',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    title="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
                            {[{ n: 20, l1: 62, l2: 0 }, { n: 16, l1: 78, l2: 45 }, { n: 22, l1: 50, l2: 0 }, { n: 18, l1: 85, l2: 55 }, { n: 24, l1: 60, l2: 0 }].map((b, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '75%' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                            <div style={{ height: '10px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', width: `${b.n * 4}px` }} />
                                            <div style={{ height: '8px', width: '32px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', opacity: 0.6 }} />
                                        </div>
                                        <div style={{ height: '14px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', width: `${b.l1}%` }} />
                                        {b.l2 > 0 && <div style={{ height: '14px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', width: `${b.l2}%`, opacity: 0.7 }} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Content Area */}
                            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column' }}>

                                {/* Parent Message */}
                                {parentMessageState && (
                                    <div style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border-default)',
                                        backgroundColor: 'rgba(184,149,106,0.05)',
                                        borderLeft: '3px solid var(--accent)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <img
                                                    src={getAvatarUrl(
                                                        parentMessageState.sender
                                                        || parentMessageState.senderId
                                                        || { username: parentMessageState.senderName || 'user' }
                                                    )}
                                                    alt={parentMessageState.sender?.username || parentMessageState.senderName || 'User'}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                                    onError={(e) => {
                                                        const name = parentMessageState.sender?.username || parentMessageState.senderName || 'U';
                                                        e.target.style.display = 'none';
                                                        e.target.parentNode.style.backgroundColor = 'var(--accent)';
                                                        e.target.parentNode.style.display = 'flex';
                                                        e.target.parentNode.style.alignItems = 'center';
                                                        e.target.parentNode.style.justifyContent = 'center';
                                                        e.target.parentNode.innerHTML = `<span style="color:#0c0c0c;font-weight:700;font-size:11px">${name.charAt(0).toUpperCase()}</span>`;
                                                    }}
                                                />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--accent)', fontFamily: FONT }}>
                                                        {parentMessageState.sender?.username || parentMessageState.senderName || parentMessageState.senderId?.username || 'Unknown'}
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: FONT }}>
                                                        {formatTime(parentMessageState.ts || parentMessageState.createdAt)}
                                                    </span>
                                                </div>
                                                <p style={{
                                                    fontSize: '12px', color: 'var(--text-primary)', margin: 0,
                                                    lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                                                    overflow: 'hidden', fontFamily: FONT,
                                                    display: parentExpanded ? 'block' : '-webkit-box',
                                                    WebkitLineClamp: parentExpanded ? undefined : 4,
                                                    WebkitBoxOrient: 'vertical',
                                                }}>
                                                    {parentMessageState.decryptedContent || parentMessageState.payload?.text || parentMessageState.text}
                                                </p>
                                                {(() => {
                                                    const txt = parentMessageState.decryptedContent || parentMessageState.payload?.text || parentMessageState.text || '';
                                                    return txt.length > 200 || txt.split('\n').length > 4 ? (
                                                        <button
                                                            onClick={() => setParentExpanded(v => !v)}
                                                            style={{
                                                                marginTop: '4px', background: 'none', border: 'none', outline: 'none',
                                                                padding: 0, fontSize: '10px', fontWeight: 600,
                                                                color: 'var(--accent)', cursor: 'pointer', fontFamily: FONT,
                                                                transition: '100ms ease',
                                                            }}
                                                        >
                                                            {parentExpanded ? 'Show less ↑' : 'Show more ↓'}
                                                        </button>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Replies List */}
                                <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px' }}>
                                    {replies.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '48px', height: '48px', borderRadius: '2px',
                                                backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Smile size={24} style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, margin: 0, fontFamily: FONT }}>No replies yet</p>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: FONT }}>Be the first to reply to this thread!</p>
                                        </div>
                                    ) : (
                                        replies.map((reply) => {
                                            const senderName = reply.sender?.username || reply.senderName || reply.senderId?.username || 'Unknown';
                                            const senderObj = reply.sender || reply.senderId || { username: senderName };
                                            const senderPic = getAvatarUrl(senderObj);
                                            const initials = (senderName || 'U').charAt(0).toUpperCase();

                                            return (
                                                <div key={reply._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                    {/* Avatar */}
                                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <img
                                                            src={senderPic}
                                                            alt={senderName}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.parentNode.style.backgroundColor = 'var(--accent)';
                                                                e.target.parentNode.innerHTML = `<span style="color:#0c0c0c;font-weight:700;font-size:12px">${initials}</span>`;
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                                                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', fontFamily: FONT }}>{senderName}</span>
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: FONT }}>{formatTime(reply.createdAt)}</span>
                                                        </div>
                                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontFamily: FONT }}>
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

                            {/* Input Area */}
                            <FooterInput
                                newMessage={newReply}
                                setNewMessage={setNewReply}
                                onSend={handleSendReply}
                                onChange={(e) => setNewReply(e.target.value)}
                                showAI={true}
                                showVoice={false}
                                blocked={false}
                                recording={false}
                                setRecording={() => { }}
                                showAttach={false}
                                setShowAttach={() => { }}
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

