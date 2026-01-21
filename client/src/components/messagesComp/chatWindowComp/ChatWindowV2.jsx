// client/src/components/messagesComp/chatWindowComp/ChatWindowV2.jsx
// NEW: Refactored ChatWindow using hooks and event-based architecture
// This is the new version that will eventually replace chatWindow.jsx

/**
 * @owner chat-module
 * @status legacy
 * @remove-after 2026-03
 * @deprecated Use src/modules/chat/components/ChatWindow.jsx instead
 * 
 * FROZEN: This component is in legacy mode. Do NOT add new features here.
 * All new chat functionality should go to src/modules/chat/components/
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useChatSocket, useConversation, useMessageActions } from '../../../hooks';
import { ConversationStream } from '../events';
import Header from './header/header.jsx';
import FooterInput from './footer/footerInput.jsx';
import ThreadPanel from './ThreadPanel.jsx';
import ChannelTabs from './tabs/ChannelTabs.jsx';
import CanvasTab from './tabs/CanvasTab.jsx';
import PollCreationModal from './modals/PollCreationModal.jsx';
import MemberListModal from './modals/MemberListModal.jsx';
import ContactInfoModal from './modals/contactInfoModal.jsx';
import ChannelManagementModal from '../ChannelManagementModal.jsx';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import api from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

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
    const { user } = useAuth();
    const { socket: rawSocket } = useSocket(); // Get raw socket for ThreadPanel
    const currentUserId = user?.sub || user?._id;

    // Conversation state
    const [activeThread, setActiveThread] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);

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
    const [recording, setRecording] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const { showToast } = useToast();

    // Extract conversation details
    const conversationId = chat?.id || chat?._id;
    const conversationType = chat?.type || (chat?.participants ? 'dm' : 'channel');

    // Initialize hooks FIRST (before using them in callbacks)
    const conversation = useConversation(conversationId, conversationType, workspaceId);
    const actions = useMessageActions(conversationId, conversationType, workspaceId);

    // Use ref to avoid stale closures in socket event handler
    const conversationRef = React.useRef(conversation);

    // Keep ref up to date
    React.useEffect(() => {
        conversationRef.current = conversation;
    }, [conversation]);

    // Header action handlers
    const handleShowThreadsView = useCallback(() => {
        console.log('Show threads view');
        showToast('Threads view coming soon!', 'info');
    }, [showToast]);

    const handleShowMemberList = useCallback(() => {
        setShowMemberList(true);
        console.log('Show member list');
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
        switch (event.type) {
            case 'message':
            case 'new-message':
                // Handle incoming message
                console.log('📨 [ChatWindowV2] Received message event:', {
                    type: event.type,
                    hasPayload: !!event.payload,
                    messageId: event.payload?._id || event.payload?.id
                });

                const message = event.payload.message || event.payload;

                if (message) {
                    // Normalize the message to ensure consistent structure
                    const normalizedMessage = {
                        id: message._id || message.id,
                        type: message.pollId ? 'poll' : 'message',
                        payload: {
                            ...message,
                            text: message.payload?.text || message.text || '',
                            attachments: message.payload?.attachments || message.attachments || [],
                            replyCount: message.replyCount || 0,
                            reactions: message.reactions || [],
                            isPinned: message.isPinned || false,
                            isDeleted: message.isDeleted || false
                        },
                        sender: message.sender,
                        createdAt: message.createdAt,
                        parentId: message.threadParent || message.parentId
                    };

                    console.log('➕ [ChatWindowV2] Adding message to conversation:', {
                        messageId: normalizedMessage.id,
                        sender: normalizedMessage.sender?.username,
                        text: normalizedMessage.payload.text?.substring(0, 50)
                    });

                    conversationRef.current.addRealtimeEvent(normalizedMessage, currentUserId);
                }
                break;

            case 'message-sent':
                // Handle message sent confirmation (replace optimistic message)
                console.log('✅ [ChatWindowV2] Message sent confirmation:', event.payload);
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
                console.log('🔄 [ChatWindowV2] Message updated:', event.payload);
                const { messageId, updates } = event.payload;
                console.log('🔍 [ChatWindowV2] Update details:', {
                    messageId,
                    updates,
                    hasUpdates: !!updates,
                    replyCount: updates?.replyCount
                });
                if (messageId && updates) {
                    // Update the message with the new replyCount in the payload
                    conversationRef.current.updateEvent(messageId, {
                        payload: {
                            replyCount: updates.replyCount
                        }
                    });
                    console.log('✅ [ChatWindowV2] Updated message', messageId, 'with replyCount:', updates.replyCount);
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

            default:
                console.log('Unhandled socket event:', event.type);
        }
    }, [currentUserId]); // Include currentUserId in dependencies

    // Initialize socket with event handler
    const socket = useChatSocket(conversationId, conversationType, handleSocketEvent);

    // Socket listeners for tab events
    useEffect(() => {
        if (!rawSocket || chat?.type !== 'channel') return;

        const handleTabAdded = ({ tab }) => {
            console.log('📌 Tab added:', tab);
            setTabs(prev => {
                const exists = prev.find(t => t._id === tab._id);
                if (exists) return prev;
                return [...prev, tab];
            });
        };

        const handleTabUpdated = ({ tabId, name, content }) => {
            console.log('📝 Tab updated:', tabId, name);
            setTabs(prev => prev.map(t =>
                t._id === tabId ? { ...t, name, content } : t
            ));
        };

        const handleTabDeleted = ({ tabId }) => {
            console.log('🗑️ Tab deleted:', tabId);
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
        console.log('handleSend called with markdown:', markdown);
        console.log('Current conversation state:', { conversationType, conversationId, workspaceId });

        // Prepare message data (encryption handled in useMessageActions)
        const messageData = {
            text: markdown,
            attachments: [],
            replyTo: replyingTo?._id
        };

        // Send the message (useMessageActions will encrypt it)
        const result = await actions.sendMessage(messageData);

        console.log('Send result:', result);

        if (result.success) {
            setReplyingTo(null);
            setNewMessage('');
        } else {
            console.error('Failed to send message:', result.error);
            showToast(result.error || 'Failed to send message', 'error');
        }

        return result;
    }, [actions, replyingTo, showToast]);

    // Handle emoji pick
    const handleEmojiPick = useCallback((emoji) => {
        setNewMessage(prev => prev + emoji);
        setShowEmoji(false);
    }, []);

    // Handle attachments
    const handleAttach = useCallback((file) => {
        console.log('Attach file:', file);
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
            setActiveTab(res.data.tab._id);
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
                connected={socket.connected}
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
                {activeTab === 'chat' ? (
                    <>
                        {/* Main Stream - flex column */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                            {/* Conversation Stream - scrollable */}
                            <ConversationStream
                                events={conversation.events}
                                loading={conversation.loading}
                                onLoadMore={conversation.loadMore}
                                hasMore={conversation.hasMore}
                                actions={enhancedActions}
                                conversationType={conversationType}
                                channelMembers={channelMembers}
                                userJoinedAt={userJoinedAt}
                                onThreadOpen={handleThreadOpen}
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
                                blocked={false}
                                setNewMessage={setNewMessage}
                            />
                        </div>
                    </>
                ) : (
                    // Canvas Tab View
                    tabs.find(t => t._id === activeTab) ? (
                        <CanvasTab
                            tab={tabs.find(t => t._id === activeTab)}
                            onSave={(data) => handleSaveCanvas(activeTab, data)}
                        />
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>Loading canvas...</p>
                        </div>
                    )
                )}

                {/* Thread Panel (if active) */}
                {activeThread && (
                    <ThreadPanel
                        parentMessage={activeThread}
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
