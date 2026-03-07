// client/src/components/messagesComp/chatWindowComp/ChatWindowV2.jsx
// Unified Chat Interface - Canonical Implementation

// 🔒 CANONICAL CHAT WINDOW
// This file owns ALL chat orchestration logic.
// UI-only components may be extracted,
// but business logic MUST remain here unless explicitly migrated.


import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatSocket, useConversation, useMessageActions } from '../../../hooks';
import Header from './header/header.jsx';
import ChannelTabs from './tabs/ChannelTabs.jsx';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import { useContacts } from '../../../contexts/ContactsContext';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import api from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

// Extracted view components
import CentralContentView from './views/CentralContentView.jsx';
import ErrorDisplay from './views/ErrorDisplay.jsx';
import ModalRenderer from './views/ModalRenderer.jsx';

// Custom hooks
import useHeaderActions from './hooks/useHeaderActions.js';
import useCanvasActions from './hooks/useCanvasActions.js';
import useMessageInput from './hooks/useMessageInput.js';

import './chatWindow.css';

/**
 * Unified ChatWindow - handles channels, DMs, and broadcasts
 * @param {object} chat - Conversation object { id, type, name, ... }
 * @param {function} onClose - Close callback
 * @param {array} contacts - All contacts (for sharing)
 * @param {function} onDeleteChat - Delete chat callback
 * @param {string} workspaceId - Workspace ID (required for DMs)
 */
function ChatWindowV2({ chat, onClose, contacts = [], onDeleteChat, workspaceId }) {
    const { user, encryptionReady } = useAuth();
    const { socket: rawSocket } = useSocket();
    const currentUserId = user?.sub || user?._id;
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { refreshContacts } = useContacts();
    const { activeWorkspace } = useWorkspace();

    // Check if user is a member of the channel
    const isMember = useMemo(() => {
        if (!chat || chat.type !== 'channel') return true; // DMs are always accessible
        if (!chat.members || !currentUserId) return false;

        return chat.members.some(m => {
            const memberId = m.user?._id || m.user || m._id || m;
            const memberIdStr = memberId?.toString();
            const currentUserIdStr = currentUserId?.toString();
            return memberIdStr === currentUserIdStr;
        });


    }, [chat, currentUserId]);

    // Check if channel is public and discoverable
    const isDiscoverablePublicChannel = useMemo(() => {
        if (!chat || chat.type !== 'channel') return false;
        return !chat.isPrivate && chat.isDiscoverable !== false;
    }, [chat]);

    // ✅ FIX 3: SOFT GATING - UI renders but controls disabled until ready
    const canInteract = encryptionReady && (chat?.type !== 'channel' || isMember);

    // Interaction gate check - encryption ready and membership verified

    // State for joining
    const [isJoining, setIsJoining] = useState(false);

    const handleJoinChannel = useCallback(async () => {
        if (!chat || !chat.id) return;

        setIsJoining(true);
        try {
            await api.post(`/api/channels/${chat.id}/join-discoverable`);
            showToast(`Joined ${chat.name} successfully!`, 'success');

            // Refresh the sidebar channel list, then navigate into the channel
            if (activeWorkspace?.id) await refreshContacts(activeWorkspace.id);
            navigate(`/workspace/${activeWorkspace?.id}/channel/${chat.id}`);
        } catch (err) {
            console.error('Join channel error:', err);
            showToast(err.response?.data?.message || 'Failed to join channel', 'error');
        } finally {
            setIsJoining(false);
        }
    }, [chat, showToast, navigate, refreshContacts, activeWorkspace]);

    // Conversation state
    const [activeThread, setActiveThread] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [recording, setRecording] = useState(false);

    // Canvas/Tabs state
    const [activeTab, setActiveTab] = useState('chat');
    const [tabs, setTabs] = useState([]);

    // Modal state (consolidated)
    const [activeModal, setActiveModal] = useState(null);
    // Track which message is being forwarded (used by ForwardMessageModal)
    const [forwardingMessageId, setForwardingMessageId] = useState(null);
    // Message info: fetched data for MessageInfoModal
    const [messageInfoData, setMessageInfoData] = useState(null);

    // Header UI state
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [muted, setMuted] = useState(false);
    const [blocked, setBlocked] = useState(false);

    // Message input state
    const [newMessage, setNewMessage] = useState('');
    const [showAttach, setShowAttach] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);

    // ✅ PHASE 3: No broken channel detection needed
    // Channels start UNINITIALIZED and become INITIALIZED on first message

    // Dashboard State
    const [dashboardView, setDashboardView] = useState('grid');
    const [dashboardSearch, setDashboardSearch] = useState('');

    // Thread reply counts (separate from message state for persistence)
    const [threadCounts, setThreadCounts] = useState({});

    // Extract conversation details
    const conversationId = chat?.id || chat?._id;
    const conversationType = chat?.type || (chat?.participants ? 'dm' : 'channel');

    // Initialize hooks FIRST (before using them in callbacks)
    const conversation = useConversation(conversationId, conversationType, workspaceId);
    const actions = useMessageActions(conversationId, conversationType, workspaceId, chat?.members || []);

    // Use ref to avoid stale closures in socket event handler
    const conversationRef = React.useRef(conversation);

    // Keep ref up to date
    React.useEffect(() => {
        conversationRef.current = conversation;
    }, [conversation]);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Custom Hooks - Extract handler functions
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const headerActions = useHeaderActions({
        chat,
        showToast,
        onClose,
        onDeleteChat
    });

    const canvasActions = useCanvasActions({
        chat,
        tabs,
        setTabs,
        activeTab,
        setActiveTab,
        showToast
    });

    const messageInputActions = useMessageInput({
        setNewMessage,
        setShowEmoji
    });

    // ✅ FIX 3: Explicit socket connection ordering with guards
    // GUARDRAIL: encryptionReady THEN isMember THEN socket.connect()
    const { connectSocket } = useSocket();
    React.useEffect(() => {
        // Step 1: Check encryption ready
        if (!encryptionReady) {
            return;
        }

        if (chat?.type === 'channel' && !isMember) {
            return;
        }

        // ✅ All checks passed - proceed with normal operation
        if (encryptionReady && (chat?.type !== 'channel' || isMember)) {
            connectSocket();
        }
    }, [connectSocket, encryptionReady, isMember, chat?.type]); // ✅ Explicit dependencies

    // ✅ PHASE 3: NO premature encryption check
    // Conversation keys are ONLY checked/generated when sending first message
    // Missing key = UNINITIALIZED state (normal for new channels)

    // Header action handlers (from custom hook)
    const handleShowThreadsView = headerActions.handleShowThreadsView;
    const handleShowMemberList = useCallback(() => {
        setActiveModal('members');
    }, []);
    const handleExitChannel = headerActions.handleExitChannel;
    const handleDeleteChannel = headerActions.handleDeleteChannel;
    const handleClearChat = headerActions.handleClearChat;
    const handleDeleteChat = headerActions.handleDeleteChat;

    // Socket event handler - use conversationRef.current to avoid stale closures
    const handleSocketEvent = useCallback((event) => {
        // Handle socket events

        switch (event.type) {
            case 'message':
            case 'new-message':
                // Normalize backend message to match expected structure
                const backendMsg = event.payload;

                if (backendMsg) {
                    // Normalize to event structure expected by ConversationStream
                    const normalizedEvent = {
                        id: backendMsg._id,
                        type: backendMsg.type || 'message',
                        payload: backendMsg.payload || {},
                        sender: backendMsg.sender,
                        createdAt: backendMsg.createdAt,
                        channelId: backendMsg.channel,
                        dmId: backendMsg.dm,
                        // ✅ quotedMessageId: keep it even as a string — MessageEvent will decrypt async
                        quotedMessageId: backendMsg.quotedMessageId || null,
                        backend: backendMsg // Keep original for reference
                    };

                    conversationRef.current.addRealtimeEvent(normalizedEvent);
                }
                break;

            case 'message-sent':
                // Handle message sent confirmation (replace optimistic message)
                const { clientTempId, message: sentMsg } = event.payload;
                if (clientTempId) {
                    conversationRef.current.updateEvent(clientTempId, {
                        id: sentMsg._id,
                        type: 'message',
                        payload: sentMsg,
                        createdAt: sentMsg.createdAt
                    });
                }
                break;

            case 'message-updated':
                // Handle message updates (reply count changes, edits, etc.)
                const { messageId, updates } = event.payload;

                if (messageId && updates) {
                    const payloadPatch = {
                        ...(updates.replyCount !== undefined && { replyCount: updates.replyCount }),
                        ...(updates.lastReplyAt !== undefined && { lastReplyAt: updates.lastReplyAt }),
                        ...(updates.text !== undefined && { text: updates.text }),
                        ...(updates.editedAt !== undefined && { editedAt: updates.editedAt }),
                        // E2EE: propagate new ciphertext if present
                        ...(updates.payload?.ciphertext && {
                            ciphertext: updates.payload.ciphertext,
                            messageIv: updates.payload.messageIv,
                            isEncrypted: true
                        })
                    };

                    conversationRef.current.updateEvent(messageId, {
                        ...(updates.replyCount !== undefined && { replyCount: updates.replyCount }),
                        ...(updates.lastReplyAt !== undefined && { lastReplyAt: updates.lastReplyAt }),
                        // ✅ Update decryptedContent so render immediately shows new text
                        ...(updates.decryptedContent !== undefined && { decryptedContent: updates.decryptedContent }),
                        ...(updates.editedAt !== undefined && { editedAt: updates.editedAt }),
                        payload: payloadPatch
                    });

                    if (updates.replyCount !== undefined) {
                        setThreadCounts(prev => ({
                            ...prev,
                            [messageId]: updates.replyCount
                        }));
                    }
                }
                break;



            case 'message-deleted':
                // Handle message deletion
                // Server sends { messageId, deletedBy, deletedByName } — does NOT include isDeleted:true
                // We must set it explicitly so enrichedMessage picks it up via event.payload?.isDeleted
                if (event.payload) {
                    if (event.payload.isLocal) {
                        conversationRef.current.removeEvent(event.payload.messageId);
                    } else {
                        conversationRef.current.updateEvent(event.payload.messageId, {
                            payload: {
                                ...event.payload,
                                isDeleted: true,
                                isDeletedUniversally: true
                            }
                        });
                    }
                }
                break;

            case 'message-hidden':
                // Handle "Delete for me" — remove the message from THIS user's view only
                if (event.payload?.messageId) {
                    conversationRef.current.removeEvent(event.payload.messageId);
                }
                break;

            case 'message-pinned':
                // Handle pin updates — server sends { messageId, pinnedBy, pinnedAt }
                if (event.payload) {
                    conversationRef.current.updateEvent(event.payload.messageId || event.payload._id, {
                        payload: {
                            ...event.payload,
                            isPinned: true
                        }
                    });
                }
                break;

            case 'message-unpinned':
                // Handle unpin — server sends { messageId }
                if (event.payload) {
                    conversationRef.current.updateEvent(event.payload.messageId || event.payload._id, {
                        payload: {
                            ...event.payload,
                            isPinned: false,
                            pinnedBy: null,
                            pinnedAt: null
                        }
                    });
                }
                break;

            case 'reaction-added':
            case 'reaction-removed':
                // Handle reactions — server sends { messageId, reactions } (full reactions array)
                if (event.payload) {
                    const reactionMsgId = event.payload.messageId;
                    const updatedReactions = event.payload.reactions;
                    if (reactionMsgId && updatedReactions !== undefined) {
                        conversationRef.current.updateEvent(reactionMsgId, {
                            payload: { reactions: updatedReactions }
                        });
                    }
                }
                break;

            case 'poll-created':
                // Handle new poll
                if (event.payload) {
                    conversationRef.current.addRealtimeEvent({
                        id: event.payload._id,
                        type: 'poll',
                        payload: event.payload,
                        createdAt: event.payload.createdAt
                    });
                }
                break;

            case 'poll-updated':
                // Handle poll vote updates
                if (event.payload) {
                    conversationRef.current.updateEvent(event.payload._id, {
                        payload: event.payload
                    });
                }
                break;

            case 'poll-removed':
                conversationRef.current.removeEvent(event.payload.pollId);
                break;

            case 'user-typing':
                // Handle typing indicator
                const { userId, isTyping } = event.payload;
                if (isTyping) {
                    setTypingUsers(prev => [...new Set([...prev, userId])]);
                    setTimeout(() => {
                        setTypingUsers(prev => prev.filter(id => id !== userId));
                    }, 3000);
                } else {
                    setTypingUsers(prev => prev.filter(id => id !== userId));
                }
                break;

            case 'member-joined':
            case 'member-left':
                // Add system event
                conversationRef.current.addRealtimeEvent({
                    id: `system_${Date.now()}`,
                    type: 'system',
                    payload: event.payload,
                    createdAt: new Date().toISOString()
                });
                break;

            case 'thread-reply':
                // Handle thread reply events - Update thread count
                const reply = event.payload.reply || event.payload.message || event.payload;
                const replyParentId = reply.parentId || event.payload.parentId || reply.replyTo;

                if (replyParentId) {
                    setThreadCounts(prev => {
                        const newCount = (prev[replyParentId] || 0) + 1;

                        // Update conversation event with new count for persistence
                        if (conversationRef.current) {
                            conversationRef.current.updateEvent(replyParentId, {
                                replyCount: newCount,
                                lastReplyAt: reply.createdAt || new Date().toISOString(),
                                payload: {
                                    replyCount: newCount,
                                    lastReplyAt: reply.createdAt || new Date().toISOString()
                                }
                            });
                        }

                        return {
                            ...prev,
                            [replyParentId]: newCount
                        };
                    });
                }
                break;

            case 'thread:created':
                // ✅ THREAD AWARENESS: Update parent message when thread is created
                const { parentMessageId, replyCount, lastReplyAt } = event.payload;
                // Thread created - update parent message with reply count

                // Update the parent message to show it has a thread
                conversationRef.current.updateEvent(parentMessageId, {
                    payload: {
                        replyCount: replyCount,
                        lastReplyAt: lastReplyAt
                    }
                });

                // Initialize threadCounts for new threads
                setThreadCounts(prev => ({
                    ...prev,
                    [parentMessageId]: replyCount || 1
                }));
                break;

            default:
                // Unhandled socket event types are silently ignored
                break;
        }
    }, []); // No dependencies needed - all state updates use functional form

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Initialize socket with event handler
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NOTE: useChatSocket is called for ALL types to satisfy React Hooks rules
    // useChatSocket automatically skips chat:join for DMs (see DM guard in useChatSocket.js)
    const socket = useChatSocket(conversationId, conversationType, handleSocketEvent);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DM-ONLY FIX: Handle DM room join (useChatSocket skips DMs)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 
    // useChatSocket emits 'chat:join' for CHANNELS/THREADS only (DMs are excluded)
    // DMs use 'join-dm' event via this dedicated effect
    // 
    // CHANNELS/THREADS: Use useChatSocket's 'chat:join' (untouched)
    // DMs: Use 'join-dm' via this dedicated effect
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    useEffect(() => {
        if (conversationType !== 'dm') return; // DM-ONLY guard - channels/threads skip
        if (!rawSocket || !conversationId) return;


        // Join DM room using DM-specific event
        rawSocket.emit('join-dm', { dmSessionId: conversationId });

        // Leave DM room on unmount
        return () => {
            if (rawSocket?.connected) {
                rawSocket.emit('leave-dm', { dmSessionId: conversationId });
            }
        };
    }, [conversationType, conversationId, rawSocket]);



    // Initialize threadCounts from loaded messages
    useEffect(() => {
        if (!conversation.events || conversation.loading) return;

        const newCounts = {};
        conversation.events.forEach(event => {
            if (event.payload?.replyCount > 0) {
                newCounts[event.id] = event.payload.replyCount;
            }
        });

        // Only update if there are new counts to add
        if (Object.keys(newCounts).length > 0) {
            setThreadCounts(prev => ({ ...prev, ...newCounts }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversation.events.length, conversation.loading]);

    // Socket listeners for tab events
    useEffect(() => {
        if (!rawSocket || chat?.type !== 'channel') return;

        const handleTabAdded = ({ tab }) => {
            setTabs(prev => {
                const exists = prev.find(t => t._id === tab._id);
                if (exists) return prev;
                return [...prev, tab];
            });
        };

        const handleTabUpdated = ({ tabId, name, content }) => {
            setTabs(prev => prev.map(t =>
                t._id === tabId ? { ...t, name, content } : t
            ));
        };

        const handleTabDeleted = ({ tabId }) => {
            setTabs(prev => prev.filter(t => t._id !== tabId));
            if (activeTab === tabId) setActiveTab('chat');
        };

        rawSocket.on('tab-added', handleTabAdded);
        rawSocket.on('tab-updated', handleTabUpdated);
        rawSocket.on('tab-deleted', handleTabDeleted);

        return () => {
            rawSocket.off('tab-added', handleTabAdded);
            rawSocket.off('tab-updated', handleTabUpdated);
            rawSocket.off('tab-deleted', handleTabDeleted);
        };
    }, [rawSocket, chat?.type, activeTab]);

    // Message input handlers (from custom hook)
    const handleMessageChange = messageInputActions.handleMessageChange;
    const handleEmojiPick = messageInputActions.handleEmojiPick;
    const handleAttach = messageInputActions.handleAttach;

    // Handle sending message from footer
    const handleSend = useCallback(async (markdown) => {
        // ✅ PHASE 3: No broken channel check - always allow sending
        // First message will trigger key generation automatically

        // Prepare message data (encryption handled in useMessageActions)
        const messageData = {
            text: markdown,
            attachments: [],
            replyTo: null,                        // thread reply — null for WhatsApp-style replies
            quotedMessageId: replyingTo?._id || null  // inline reply: stays in main feed
        };

        // Send the message (useMessageActions will encrypt it)
        const result = await actions.sendMessage(messageData);

        if (result.success) {
            // Message sent successfully

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // ✅ PHASE 3 UI FIX: Commit API response to state IMMEDIATELY
            // Do NOT depend on socket for UI rendering
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if (result.message) {
                // Capture current replyingTo before we clear it —
                // replyingTo has the DECRYPTED text already (it was visible on screen)
                const currentReplyingTo = replyingTo;

                // Always build quotedPreview from the already-decrypted replyingTo state.
                // NEVER use result.message.quotedMessageId here — that's a ciphertext object from DB.
                const quotedPreview = currentReplyingTo ? {
                    _id: result.message.quotedMessageId?._id || result.message.quotedMessageId,
                    senderName: currentReplyingTo.senderName || currentReplyingTo.sender?.username || 'Someone',
                    payload: {
                        // Use decrypted text in priority order
                        text: currentReplyingTo.text
                            || currentReplyingTo.decryptedContent
                            || currentReplyingTo.payload?.text
                            || ''
                    }
                } : null;

                const normalizedEvent = {
                    id: result.message._id,
                    type: result.message.pollId ? 'poll' : 'message',
                    payload: {
                        ...result.message,
                        replyCount: result.message.replyCount || 0,
                        reactions: result.message.reactions || [],
                        isPinned: result.message.isPinned || false,
                        attachments: result.message.attachments || [],
                        isDeleted: result.message.isDeleted || result.message.deletedAt != null,
                        clientTempId: result.tempId
                    },
                    sender: result.message.sender,
                    createdAt: result.message.createdAt,
                    parentId: result.message.parentId, // null for inline replies
                    quotedMessageId: quotedPreview     // ✅ decrypted quoted preview
                };

                // Add to conversation state (will replace optimistic message)
                await conversation.addRealtimeEvent(normalizedEvent, currentUserId);
            }

            setReplyingTo(null);
            setNewMessage('');
        } else {
            showToast(result.message || result.error || 'Failed to send message', 'error');
        }

        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actions, replyingTo, showToast]);



    // Canvas/Tab handlers (from custom hook)
    const fetchTabs = canvasActions.fetchTabs;
    const handleAddTab = canvasActions.handleAddTab;
    const handleDeleteTab = canvasActions.handleDeleteTab;
    const handleRenameTab = canvasActions.handleRenameTab;
    const handleSaveCanvas = canvasActions.handleSaveCanvas;
    const handleShareTab = canvasActions.handleShareTab;

    useEffect(() => {
        if (chat?.type === 'channel') {
            fetchTabs();
        } else {
            setTabs([]);
            setActiveTab('chat');
        }
    }, [chat, fetchTabs]);



    // Poll handler
    const handleCreatePoll = useCallback(async (pollData) => {
        try {
            const result = await actions.createPoll(pollData);
            if (result.success) {
                showToast('Poll created successfully', 'success');
                setActiveModal(null);
            } else {
                showToast(result.error || 'Failed to create poll', 'error');
            }
        } catch (err) {
            console.error('Create poll error:', err);
            showToast('Failed to create poll', 'error');
        }
    }, [actions, showToast]);

    // Handle thread open
    const handleThreadOpen = useCallback((message) => {
        setActiveThread(message);
    }, []);

    // Handle thread close
    const handleThreadClose = useCallback(() => {
        setActiveThread(null);
    }, []);

    // Enhanced actions with conversation integration
    const enhancedActions = useMemo(() => ({
        ...actions,
        sendMessage: handleSend,
        // Wrap deleteMessage: for scope='me', immediately remove from local state
        // without relying solely on socket echo (reliable fallback)
        deleteMessage: async (messageId, scope = 'everyone') => {
            const result = await actions.deleteMessage(messageId, scope);
            if (result?.success && scope === 'me') {
                conversation.removeEvent(messageId);
            }
            return result;
        },
        // Open the ForwardMessageModal; actual API call happens in handleForward
        forwardMessage: (messageId) => {
            setForwardingMessageId(messageId);
            setActiveModal('forward');
        },
        // ✅ WhatsApp-style reply: set replying context with full message object
        replyToMessage: (message) => {
            setReplyingTo(message);
        },
        // Open MessageInfoModal: fetch readBy/members from backend then show modal
        infoMessage: async (messageId) => {
            try {
                const response = await api.get(`/api/v2/messages/${messageId}/info`);
                setMessageInfoData(response.data);
                setActiveModal('message-info');
            } catch (err) {
                console.error('[ChatWindowV2] Failed to fetch message info:', err);
            }
        }
    }), [actions, handleSend]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle confirmed forward: re-encrypt the plaintext per target and post as a new message
    const handleForward = useCallback(async (targets) => {
        if (!forwardingMessageId || !targets?.length) return;
        try {
            // Find the message being forwarded in conversation state to get its decrypted text
            const sourceMsg = conversation.events?.find(
                e => (e._id || e.id) === forwardingMessageId
            );
            const plaintextToForward = sourceMsg?.decryptedContent
                || sourceMsg?.text
                || sourceMsg?.payload?.text
                || null;

            if (!plaintextToForward) {
                // Fallback to old backend-side copy if plaintext not available
                await actions.forwardMessage(forwardingMessageId, targets);
                return;
            }

            // Re-encrypt and send to each target separately with their own conversation key
            const { encryptMessageForSending } = await import('../../../services/messageEncryptionService');
            const results = await Promise.allSettled(
                targets.map(async (target) => {
                    const targetConversationId = target.id;
                    const targetType = target.type; // 'channel' | 'dm'

                    const encrypted = await encryptMessageForSending(
                        plaintextToForward,
                        targetConversationId,
                        targetType,
                        null // not a thread reply
                    );

                    if (!encrypted || encrypted.status === 'ENCRYPTION_NOT_READY') {
                        throw new Error(`Encryption not ready for ${targetType}:${targetConversationId}`);
                    }

                    // Post as a new message to the target conversation
                    if (targetType === 'channel') {
                        await api.post('/api/v2/messages/channel', {
                            channelId: targetConversationId,
                            ciphertext: encrypted.ciphertext,
                            messageIv: encrypted.messageIv,
                            isEncrypted: true,
                            attachments: [],
                            forwardedFrom: forwardingMessageId
                        });
                    } else if (targetType === 'dm') {
                        // Resolve DM session then send
                        const dmResolve = await api.get(
                            `/api/v2/messages/workspace/${workspaceId}/dm/resolve/${target.id}`
                        );
                        const dmSessionId = dmResolve.data.dmSessionId;
                        await api.post('/api/v2/messages/direct', {
                            dmSessionId,
                            workspaceId,
                            ciphertext: encrypted.ciphertext,
                            messageIv: encrypted.messageIv,
                            isEncrypted: true,
                            attachments: [],
                            forwardedFrom: forwardingMessageId
                        });
                    }
                })
            );

            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) console.warn(`[ChatWindowV2] Forward: ${succeeded} succeeded, ${failed} failed`);

        } catch (err) {
            console.error('[ChatWindowV2] Forward failed:', err);
        } finally {
            setActiveModal(null);
            setForwardingMessageId(null);
        }
    }, [forwardingMessageId, actions, conversation.events, workspaceId]);

    // Get channel members for join markers (channels only)
    const channelMembers = chat?.members || [];
    const userJoinedAt = conversationType === 'channel'
        ? chat?.members?.find(m => (m.user?._id || m.user) === currentUserId)?.joinedAt
        : null;

    return (
        <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Header
                chat={chat}
                onClose={onClose}
                connected={socket?.connected || false}
                typingUsers={typingUsers}
                onCreatePoll={() => setActiveModal('poll')}
                showSearch={showSearch}
                setShowSearch={setShowSearch}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showMenu={showMenu}
                setShowMenu={setShowMenu}
                setShowContactInfo={() => setActiveModal('contact')}
                setShowChannelManagement={(tab) => setActiveModal(tab ? `channel-${tab}` : 'channel-settings')}
                muted={muted}
                setMuted={setMuted}
                blocked={blocked}
                setBlocked={setBlocked}
                onDeleteChat={handleDeleteChat}
                onClearChat={handleClearChat}
                onExitChannel={handleExitChannel}
                onDeleteChannel={handleDeleteChannel}
                currentUserId={currentUserId}
                showToast={showToast}
                onShowThreadsView={handleShowThreadsView}
                onShowMemberList={handleShowMemberList}
            />

            {/* Canvas Tabs (channels only) */}
            {chat?.type === 'channel' && (
                <ChannelTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onAddTab={handleAddTab}
                    onDeleteTab={handleDeleteTab}
                    onRenameTab={handleRenameTab}
                    currentUserId={currentUserId}
                    isAdmin={chat?.isAdmin || false}
                />
            )}


            {/* Main Content Area - flex to fill space */}
            <CentralContentView
                // Tab routing
                activeTab={activeTab}
                tabs={tabs}

                // Membership & access
                isMember={isMember}
                isDiscoverablePublicChannel={isDiscoverablePublicChannel}
                isJoining={isJoining}
                canInteract={canInteract}

                // Chat/conversation props
                chat={chat}
                conversation={conversation}
                enhancedActions={enhancedActions}
                conversationType={conversationType}
                channelMembers={channelMembers}
                userJoinedAt={userJoinedAt}
                currentUserId={currentUserId}

                // Thread state
                threadCounts={threadCounts}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                activeThread={activeThread}
                onThreadOpen={handleThreadOpen}
                onThreadClose={handleThreadClose}

                // Reply callback
                onReply={(message) => setReplyingTo(message)}

                // Message input
                newMessage={newMessage}
                onMessageChange={handleMessageChange}
                onSend={handleSend}
                onAttach={handleAttach}
                showAttach={showAttach}
                setShowAttach={setShowAttach}
                showEmoji={showEmoji}
                setShowEmoji={setShowEmoji}
                onPickEmoji={handleEmojiPick}
                recording={recording}
                setRecording={setRecording}
                muted={muted}
                setNewMessage={setNewMessage}

                // Channel join handlers
                onJoinChannel={handleJoinChannel}
                onIgnore={onClose}

                // Socket
                rawSocket={rawSocket}
                socket={socket}

                // Canvas/dashboard handlers
                dashboardView={dashboardView}
                dashboardSearch={dashboardSearch}
                onDashboardViewChange={setDashboardView}
                onDashboardSearchChange={setDashboardSearch}
                onAddTab={handleAddTab}
                onSaveCanvas={handleSaveCanvas}
                onDeleteTab={handleDeleteTab}
                onRenameTab={handleRenameTab}
                onShareTab={handleShareTab}
            />

            {/* Error Display */}
            <ErrorDisplay error={conversation.error} />

            {/* Consolidated Modal Renderer */}
            <ModalRenderer
                activeModal={activeModal}
                onClose={() => { setActiveModal(null); setForwardingMessageId(null); }}
                modalProps={{
                    // Poll creation props
                    onCreate: handleCreatePoll,
                    channelId: chat?.id,

                    // Member list props
                    members: chat?.members || [],
                    channelName: chat?.name,
                    currentUserId,

                    // Contact info props
                    contact: chat,

                    // Channel management props
                    channel: chat,
                    workspaceId,
                    initialTab: activeModal?.startsWith('channel-') ? activeModal.replace('channel-', '') : 'settings',

                    // Forward message props
                    currentChatId: conversationId,
                    currentChatType: conversationType,
                    onForward: handleForward,

                    // Message info props
                    messageInfoData,
                }}
            />
        </div>
    );
}


export default ChatWindowV2;

