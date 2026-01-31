// client/src/components/messagesComp/chatWindowComp/ChatWindowV2.jsx
// Unified Chat Interface - Canonical Implementation

// 🔒 CANONICAL CHAT WINDOW
// This file owns ALL chat orchestration logic.
// UI-only components may be extracted,
// but business logic MUST remain here unless explicitly migrated.


import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useChatSocket, useConversation, useMessageActions } from '../../../hooks';
import { ConversationStream } from '../events';
import Header from './header/header.jsx';
import FooterInput from './footer/footerInput.jsx';
import ThreadPanel from './ThreadPanel.jsx';
import ChannelTabs from './tabs/ChannelTabs.jsx';
import CanvasTab from './tabs/CanvasTab.jsx';
import TasksTab from './tabs/TasksTab.jsx';
import ThreadsTab from './tabs/ThreadsTab.jsx';
import PollCreationModal from './modals/PollCreationModal.jsx';
import MemberListModal from './modals/MemberListModal.jsx';
import ContactInfoModal from './modals/contactInfoModal.jsx';
import ChannelManagementModal from '../ChannelManagementModal.jsx';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import api from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { FileText, Layout, Plus, Trash2, MoreVertical, Search, Grid, List as ListIcon, Edit2, Share2, Lock } from 'lucide-react';
import CanvasCard from './CanvasCard.jsx';
import ChannelJoinPrompt from './states/ChannelJoinPrompt.jsx';



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
    const { user, encryptionReady } = useAuth(); // ✅ FIX 3: Get encryption ready flag
    const { socket: rawSocket } = useSocket(); // Get raw socket for ThreadPanel
    const currentUserId = user?.sub || user?._id;
    const { showToast } = useToast();

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

    // Join handler
    const handleJoinChannel = useCallback(async () => {
        if (!chat || !chat.id) return;

        setIsJoining(true);
        try {
            await api.post(`/api/channels/${chat.id}/join-discoverable`);
            showToast(`Joined ${chat.name} successfully!`, 'success');

            // Refresh the page or trigger a re-fetch
            window.location.reload();
        } catch (err) {
            console.error('Join channel error:', err);
            showToast(err.response?.data?.message || 'Failed to join channel', 'error');
        } finally {
            setIsJoining(false);
        }
    }, [chat, showToast]);

    // Conversation state
    const [activeThread, setActiveThread] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [recording, setRecording] = useState(false);

    // Canvas/Tabs state
    const [activeTab, setActiveTab] = useState('chat');
    const [tabs, setTabs] = useState([]);

    // Poll state
    const [showPollModal, setShowPollModal] = useState(false);

    // Header UI state
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [showChannelManagement, setShowChannelManagement] = useState(null);
    const [muted, setMuted] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [showMemberList, setShowMemberList] = useState(false);

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

    // Header action handlers
    const handleShowThreadsView = useCallback(() => {
        showToast('Threads view coming soon!', 'info');
    }, [showToast]);

    const handleShowMemberList = useCallback(() => {
        setShowMemberList(true);
    }, []);

    const handleExitChannel = useCallback(async () => {
        if (!window.confirm('Are you sure you want to exit this channel?')) return;
        try {
            await api.post(`/api/channels/${chat.id}/exit`);
            showToast('Exited channel successfully', 'success');
            onClose?.();
        } catch (err) {
            console.error('Exit channel error:', err);
            showToast(err.response?.data?.message || 'Failed to exit channel', 'error');
        }
    }, [chat, onClose, showToast]);

    const handleDeleteChannel = useCallback(async () => {
        if (!window.confirm('Are you sure you want to permanently delete this channel? This action cannot be undone.')) return;
        try {
            await api.delete(`/api/channels/${chat.id}`);
            showToast('Channel deleted successfully', 'success');
            onClose?.();
        } catch (err) {
            console.error('Delete channel error:', err);
            showToast(err.response?.data?.message || 'Failed to delete channel', 'error');
        }
    }, [chat, onClose, showToast]);

    const handleClearChat = useCallback(async () => {
        try {
            await api.post(`/api/dm/${chat.id}/clear`);
            showToast('Chat cleared successfully', 'success');
        } catch (err) {
            console.error('Clear chat error:', err);
            showToast('Failed to clear chat', 'error');
        }
    }, [chat, showToast]);

    const handleDeleteChat = useCallback(() => {
        if (onDeleteChat) {
            onDeleteChat();
        } else {
            onClose?.();
        }
    }, [onDeleteChat, onClose]);

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
                // Handle message updates (e.g., reply count changed)
                const { messageId, updates } = event.payload;
                console.log('[CHATWINDOW][UPDATE] Received message-updated:', { messageId, updates });

                if (messageId && updates) {
                    // ✅ Update the message's replyCount directly in the event object
                    conversationRef.current.updateEvent(messageId, {
                        replyCount: updates.replyCount,
                        lastReplyAt: updates.lastReplyAt,
                        payload: {
                            replyCount: updates.replyCount,
                            lastReplyAt: updates.lastReplyAt
                        }
                    });

                    // Also update threadCounts state for persistence
                    if (updates.replyCount !== undefined) {
                        setThreadCounts(prev => ({
                            ...prev,
                            [messageId]: updates.replyCount
                        }));
                        console.log('[CHATWINDOW][UPDATE] Updated thread count for', messageId, 'to', updates.replyCount);
                    }
                }
                break;


            case 'message-deleted':
                // Handle message deletion
                if (event.payload) {
                    if (event.payload.isLocal) {
                        conversationRef.current.removeEvent(event.payload.messageId);
                    } else {
                        conversationRef.current.updateEvent(event.payload.messageId, {
                            payload: event.payload
                        });
                    }
                }
                break;

            case 'message-pinned':
            case 'message-unpinned':
                // Handle pin updates
                if (event.payload) {
                    conversationRef.current.updateEvent(event.payload.messageId || event.payload._id, {
                        payload: event.payload
                    });
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
                // Handle thread reply events - this is primarily for ThreadPanel
                // The count update is handled by 'message-updated' event which has the authoritative count
                console.log('[CHATWINDOW][THREAD-REPLY] Received thread-reply, count will be updated by message-updated event');
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
    }, [currentUserId]); // Include currentUserId in dependencies

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

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔷 [DM-ONLY] Emitting join-dm event (bypassing chat:join)');
        console.log('🔷 [DM-ONLY] DM Session ID:', conversationId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Join DM room using DM-specific event
        rawSocket.emit('join-dm', { dmSessionId: conversationId });

        // Leave DM room on unmount
        return () => {
            if (rawSocket?.connected) {
                console.log('🔷 [DM-ONLY] Leaving DM room:', conversationId);
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

    // Handle message input change
    const handleMessageChange = useCallback((e) => {
        setNewMessage(e.target.value);
    }, []);

    // Handle sending message from footer
    const handleSend = useCallback(async (markdown) => {
        // ✅ PHASE 3: No broken channel check - always allow sending
        // First message will trigger key generation automatically

        // Prepare message data (encryption handled in useMessageActions)
        const messageData = {
            text: markdown,
            attachments: [],
            replyTo: replyingTo?._id
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
                    parentId: result.message.threadParent
                };

                // Add to conversation state (will replace optimistic message)
                await conversation.addRealtimeEvent(normalizedEvent, currentUserId);

                // Message committed to conversation state
            }

            setReplyingTo(null);
            setNewMessage('');
        } else {
            showToast(result.message || result.error || 'Failed to send message', 'error');
        }

        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actions, replyingTo, showToast]);

    // Handle emoji pick
    const handleEmojiPick = useCallback((emoji) => {
        setNewMessage(prev => prev + emoji);
        setShowEmoji(false);
    }, []);

    // Handle attachments
    const handleAttach = useCallback((file) => {
        // TODO: Implement file upload
    }, []);

    // Canvas/Tabs handlers
    const fetchTabs = useCallback(async () => {
        if (!chat || chat.type !== 'channel') return;
        try {
            const res = await api.get(`/api/channels/${chat.id}/tabs`);
            setTabs(res.data.tabs || []);
        } catch (err) {
            console.error('Fetch tabs error:', err);
        }
    }, [chat]);

    useEffect(() => {
        if (chat?.type === 'channel') {
            fetchTabs();
        } else {
            setTabs([]);
            setActiveTab('chat');
        }
    }, [chat, fetchTabs]);

    const handleAddTab = useCallback(async (name) => {
        if (tabs.length >= 5) {
            showToast('Maximum 5 canvases allowed per channel', 'error');
            return;
        }

        try {
            const tempId = 'temp-' + Date.now();
            const newTab = { _id: tempId, name, type: 'canvas', content: '' };
            setTabs(prev => [...prev, newTab]);
            setActiveTab(tempId);

            const res = await api.post(`/api/channels/${chat.id}/tabs`, { name, type: 'canvas' });

            setTabs(prev => prev.filter(t => t._id !== tempId));

            // Add the real tab from response to state if it's not already there (socket might have added it)
            if (res.data.tab) {
                setTabs(prev => {
                    if (prev.find(t => t._id === res.data.tab._id)) return prev;
                    return [...prev, res.data.tab];
                });
                setActiveTab(res.data.tab._id);
            }

            showToast(`Canvas "${name}" created`, 'success');
        } catch (err) {
            console.error('Add tab error:', err);
            showToast(err.response?.data?.message || 'Failed to create tab', 'error');
            setTabs(prev => prev.filter(t => !t._id.startsWith('temp-')));
            setActiveTab('chat');
        }
    }, [tabs.length, chat, showToast]);

    const handleDeleteTab = useCallback(async (tabId) => {
        try {
            await api.delete(`/api/channels/${chat.id}/tabs/${tabId}`);
            setTabs(prev => prev.filter(t => t._id !== tabId));
            if (activeTab === tabId) setActiveTab('chat');
            showToast('Canvas deleted successfully', 'success');
        } catch (err) {
            console.error('Delete tab error:', err);
            showToast('Failed to delete tab', 'error');
        }
    }, [chat, activeTab, showToast]);

    const handleRenameTab = useCallback(async (tabId, name) => {
        try {
            await api.put(`/api/channels/${chat.id}/tabs/${tabId}`, { name });
            setTabs(prev => prev.map(t => t._id === tabId ? { ...t, name } : t));
        } catch (err) {
            console.error('Rename tab error:', err);
            showToast('Failed to rename tab', 'error');
        }
    }, [chat, showToast]);

    const handleSaveCanvas = useCallback(async (tabId, data) => {
        try {
            await api.put(`/api/channels/${chat.id}/tabs/${tabId}`, data);
        } catch (err) {
            console.error('Save canvas error:', err);
        }
    }, [chat]);

    const handleShareTab = useCallback((tabId) => {
        const url = `${window.location.origin}/canvas/${tabId}`;
        navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard', 'success');
    }, [showToast]);

    // Poll handler
    const handleCreatePoll = useCallback(async (pollData) => {
        try {
            const result = await actions.createPoll(pollData);
            if (result.success) {
                showToast('Poll created successfully', 'success');
                setShowPollModal(false);
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
        sendMessage: handleSend
    }), [actions, handleSend]);

    // Get channel members for join markers (channels only)
    const channelMembers = chat?.members || [];
    const userJoinedAt = conversationType === 'channel'
        ? chat?.members?.find(m => (m.user?._id || m.user) === currentUserId)?.joinedAt
        : null;

    return (
        <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Header
                chat={chat}
                onClose={onClose}
                connected={socket?.connected || false}
                typingUsers={typingUsers}
                onCreatePoll={() => setShowPollModal(true)}
                showSearch={showSearch}
                setShowSearch={setShowSearch}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showMenu={showMenu}
                setShowMenu={setShowMenu}
                setShowContactInfo={setShowContactInfo}
                setShowChannelManagement={setShowChannelManagement}
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
            <div className="chat-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, backgroundColor: 'var(--bg-primary)' }}>
                {/* Access-gate UI: non-member, discoverable public channel */}
                {!isMember && isDiscoverablePublicChannel ? (
                    <ChannelJoinPrompt
                        chatName={chat?.name}
                        isJoining={isJoining}
                        onJoinChannel={handleJoinChannel}
                        onIgnore={onClose}
                    />
                ) : activeTab === 'chat' ? (
                    <>
                        {/* Main Stream - flex column */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                            {/* Conversation Stream - scrollable */}
                            <ConversationStream
                                events={conversation.events}
                                systemEvents={chat.systemEvents || []}
                                creatorName={chat.creatorName}
                                loading={conversation.loading}
                                onLoadMore={conversation.loadMore}
                                hasMore={conversation.hasMore}
                                actions={enhancedActions}
                                conversationType={conversationType}
                                channelMembers={channelMembers}
                                userJoinedAt={userJoinedAt}
                                onThreadOpen={handleThreadOpen}
                                threadCounts={threadCounts}
                                replyingTo={replyingTo}
                                onCancelReply={() => setReplyingTo(null)}
                                currentUserId={currentUserId}
                            />

                            {/* Footer - fixed at bottom */}
                            <FooterInput
                                newMessage={newMessage}
                                onChange={handleMessageChange}
                                onSend={handleSend}
                                onAttach={handleAttach}
                                showAttach={showAttach}
                                setShowAttach={setShowAttach}
                                showEmoji={showEmoji}
                                setShowEmoji={setShowEmoji}
                                onPickEmoji={handleEmojiPick}
                                recording={recording}
                                setRecording={setRecording}
                                blocked={muted}
                                setNewMessage={setNewMessage}
                                disabled={!canInteract} // ✅ FIX 3: SOFT GATE - disable input until ready
                            />
                        </div>
                    </>
                ) : activeTab === 'tasks' ? (
                    // Tasks Tab
                    <TasksTab
                        channelId={chat.id}
                        channelName={chat.name}
                        currentUserId={currentUserId}
                        socket={rawSocket}
                    />
                ) : activeTab === 'threads' ? (
                    // Threads Tab
                    <ThreadsTab
                        channelId={chat.id}
                        currentUserId={currentUserId}
                        socket={rawSocket}
                    />
                ) : activeTab === 'canvas' ? (
                    // Default Canvas Tab (Main Canvas Dashboard)
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto p-8">
                        <div className="max-w-5xl mx-auto w-full">
                            {/* Dashboard Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">Canvas Dashboard</h1>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                                        Manage your team's whiteboards and documents
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Search size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search canvases..."
                                            value={dashboardSearch}
                                            onChange={(e) => setDashboardSearch(e.target.value)}
                                            className="pl-10 pr-4 py-2 w-48 md:w-64 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                                        />
                                    </div>
                                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                    <button
                                        onClick={() => setDashboardView('grid')}
                                        className={`p - 2 rounded - lg transition - all ${dashboardView === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'} `}
                                        title="Grid View"
                                    >
                                        <Grid size={18} />
                                    </button>
                                    <button
                                        onClick={() => setDashboardView('list')}
                                        className={`p - 2 rounded - lg transition - all ${dashboardView === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'} `}
                                        title="List View"
                                    >
                                        <ListIcon size={18} />
                                    </button>
                                </div>
                            </div>

                            {tabs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 min-h-[500px] shadow-sm">
                                    <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-full mb-8 animate-pulse">
                                        <Layout size={64} className="text-blue-500/80" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">No canvases yet</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-10 text-lg">
                                        Create a blank canvas to brainstorm, sketch, or plan projects with your team.
                                    </p>
                                    <button
                                        onClick={() => handleAddTab(`Untitled ${tabs.length + 1} `)}
                                        className="group flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold transition-all shadow-xl hover:shadow-blue-600/30 hover:-translate-y-1"
                                    >
                                        <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
                                        Create New Canvas
                                    </button>
                                </div>
                            ) : (
                                <div className={dashboardView === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-3"}>

                                    {/* Create New Row (List Only) */}
                                    {dashboardView === 'list' && (
                                        <button
                                            onClick={() => handleAddTab(`Untitled ${tabs.length + 1} `)}
                                            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 text-gray-500 hover:text-blue-600 transition-colors group"
                                        >
                                            <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20">
                                                <Plus size={20} />
                                            </div>
                                            <span className="font-semibold">Create New Canvas</span>
                                        </button>
                                    )}

                                    {/* Filtered Tabs */}
                                    {tabs.filter(t => t.name.toLowerCase().includes(dashboardSearch.toLowerCase())).map((tab) => (
                                        <CanvasCard
                                            key={tab._id}
                                            tab={tab}
                                            view={dashboardView}
                                            onClick={() => setActiveTab(tab._id)}
                                            onDelete={(id) => handleDeleteTab(id)}
                                            onRename={(id, name) => handleRenameTab(id, name)}
                                            onShare={(id) => handleShareTab(id)}
                                        />
                                    ))}

                                    {/* Create New Card (Grid Only) - Moved to End */}
                                    {dashboardView === 'grid' && (
                                        <button
                                            onClick={() => handleAddTab(`Untitled ${tabs.length + 1} `)}
                                            className="flex flex-col items-center justify-center p-8 bg-gray-100/50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-gray-800 transition-all group min-h-[240px]"
                                        >
                                            <div className="p-4 bg-white dark:bg-gray-800 rounded-full mb-4 shadow-sm group-hover:shadow-md group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-110 transition-all">
                                                <Plus size={32} />
                                            </div>
                                            <span className="font-bold text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-lg">Create New</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Canvas Tab View (Dynamic Tabs)
                    tabs.find(t => t._id === activeTab) ? (
                        <CanvasTab
                            tab={tabs.find(t => t._id === activeTab)}
                            onSave={(data) => handleSaveCanvas(activeTab, data)}
                            connected={socket?.connected || false}
                            socket={rawSocket}
                            channelId={chat.id}
                            currentUserId={currentUserId}
                        />
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>Loading canvas...</p>
                        </div>
                    )
                )}

                {/* Thread Panel (if active and in chat tab) */}
                {activeTab === 'chat' && activeThread && (
                    <ThreadPanel
                        parentMessage={activeThread}
                        channelId={conversationId}
                        conversationType="channel"
                        onClose={handleThreadClose}
                        socket={rawSocket}
                        currentUserId={currentUserId}
                    />
                )}
            </div>

            {/* Error Display */}
            {conversation.error && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '5rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--error-color)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem'
                    }}
                >
                    {conversation.error}
                </div>
            )}

            {/* Poll Creation Modal */}
            {showPollModal && (
                <PollCreationModal
                    isOpen={showPollModal}
                    onClose={() => setShowPollModal(false)}
                    onCreate={handleCreatePoll}
                    channelId={chat?.id}
                />
            )}

            {/* Member List Modal */}
            {showMemberList && (
                <MemberListModal
                    isOpen={showMemberList}
                    onClose={() => setShowMemberList(false)}
                    members={chat?.members || []}
                    channelName={chat?.name}
                    currentUserId={currentUserId}
                />
            )}

            {/* Contact Info Modal (DMs) */}
            {showContactInfo && chat?.type === 'dm' && (
                <ContactInfoModal
                    isOpen={showContactInfo}
                    onClose={() => setShowContactInfo(false)}
                    contact={chat}
                    currentUserId={currentUserId}
                />
            )}

            {/* Channel Management Modal */}
            {showChannelManagement && chat?.type === 'channel' && (
                <ChannelManagementModal
                    channel={{
                        ...chat,
                        id: chat.id || chat._id, // Ensure id field exists
                        workspaceId: workspaceId || chat.workspaceId
                    }}
                    onClose={() => setShowChannelManagement(null)}
                    currentUserId={currentUserId}
                    initialTab={showChannelManagement}
                />
            )}
        </div>
    );
}


export default ChatWindowV2;

