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

// Phase 7.3 — Poll Modal
import CreatePollModal from './modals/CreatePollModal.jsx';
// Phase 7.4 — Workspace-scoped Contact Picker
import ContactPickerModal from './modals/ContactPickerModal.jsx';
// Phase 7.6 — Meeting Scheduler
import ScheduleMeetingModal from './modals/ScheduleMeetingModal.jsx';

// Custom hooks
import useHeaderActions from './hooks/useHeaderActions.js';
import useCanvasActions from './hooks/useCanvasActions.js';
import useMessageInput from './hooks/useMessageInput.js';
// Phase 7.5 — Link preview hook
import { useLinkPreview } from './hooks/useLinkPreview.js';
// Phase 7.7 — Huddle
import { useHuddle } from './hooks/useHuddle.js';
import HuddleOverlay from './huddle/HuddleOverlay.jsx';

import './chatWindow.css';

/**
 * Unified ChatWindow - handles channels, DMs, and broadcasts
 * @param {object} chat - Conversation object { id, type, name, ... }
 * @param {function} onClose - Close callback
 * @param {array} contacts - All contacts (for sharing)
 * @param {function} onDeleteChat - Delete chat callback
 * @param {string} workspaceId - Workspace ID (required for DMs)
 */
function ChatWindowV2({ chat, onClose, contacts = [], onDeleteChat, workspaceId, onChatUpdate }) {
    const { user, encryptionReady } = useAuth();
    const { socket: rawSocket } = useSocket();
    const currentUserId = user?.sub || user?._id;
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { refreshContacts } = useContacts();

    // Phase 7.7 — Huddle (only active for channels)
    const huddle = useHuddle({
        channelId: chat?.type === 'channel' ? chat?.id : null,
        currentUser: user,
        socket: rawSocket,
    });
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

            // Refresh sidebar channel list
            if (activeWorkspace?.id) await refreshContacts(activeWorkspace.id);

            // Fetch full channel details with isMember:true and update parent
            try {
                const res = await api.get(`/api/channels/${chat.id}/details`);
                const channelData = res.data.channel || res.data;
                if (channelData && onChatUpdate) {
                    onChatUpdate({
                        ...chat,
                        id: channelData._id || channelData.id,
                        name: `#${channelData.name}`,
                        isPrivate: channelData.isPrivate,
                        isDiscoverable: channelData.isDiscoverable,
                        members: channelData.members || [],
                        createdBy: channelData.createdBy,
                        createdAt: channelData.createdAt,
                        creatorName: channelData.creatorName,
                        description: channelData.description,
                        admins: channelData.admins || [],
                        isMember: true,
                    });
                }
            } catch {
                // If details fetch fails, force navigate to reload
                navigate(`/workspace/${activeWorkspace?.id}/channel/${chat.id}`);
            }
        } catch (err) {
            console.error('Join channel error:', err);
            showToast(err.response?.data?.message || 'Failed to join channel', 'error');
        } finally {
            setIsJoining(false);
        }
    }, [chat, showToast, navigate, refreshContacts, activeWorkspace, onChatUpdate]);

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
    // Phase 7.3 — Poll modal
    const [showPollModal, setShowPollModal] = useState(false);
    // Phase 7.4 — Contact picker modal
    const [showContactModal, setShowContactModal] = useState(false);
    // Phase 7.6 — Meeting scheduler modal
    const [showMeetingModal, setShowMeetingModal] = useState(false);

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

    // Threads-only filter mode: show only messages with replies in the chat stream
    const [showThreadsOnly, setShowThreadsOnly] = useState(false);

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
    const handleShowThreadsView = useCallback(() => {
        setShowThreadsOnly(prev => !prev);
    }, []);
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
                    const SOCKET_ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
                    const normalizedEvent = {
                        id: backendMsg._id,
                        // IMPORTANT: use msg.type directly (handles 'poll', 'system', 'image', etc)
                        type: backendMsg.type || 'message',
                        // payload: for E2EE text messages this is the Mongoose E2EE subdoc
                        // (backendMsg.payload = {ciphertext, messageIv, isEncrypted}).
                        // For all other types, we want the full backendMsg so nested field
                        // lookups (e.g. event.payload?.attachments) resolve correctly.
                        payload: backendMsg.payload?.ciphertext
                            ? backendMsg.payload   // real E2EE text message — keep subdoc
                            : backendMsg,          // everything else — use full msg object
                        sender: backendMsg.sender,
                        createdAt: backendMsg.createdAt,
                        channelId: backendMsg.channel,
                        dmId: backendMsg.dm,
                        quotedMessageId: backendMsg.quotedMessageId || null,
                        // Hoist E2EE fields to top-level so MessageEvent.jsx decryption works
                        isEncrypted: backendMsg.payload?.isEncrypted || false,
                        ciphertext: backendMsg.payload?.ciphertext,
                        messageIv: backendMsg.payload?.messageIv,
                        // Hoist attachments to top-level so MessageEvent.jsx rawAttachments resolves
                        // via: event.payload?.payload?.attachments || event.payload?.attachments || event.attachments
                        attachments: backendMsg.attachments || [],
                        // Convenience alias: attachment-type messages always have exactly one entry
                        ...(SOCKET_ATTACHMENT_TYPES.includes(backendMsg.type) && {
                            attachment: backendMsg.attachments?.[0] || null,
                        }),
                        // Hoist system event fields so SystemEvent.jsx finds them at top level
                        ...(backendMsg.type === 'system' && {
                            systemEvent: backendMsg.systemEvent,
                            systemData: backendMsg.systemData,
                            text: backendMsg.text,
                        }),
                        // Hoist poll data so PollEvent.jsx finds it via event.poll
                        ...(backendMsg.type === 'poll' && {
                            poll: backendMsg.poll,
                        }),
                        // Hoist contact data so MessageEvent/ChannelMessageItem finds it
                        ...(backendMsg.type === 'contact' && {
                            contact: backendMsg.contact,
                        }),
                        // Hoist meeting data so MeetingMessage renders correctly
                        ...(backendMsg.type === 'meeting' && {
                            meeting: backendMsg.meeting,
                        }),
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

            case 'messages-cleared':
                // Server emits { channelId, clearedBy, count }
                // Wipe the local conversation stream and show a system pill
                {
                    const clearPill = {
                        id: `system_cleared_${Date.now()}`,
                        type: 'system',
                        systemEvent: 'messages_cleared',
                        systemData: {
                            userId: event.payload?.clearedBy,
                            userName: event.payload?.clearedByName || '',
                        },
                        createdAt: new Date().toISOString(),
                        payload: {}
                    };
                    conversationRef.current.clearEvents(clearPill);
                }
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
                // Legacy socket path: add a system pill for the member joining
                conversationRef.current.addRealtimeEvent({
                    id: `system_${Date.now()}`,
                    type: 'system',
                    systemEvent: 'member_joined',
                    systemData: {
                        userId: event.payload?.userId,
                        userName: event.payload?.userName || event.payload?.username,
                        channelName: event.payload?.channelName,
                    },
                    createdAt: new Date().toISOString(),
                    payload: {}
                });
                break;

            case 'member-left':
                // Legacy socket path: add a system pill for the member leaving
                conversationRef.current.addRealtimeEvent({
                    id: `system_${Date.now()}`,
                    type: 'system',
                    systemEvent: 'member_left',
                    systemData: {
                        userId: event.payload?.userId,
                        userName: event.payload?.userName || event.payload?.username,
                        channelName: event.payload?.channelName,
                    },
                    createdAt: new Date().toISOString(),
                    payload: {}
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

                // Update top-level replyCount AND payload for consistency
                conversationRef.current.updateEvent(parentMessageId, {
                    replyCount: replyCount || 1,   // ← top-level (used by filter)
                    lastReplyAt: lastReplyAt,
                    payload: {
                        replyCount: replyCount || 1,
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
            // replyCount is a top-level field on events (set in useConversation)
            const count = event.replyCount ?? event.payload?.replyCount ?? 0;
            if (count > 0) {
                newCounts[event.id] = count;
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

        const handleTabUpdated = ({ tabId, name, content, emoji, coverColor, wordCount, lastEditedBy, lastEditedAt }) => {
            setTabs(prev => prev.map(t =>
                t._id === tabId ? {
                    ...t,
                    ...(name !== undefined && { name }),
                    ...(content !== undefined && { content }),
                    ...(emoji !== undefined && { emoji }),
                    ...(coverColor !== undefined && { coverColor }),
                    ...(wordCount !== undefined && { wordCount }),
                    ...(lastEditedBy !== undefined && { lastEditedBy }),
                    ...(lastEditedAt !== undefined && { lastEditedAt }),
                } : t
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

    // Phase 7.5 — Link preview: detect URL in typed text, debounce 600ms
    const { preview: linkPreview, loading: linkPreviewLoading, clearPreview: clearLinkPreview } = useLinkPreview(newMessage);

    // Handle sending message from footer
    const handleSend = useCallback(async (markdown) => {
        // ✅ PHASE 3: No broken channel check - always allow sending
        // First message will trigger key generation automatically

        // Prepare message data (encryption handled in useMessageActions)
        const messageData = {
            text: markdown,
            attachments: [],
            replyTo: null,
            quotedMessageId: replyingTo?._id || null,
            // Phase 7.5 — attach detected link preview
            linkPreview: linkPreview || null,
        };

        // Send the message (useMessageActions will encrypt it)
        const result = await actions.sendMessage(messageData);
        // Clear link preview banner
        clearLinkPreview();

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

                const msgType = result.message.type === 'poll' ? 'poll'
                    : result.message.pollId ? 'poll'
                        : 'message';

                const normalizedEvent = {
                    id: result.message._id,
                    type: msgType,
                    payload: {
                        ...result.message,
                        replyCount: result.message.replyCount || 0,
                        reactions: result.message.reactions || [],
                        isPinned: result.message.isPinned || false,
                        attachments: result.message.attachments || [],
                        isDeleted: result.message.isDeleted || result.message.deletedAt != null,
                        clientTempId: result.tempId
                    },
                    // Hoist poll data so PollEvent.jsx can find it via event.poll
                    ...(msgType === 'poll' && { poll: result.message.poll }),
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


    // Phase 7.1 — Send an uploaded attachment as a message
    const handleSendAttachment = useCallback(async (attachment) => {
        // attachment = { url, name, size, sizeFormatted, mimeType, type, gcsPath }
        try {
            const messageData = {
                text: null,
                attachment,
                type: attachment.type,
                attachments: [],
                replyTo: null,
                quotedMessageId: null,
            };
            const result = await actions.sendMessage(messageData);
            if (result.success && result.message) {
                const normalizedEvent = {
                    id: result.message._id,
                    type: attachment.type || 'file',
                    payload: {
                        ...result.message,
                        attachment,
                        type: attachment.type,
                        replyCount: 0,
                        reactions: [],
                        isPinned: false,
                        isDeleted: false,
                    },
                    sender: result.message.sender,
                    createdAt: result.message.createdAt,
                };
                await conversation.addRealtimeEvent(normalizedEvent, currentUserId);
            } else if (!result.success) {
                showToast(result.error || 'Failed to send attachment', 'error');
            }
        } catch (err) {
            console.error('[ChatWindowV2] handleSendAttachment error:', err);
            showToast('Failed to send attachment', 'error');
        }
        setShowAttach(false);
    }, [actions, conversation, currentUserId, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

    // Phase 7.4 — Send a workspace-member contact card as a message
    const handleSendContact = useCallback(async (contact) => {
        // contact = { name, email, phone, avatar }
        try {
            const messageData = {
                type: 'contact',
                contact,
                text: null,
            };
            const result = await actions.sendMessage(messageData);
            if (result.success && result.message) {
                const msg = result.message;
                const normalizedEvent = {
                    id: msg._id,
                    _id: msg._id,
                    type: 'contact',
                    contact: msg.contact || contact,
                    sender: msg.sender,
                    createdAt: msg.createdAt,
                    payload: { contact: msg.contact || contact, sender: msg.sender },
                };
                await conversation.addRealtimeEvent(normalizedEvent, currentUserId);
            }
        } catch (err) {
            console.error('[ChatWindowV2] handleSendContact error:', err);
            showToast('Failed to share contact', 'error');
        }
        setShowContactModal(false);
        setShowAttach(false);
    }, [actions, conversation, currentUserId, showToast]);

    // Phase 7.6 — Send a meeting message
    const handleSendMeeting = useCallback(async (meetingData) => {
        // meetingData = { title, startTime, duration, meetingLink, participants }
        try {
            const messageData = {
                type: 'meeting',
                meeting: meetingData,
                text: null,
            };
            const result = await actions.sendMessage(messageData);
            if (result.success && result.message) {
                const msg = result.message;
                const normalizedEvent = {
                    id: msg._id,
                    _id: msg._id,
                    type: 'meeting',
                    meeting: msg.meeting || meetingData,
                    sender: msg.sender,
                    createdAt: msg.createdAt,
                    payload: { meeting: msg.meeting || meetingData, sender: msg.sender },
                };
                await conversation.addRealtimeEvent(normalizedEvent, currentUserId);
            }
        } catch (err) {
            console.error('[ChatWindowV2] handleSendMeeting error:', err);
            showToast('Failed to schedule meeting', 'error');
        }
        setShowMeetingModal(false);
        setShowAttach(false);
    }, [actions, conversation, currentUserId, showToast]);

    // Phase 7.4 — Override handleAttach so 'contact' type opens the picker
    const handleCreatePoll = useCallback(async (pollData) => {
        if (!conversationId || conversationType !== 'channel') return;
        try {
            const { data } = await api.post('/api/v2/messages/poll', {
                channelId: conversationId,
                poll: pollData,
            });
            const msg = data.message;
            if (msg) {
                const normalizedEvent = {
                    id: msg._id,
                    _id: msg._id,
                    type: 'poll',
                    // Hoist poll data so PollEvent can find it via event.poll
                    poll: msg.poll,
                    sender: msg.sender,
                    createdAt: msg.createdAt,
                    payload: { poll: msg.poll, sender: msg.sender },
                };
                await conversation.addRealtimeEvent(normalizedEvent, currentUserId);
            }
            setShowPollModal(false);
            setActiveModal(null);
        } catch (err) {
            console.error('[ChatWindowV2] handleCreatePoll error:', err);
            showToast(err?.response?.data?.message || 'Failed to create poll', 'error');
        }
    }, [conversationId, conversationType, conversation, currentUserId, showToast]);

    // Phase 7.3 — Real-time poll vote updates
    useEffect(() => {
        if (!rawSocket) return;
        const handler = ({ messageId, poll }) => {
            // Use conversationRef (not stale conversation closure)
            // Cast messageId to string — backend sends ObjectId, events stored with string ids
            const idStr = messageId?.toString?.() || String(messageId);
            conversationRef.current?.updateEvent(idStr, { poll });
        };
        rawSocket.on('poll:vote_updated', handler);
        return () => rawSocket.off('poll:vote_updated', handler);
    }, [rawSocket]); // no `conversation` dep — we use the ref

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
        infoMessage: async (messageId, decryptedText) => {
            try {
                const response = await api.get(`/api/v2/messages/${messageId}/info`);
                // Override text with client-side decrypted content (E2EE messages have null text in DB)
                const data = response.data;
                if (decryptedText && data.message) {
                    data.message.text = decryptedText;
                }
                setMessageInfoData(data);
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
                isThreadsOnly={showThreadsOnly}
                onShowMemberList={handleShowMemberList}
                // Phase 7.7 — Huddle: toggle start/leave
                onStartHuddle={chat?.type === 'channel'
                    ? (huddle.active ? huddle.leaveHuddle : huddle.startHuddle)
                    : undefined}
                huddleActive={huddle.active}
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
                onAttach={(type) => {
                    if (type === 'contact') {
                        setShowContactModal(true);
                        setShowAttach(false);
                    } else if (type === 'meeting') {
                        setShowMeetingModal(true);
                        setShowAttach(false);
                    } else {
                        handleAttach(type);
                    }
                }}
                onSendAttachment={handleSendAttachment}
                onCreatePoll={() => setShowPollModal(true)}
                // Phase 7.5 — link preview
                linkPreview={linkPreview}
                linkPreviewLoading={linkPreviewLoading}
                onDismissPreview={clearLinkPreview}
                conversationId={conversationId}
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
                workspaceId={workspaceId}
                showThreadsOnly={showThreadsOnly}

                // Canvas/dashboard handlers
                dashboardView={dashboardView}
                dashboardSearch={dashboardSearch}
                onDashboardViewChange={setDashboardView}
                onDashboardSearchChange={setDashboardSearch}
                onAddTab={(name, coverColor) => handleAddTab(name, coverColor)}
                onSaveCanvas={handleSaveCanvas}
                onDeleteTab={handleDeleteTab}
                onRenameTab={handleRenameTab}
                onShareTab={handleShareTab}
                onOpenCanvas={setActiveTab}
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
            {/* Phase 7.3 — Poll Creation Modal */}
            <CreatePollModal
                isOpen={showPollModal}
                onClose={() => setShowPollModal(false)}
                onCreatePoll={handleCreatePoll}
                channelName={chat?.name || ''}
            />
            {/* Phase 7.4 — Workspace Contact Picker */}
            <ContactPickerModal
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                onSelect={handleSendContact}
                workspaceId={workspaceId || activeWorkspace?.id}
            />
            {/* Phase 7.6 — Meeting Scheduler */}
            {showMeetingModal && (
                <ScheduleMeetingModal
                    conversationId={conversationId}
                    conversationType={conversationType}
                    onSchedule={handleSendMeeting}
                    onClose={() => setShowMeetingModal(false)}
                />
            )}
            {/* Phase 7.7 — Huddle overlay (fixed bottom-left, channel only) */}
            {chat?.type === 'channel' && (
                <HuddleOverlay
                    active={huddle.active}
                    participants={huddle.participants}
                    muted={huddle.muted}
                    channelName={chat?.name || ''}
                    onToggleMute={huddle.toggleMute}
                    onLeave={huddle.leaveHuddle}
                />
            )}
            {/* Huddle join announcement banner */}
            {chat?.type === 'channel' && huddle.huddleAnnouncement && !huddle.active && (
                <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 animate-fade-in">
                    <span className="text-green-400 animate-pulse">●</span>
                    <div className="text-sm">
                        <span className="font-semibold">{huddle.huddleAnnouncement.startedBy?.username || 'Someone'}</span>
                        {' '}started a huddle
                    </div>
                    <button
                        onClick={() => { huddle.joinHuddle(huddle.huddleAnnouncement.huddleId); huddle.dismissAnnouncement(); }}
                        className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >Join</button>
                    <button
                        onClick={huddle.dismissAnnouncement}
                        className="text-xs text-white/50 hover:text-white px-2 py-1 rounded transition-colors"
                    >✕</button>
                </div>
            )}
        </div>
    );
}


export default ChatWindowV2;

