import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChatSocket, useConversation, useMessageActions } from '../../../hooks';
import { sameId } from '../../../hooks/conversationUtils';
import Header from './header/header.jsx';
import ChannelTabs from './tabs/ChannelTabs.jsx';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import { useContacts } from '../../../contexts/ContactsContext';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';
import { useNotifications } from '../../notifications/NotificationsContext';
import { useAIContext } from '../../../contexts/AIContext';

import CentralContentView from './views/CentralContentView.jsx';
import ErrorDisplay from './views/ErrorDisplay.jsx';
import ModalRenderer from './views/ModalRenderer.jsx';

import CreatePollModal from './modals/CreatePollModal.jsx';

import ContactPickerModal from './modals/ContactPickerModal.jsx';

import ScheduleMeetingModal from './modals/ScheduleMeetingModal.jsx';

import BookmarksPanel from './panels/BookmarksPanel.jsx';
import PinnedMessagesPanel from '../PinnedMessagesPanel.jsx';
import CreateChecklistModal from './modals/CreateChecklistModal.jsx';
import RemindersPanel from './panels/RemindersPanel.jsx';
import { indexConversation } from '../../../utils/localMessageIndex';
import { useWorkspaceFeatures } from '../../../hooks/useWorkspaceFeatures';
import ReminderPicker from './modals/ReminderPicker.jsx';
import ConvertToTaskModal from './modals/ConvertToTaskModal.jsx';
import ThreadSummaryModal from './modals/ThreadSummaryModal.jsx';
import MessageDiffViewer from '../MessageDiffViewer.jsx';
import ConfirmationModal from '../../../shared/components/ui/ConfirmationModal.jsx';
import { encryptMessageForSending } from '../../../services/messageEncryptionService';
import { getMessageText, toggleBookmarkedBy, formatReminderTime } from '../../../utils/messageActionUtils';

import useHeaderActions from './hooks/useHeaderActions.js';
import useCanvasActions from './hooks/useCanvasActions.js';
import useMessageInput from './hooks/useMessageInput.js';

import { useLinkPreview } from './hooks/useLinkPreview.js';

import { useHuddle } from '../../huddles/useHuddle.js';
import HuddleOverlay from '../../huddles/components/HuddleOverlay.jsx';

import './chatWindow.css';
import logger from '../../../utils/logger';

function ChatWindowV2({ chat, onClose, contacts = [], onDeleteChat, workspaceId, onChatUpdate }) {
    const { user, encryptionReady } = useAuth();
    const { socket: rawSocket } = useSocket();
    const currentUserId = user?.sub || user?._id;
    const { showToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshContacts } = useContacts();

    
    const huddle = useHuddle({
        channelId: chat?.type === 'channel' ? chat?.id : null,
        dmId: chat?.type === 'dm' ? chat?.id : null,
        currentUser: user,
        socket: rawSocket,
    });
    const { activeWorkspace } = useWorkspace();

    
    const isMember = useMemo(() => {
        if (!chat || chat.type !== 'channel') return true; 
        if (!chat.members || !currentUserId) return false;

        return chat.members.some(m => {
            const memberId = m.user?._id || m.user || m._id || m;
            const memberIdStr = memberId?.toString();
            const currentUserIdStr = currentUserId?.toString();
            return memberIdStr === currentUserIdStr;
        });

    }, [chat, currentUserId]);

    
    const isDiscoverablePublicChannel = useMemo(() => {
        if (!chat || chat.type !== 'channel') return false;
        return !chat.isPrivate && chat.isDiscoverable !== false;
    }, [chat]);

    
    const canInteract = encryptionReady && (chat?.type !== 'channel' || isMember);

    

    
    const [isJoining, setIsJoining] = useState(false);

    const handleJoinChannel = useCallback(async () => {
        if (!chat || !chat.id) return;

        setIsJoining(true);
        try {
            await api.post(`/api/channels/${chat.id}/join-discoverable`);
            showToast(`Joined ${chat.name} successfully!`, 'success');

            
            if (activeWorkspace?.id) await refreshContacts(activeWorkspace.id);

            
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
                
                navigate(`/workspace/${activeWorkspace?.id}/channel/${chat.id}`);
            }
        } catch (err) {
            logger.error('Join channel error:', err);
            showToast(err.response?.data?.message || 'Failed to join channel', 'error');
        } finally {
            setIsJoining(false);
        }
    }, [chat, showToast, navigate, refreshContacts, activeWorkspace, onChatUpdate]);

    
    const [activeThread, setActiveThread] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    // A new conversation starts with nobody typing.
    useEffect(() => { setTypingUsers([]); }, [chat?.id]);
    const typingTimersRef = useRef(new Map());
    useEffect(() => {
        const timers = typingTimersRef.current;
        return () => {
            timers.forEach(clearTimeout);
            timers.clear();
        };
    }, []);
    const [recording, setRecording] = useState(false);

    
    const [activeTab, setActiveTab] = useState('chat');
    const [tabs, setTabs] = useState([]);
    
    const appliedOpenTabId = useRef(false);

    
    
    
    useEffect(() => {
        const openTabId = location.state?.openTabId;
        if (!openTabId || appliedOpenTabId.current) return;
        if (tabs.length === 0) return; 

        const match = tabs.find(t => t._id === openTabId);
        if (match) {
            appliedOpenTabId.current = true;
            setActiveTab(match._id);   
        }
    }, [tabs, location.state]);

    
    useEffect(() => {
        appliedOpenTabId.current = false;
    }, [chat?.id]);

    
    const [activeModal, setActiveModal] = useState(null);
    
    const [forwardingMessageId, setForwardingMessageId] = useState(null);
    
    const [showPollModal, setShowPollModal] = useState(false);
    
    const [showContactModal, setShowContactModal] = useState(false);
    
    const [showMeetingModal, setShowMeetingModal] = useState(false);
    
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [showPinned, setShowPinned] = useState(false);
    const [showChecklistModal, setShowChecklistModal] = useState(false);
    const [showReminders, setShowReminders] = useState(false);
    // Features the workspace admins switched off are hidden here (and refused by the server).
    const features = useWorkspaceFeatures(workspaceId || chat?.workspaceId);

    // Resolving a thread updates its badge in the stream for everyone.
    React.useEffect(() => {
        if (!rawSocket) return undefined;
        const onResolved = ({ messageId, resolved, resolvedThreadAt }) => {
            const at = resolved ? (resolvedThreadAt || new Date().toISOString()) : null;
            conversationRef.current?.updateEvent?.(String(messageId), { resolvedThreadAt: at, payload: { resolvedThreadAt: at } });
        };
        rawSocket.on('thread:resolved', onResolved);
        return () => rawSocket.off('thread:resolved', onResolved);
    }, [rawSocket]);

    // Slash commands from the composer that need the chat window.
    const handleSlashCommand = (name, args) => {
        switch (name) {
            case 'call':
            case 'video':
                if (!features.huddles) { showToast('Calls are turned off in this workspace.', 'info'); return true; }
                startOrJoinCall(name === 'video'); return true;
            case 'meet': setShowMeetingModal(true); return true;
            case 'poll':
                if (!features.polls) { showToast('Polls are turned off in this workspace.', 'info'); return true; }
                setShowPollModal(true); return true;
            case 'ai': window.dispatchEvent(new CustomEvent('chttrix-ai:open', { detail: { prompt: args || null } })); return true;
            default: return false;
        }
    };

    // Call buttons: leave if in a call; join a live one here (keeping its kind);
    // otherwise start a new voice or video call.
    const startOrJoinCall = (video) => {
        const run = () => {
            if (huddle.active) return huddle.leaveHuddle();
            if (huddle.huddleAnnouncement) {
                const { huddleId, video: liveIsVideo } = huddle.huddleAnnouncement;
                huddle.dismissAnnouncement();
                return huddle.joinHuddle(huddleId, { video: liveIsVideo || video });
            }
            return huddle.startHuddle({ video });
        };
        Promise.resolve(run()).catch(() => showToast('Could not access your microphone or camera.', 'error'));
    };

    // Scroll to a loaded message and flash it (pins, bookmarks).
    const jumpToLoadedMessage = React.useCallback((messageId) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (!el) {
            showToast('That message is further back. Scroll up to load older messages.', 'info');
            return;
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color 300ms ease';
        el.style.backgroundColor = 'var(--bg-active)';
        setTimeout(() => { el.style.backgroundColor = ''; }, 1600);
    }, [showToast]);
    // Message toolbar modals (one message each, null when closed).
    const [reminderMsg, setReminderMsg] = useState(null);
    const [historyMsg, setHistoryMsg] = useState(null);
    const [taskMsg, setTaskMsg] = useState(null);
    const [summaryMsg, setSummaryMsg] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [muted, setMuted] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [blockedByOther, setBlockedByOther] = useState(false);
    // Announcement channels: only channel admins may start messages.
    const [channelPolicy, setChannelPolicy] = useState({ postingPolicy: 'everyone', canManage: true });
    const postingLocked = chat?.type === 'channel' && channelPolicy.postingPolicy === 'admins' && !channelPolicy.canManage;
    React.useEffect(() => {
        if (!rawSocket || chat?.type !== 'channel') return undefined;
        const onPolicy = ({ channelId, postingPolicy }) => {
            if (String(channelId) === String(chat.id)) setChannelPolicy(p => ({ ...p, postingPolicy }));
        };
        rawSocket.on('channel:policy-updated', onPolicy);
        return () => rawSocket.off('channel:policy-updated', onPolicy);
    }, [rawSocket, chat?.id, chat?.type]);

    // Saved mute/block state for this conversation (both are enforced by the server).
    React.useEffect(() => {
        setMuted(false); setBlocked(false); setBlockedByOther(false);
        setChannelPolicy({ postingPolicy: 'everyone', canManage: true });
        if (!chat?.id) return;
        if (chat.type === 'dm') {
            api.get(`/api/v2/dm/${chat.id}/status`)
                .then(({ data }) => {
                    setMuted(data.isMuted || false);
                    setBlocked(data.isBlocked || false);
                    setBlockedByOther(data.isBlockedByOther || false);
                })
                .catch(() => { });
        } else if (chat.type === 'channel') {
            api.get(`/api/channels/${chat.id}/mute`)
                .then(({ data }) => {
                    setMuted(data.isMuted || false);
                    setChannelPolicy({ postingPolicy: data.postingPolicy || 'everyone', canManage: data.canManage !== false });
                })
                .catch(() => { });
        }
    }, [chat?.id, chat?.type]);

    
    const [newMessage, setNewMessage] = useState('');
    const [showAttach, setShowAttach] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);

    
    

    
    const [dashboardView, setDashboardView] = useState('grid');
    const [dashboardSearch, setDashboardSearch] = useState('');

    
    const [threadCounts, setThreadCounts] = useState({});

    
    const [showThreadsOnly, setShowThreadsOnly] = useState(false);

    
    const conversationId = chat?.id || chat?._id;
    const conversationType = chat?.type || (chat?.participants ? 'dm' : 'channel');

    
    const conversation = useConversation(conversationId, conversationType, workspaceId);
    const actions = useMessageActions(conversationId, conversationType, workspaceId, chat?.members || []);

    
    const conversationRef = React.useRef(conversation);

    // Feed decrypted messages to the in-browser search index (the server can't read them).
    React.useEffect(() => {
        if (!conversationId || !conversation.events?.length) return;
        indexConversation({ id: conversationId, type: conversationType, name: chat?.name, workspaceId: workspaceId || chat?.workspaceId }, conversation.events);
    }, [conversation.events, conversationId, conversationType, chat?.name, workspaceId, chat?.workspaceId]);

    
    React.useEffect(() => {
        conversationRef.current = conversation;
    }, [conversation]);

    
    
    
    const headerActions = useHeaderActions({
        chat,
        showToast,
        onClose,
        onDeleteChat,
        onChatCleared: () => { conversationRef.current?.reset?.(); conversationRef.current?.reload?.(); },
    });

    
    const handleMuteToggle = React.useCallback(async () => {
        const next = await headerActions.handleMuteToggle(muted);
        setMuted(next);
    }, [headerActions, muted]);

    const handleBlockToggle = React.useCallback(async () => {
        if (chat?.type !== 'dm') { setBlocked(b => !b); return; }
        const next = await headerActions.handleBlockToggle(blocked);
        setBlocked(next);
    }, [chat?.type, headerActions, blocked]);

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

    
    
    const { connectSocket } = useSocket();
    React.useEffect(() => {
        
        if (!encryptionReady) {
            return;
        }

        if (chat?.type === 'channel' && !isMember) {
            return;
        }

        
        if (encryptionReady && (chat?.type !== 'channel' || isMember)) {
            connectSocket();
        }
    }, [connectSocket, encryptionReady, isMember, chat?.type]); 

    
    
    

    
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

    
    const handleSocketEvent = useCallback((event) => {
        

        switch (event.type) {
            case 'message':
            case 'new-message':
                
                const backendMsg = event.payload;

                if (backendMsg) {
                    
                    const SOCKET_ATTACHMENT_TYPES = ['image', 'video', 'file', 'voice'];
                    const normalizedEvent = {
                        id: backendMsg._id,
                        
                        type: backendMsg.type || 'message',
                        
                        
                        
                        
                        payload: backendMsg.payload?.ciphertext
                            ? backendMsg.payload   
                            : backendMsg,          
                        sender: backendMsg.sender,
                        createdAt: backendMsg.createdAt,
                        channelId: backendMsg.channel,
                        dmId: backendMsg.dm,
                        quotedMessageId: backendMsg.quotedMessageId || null,
                        
                        isEncrypted: backendMsg.payload?.isEncrypted || false,
                        ciphertext: backendMsg.payload?.ciphertext,
                        messageIv: backendMsg.payload?.messageIv,
                        
                        
                        attachments: backendMsg.attachments || [],
                        
                        ...(SOCKET_ATTACHMENT_TYPES.includes(backendMsg.type) && {
                            attachment: backendMsg.attachments?.[0] || null,
                        }),
                        
                        ...(backendMsg.type === 'system' && {
                            systemEvent: backendMsg.systemEvent,
                            systemData: backendMsg.systemData,
                            text: backendMsg.text,
                        }),
                        
                        ...(backendMsg.type === 'poll' && {
                            poll: backendMsg.poll,
                        }),
                        
                        ...(backendMsg.type === 'checklist' && {
                            checklist: backendMsg.checklist || [],
                        }),
                        ...(backendMsg.type === 'contact' && {
                            contact: backendMsg.contact,
                        }),
                        
                        ...(backendMsg.type === 'meeting' && {
                            meeting: backendMsg.meeting,
                        }),
                        backend: backendMsg 
                    };

                    conversationRef.current.addRealtimeEvent(normalizedEvent);
                }
                break;

            case 'message-sent':
                
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
                
                const { messageId, updates } = event.payload;

                if (messageId && updates) {
                    const payloadPatch = {
                        ...(updates.replyCount !== undefined && { replyCount: updates.replyCount }),
                        ...(updates.lastReplyAt !== undefined && { lastReplyAt: updates.lastReplyAt }),
                        ...(updates.text !== undefined && { text: updates.text }),
                        ...(updates.editedAt !== undefined && { editedAt: updates.editedAt }),
                        
                        ...(updates.editHistory !== undefined && { editHistory: updates.editHistory }),
                        ...(updates.version !== undefined && { version: updates.version }),
                        ...(updates.restoredFromVersion !== undefined && { restoredFromVersion: updates.restoredFromVersion }),
                        
                        ...(updates.payload?.ciphertext && {
                            ciphertext: updates.payload.ciphertext,
                            messageIv: updates.payload.messageIv,
                            isEncrypted: true
                        })
                    };

                    conversationRef.current.updateEvent(messageId, {
                        ...(updates.replyCount !== undefined && { replyCount: updates.replyCount }),
                        ...(updates.lastReplyAt !== undefined && { lastReplyAt: updates.lastReplyAt }),
                        
                        
                        ...(updates.decryptedContent !== undefined && {
                            decryptedContent: updates.decryptedContent,
                            text: updates.decryptedContent  
                        }),
                        
                        ...(updates.editedAt !== undefined && { editedAt: updates.editedAt }),
                        
                        ...(updates.editHistory !== undefined && { editHistory: updates.editHistory }),
                        ...(updates.version !== undefined && { version: updates.version }),
                        ...(updates.restoredFromVersion !== undefined && { restoredFromVersion: updates.restoredFromVersion }),
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
                
                if (event.payload?.messageId) {
                    conversationRef.current.removeEvent(event.payload.messageId);
                }
                break;

            case 'message-pinned':
            case 'message-unpinned':
                // Only patch the pin fields; never replace the message payload
                // (the event carries the ciphertext, not the decrypted message).
                if (event.payload) {
                    const pinned = event.payload.isPinned !== undefined
                        ? !!event.payload.isPinned
                        : event.type === 'message-pinned';
                    const pinFields = {
                        isPinned: pinned,
                        pinnedBy: pinned ? (event.payload.pinnedBy ?? null) : null,
                        pinnedByName: pinned ? (event.payload.pinnedByName ?? null) : null,
                        pinnedAt: pinned ? (event.payload.pinnedAt ?? null) : null,
                    };
                    conversationRef.current.updateEvent(event.payload.messageId || event.payload._id, {
                        ...pinFields,
                        payload: pinFields,
                    });
                }
                break;

            case 'reaction-added':
            case 'reaction-removed':
                
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

            case 'user-typing': {
                const { userId, userName, isTyping } = event.payload || {};
                if (!userId || String(userId) === String(currentUserId)) break;
                const name = userName && userName !== 'Someone' ? userName : 'Someone';
                const timers = typingTimersRef.current;
                const existingTimer = timers.get(userId);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                    timers.delete(userId);
                }
                if (isTyping) {
                    setTypingUsers(prev => (prev.some(u => u.id === userId) ? prev : [...prev, { id: userId, name }]));
                    // Senders re-emit every ~2.5s while typing; drop them if that stops.
                    timers.set(userId, setTimeout(() => {
                        timers.delete(userId);
                        setTypingUsers(prev => prev.filter(u => u.id !== userId));
                    }, 4000));
                } else {
                    setTypingUsers(prev => prev.filter(u => u.id !== userId));
                }
                break;
            }

            case 'reconnect':
                // Fetch anything that arrived while the socket was disconnected.
                conversationRef.current?.loadNewer?.({ force: true });
                break;

            case 'member-joined':
                
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
                // The server also emits a persisted system 'new-message' for the
                // departure; rendering here would duplicate the "left" pill.
                break;

            case 'thread-reply':
                
                const reply = event.payload.reply || event.payload.message || event.payload;
                const replyParentId = reply.parentId || event.payload.parentId || reply.replyTo;

                if (replyParentId) {
                    setThreadCounts(prev => {
                        const newCount = (prev[replyParentId] || 0) + 1;

                        
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
                
                const { parentMessageId, replyCount, lastReplyAt } = event.payload;

                
                conversationRef.current.updateEvent(parentMessageId, {
                    replyCount: replyCount || 1,   
                    lastReplyAt: lastReplyAt,
                    payload: {
                        replyCount: replyCount || 1,
                        lastReplyAt: lastReplyAt
                    }
                });

                
                setThreadCounts(prev => ({
                    ...prev,
                    [parentMessageId]: replyCount || 1
                }));
                break;

            default:
                
                break;
        }
    }, []); 

    
    
    
    
    
    const socket = useChatSocket(conversationId, conversationType, handleSocketEvent);

    
    
    
    
    
    
    
    
    
    
    // Opening a conversation (or returning to the tab while it is open) marks
    // it read everywhere: server readBy, this tab's badge, other tabs/devices.
    // Expose the open conversation (decrypted) to Chttrix AI.
    const aiCtx = useAIContext();
    const setAIConversation = aiCtx?.setConversation;
    useEffect(() => {
        if (!setAIConversation || !conversationId) return undefined;
        setAIConversation({
            id: String(conversationId),
            type: conversationType,
            name: chat?.name || '',
            getMessages: () => (conversationRef.current?.events || [])
                .filter(e => e && (e.type === 'message' || !e.type))
                .map(e => ({
                    id: e.id,
                    sender: e.sender?.username || (typeof e.sender === 'string' ? e.sender : 'User'),
                    text: e.decryptedContent || e.text || e.payload?.text || '',
                    isMe: String(e.sender?._id || e.sender) === String(currentUserId),
                }))
                .filter(m => m.text),
        });
        return () => setAIConversation(null);
    }, [setAIConversation, conversationId, conversationType, chat?.name, currentUserId]);

    const notifCtx = useNotifications();
    const clearConversationUnread = notifCtx?.clearConversationUnread;
    const lastMessageIdRef = useRef(null);
    const latestEventId = conversation.events?.length ? conversation.events[conversation.events.length - 1]?.id : null;
    useEffect(() => {
        if (!conversationId || !conversationType || conversation.loading) return;
        const markRead = () => {
            if (document.visibilityState !== 'visible') return;
            clearConversationUnread?.(conversationType, String(conversationId));
            if (rawSocket?.connected && latestEventId !== lastMessageIdRef.current) {
                lastMessageIdRef.current = latestEventId;
                rawSocket.emit('mark-chat-read', { type: conversationType, id: conversationId });
            }
        };
        markRead();
        document.addEventListener('visibilitychange', markRead);
        return () => document.removeEventListener('visibilitychange', markRead);
    }, [conversationId, conversationType, conversation.loading, latestEventId, rawSocket, clearConversationUnread]);

    useEffect(() => {
        if (conversationType !== 'dm') return;
        if (!rawSocket || !conversationId) return;


        rawSocket.emit('join-dm', { dmSessionId: conversationId });

        
        return () => {
            if (rawSocket?.connected) {
                rawSocket.emit('leave-dm', { dmSessionId: conversationId });
            }
        };
    }, [conversationType, conversationId, rawSocket]);

    
    useEffect(() => {
        if (!conversation.events || conversation.loading) return;

        const newCounts = {};
        conversation.events.forEach(event => {
            
            const count = event.replyCount ?? event.payload?.replyCount ?? 0;
            if (count > 0) {
                newCounts[event.id] = count;
            }
        });

        
        if (Object.keys(newCounts).length > 0) {
            setThreadCounts(prev => ({ ...prev, ...newCounts }));
        }
        
    }, [conversation.events.length, conversation.loading]);

    
    useEffect(() => {
        if (!rawSocket || chat?.type !== 'channel') return;

        const currentChannelId = chat?.id;
        const isForThisChannel = (payload) => sameId(payload?.channelId, currentChannelId);

        const handleTabAdded = (payload) => {
            if (!isForThisChannel(payload)) return;
            const { tab } = payload;
            setTabs(prev => {
                const exists = prev.find(t => t._id === tab._id);
                if (exists) return prev;
                return [...prev, tab];
            });
        };

        const handleTabUpdated = (payload) => {
            if (!isForThisChannel(payload)) return;
            const { tabId, name, content, emoji, coverColor, wordCount, lastEditedBy, lastEditedAt } = payload;
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

        const handleTabDeleted = (payload) => {
            if (!isForThisChannel(payload)) return;
            const { tabId } = payload;
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
    }, [rawSocket, chat?.type, chat?.id, activeTab]);

    
    // Typing indicator: tell the room we're typing at most every 2.5s while the
    // draft changes (receivers time the indicator out on their side).
    const lastTypingEmitRef = useRef(0);
    const handleMessageChange = useCallback((e) => {
        messageInputActions.handleMessageChange(e);
        const value = e?.target?.value;
        if (!value || !socket?.emitTyping) return;
        const now = Date.now();
        if (now - lastTypingEmitRef.current > 2500) {
            lastTypingEmitRef.current = now;
            socket.emitTyping(true);
        }
    }, [messageInputActions, socket]);
    const handleEmojiPick = messageInputActions.handleEmojiPick;
    const handleAttach = messageInputActions.handleAttach;

    
    const { preview: linkPreview, loading: linkPreviewLoading, clearPreview: clearLinkPreview } = useLinkPreview(newMessage);

    
    const handleSend = useCallback(async (markdown, { mentionText = '' } = {}) => {
        const messageData = {
            text: markdown,
            // Plaintext @handles only (never the message body); the server uses
            // it to notify mentioned members of this E2EE message.
            mentionText,
            attachments: [],
            replyTo: null,
            quotedMessageId: replyingTo?._id || null,
            
            linkPreview: linkPreview || null,
        };

        
        const result = await actions.sendMessage(messageData);
        
        clearLinkPreview();

        if (result.success) {
            

            
            
            
            
            if (result.message) {
                
                
                const currentReplyingTo = replyingTo;

                
                
                const quotedPreview = currentReplyingTo ? {
                    _id: result.message.quotedMessageId?._id || result.message.quotedMessageId,
                    senderName: currentReplyingTo.senderName || currentReplyingTo.sender?.username || 'Someone',
                    payload: {
                        
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
                    
                    ...(msgType === 'poll' && { poll: result.message.poll }),
                    sender: result.message.sender,
                    createdAt: result.message.createdAt,
                    parentId: result.message.parentId, 
                    quotedMessageId: quotedPreview     
                };

                
                await conversation.addRealtimeEvent(normalizedEvent, currentUserId);
            }

            setReplyingTo(null);
            setNewMessage('');
        } else {
            showToast(result.message || result.error || 'Failed to send message', 'error');
        }

        return result;
        
    }, [actions, replyingTo, showToast]);

    
    const handleSendAttachment = useCallback(async (attachment) => {
        
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
            logger.error('[ChatWindowV2] handleSendAttachment error:', err);
            showToast('Failed to send attachment', 'error');
        }
        setShowAttach(false);
    }, [actions, conversation, currentUserId, showToast]); 

    
    const handleSendContact = useCallback(async (contact) => {
        
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
            logger.error('[ChatWindowV2] handleSendContact error:', err);
            showToast('Failed to share contact', 'error');
        }
        setShowContactModal(false);
        setShowAttach(false);
    }, [actions, conversation, currentUserId, showToast]);

    
    const handleSendMeeting = useCallback(async (meetingData) => {
        
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
            } else {
                showToast(result.error || 'Failed to schedule meeting', 'error');
            }
        } catch (err) {
            logger.error('[ChatWindowV2] handleSendMeeting error:', err);
            showToast('Failed to schedule meeting', 'error');
        }
        setShowMeetingModal(false);
        setShowAttach(false);
    }, [actions, conversation, currentUserId, showToast]);

    
    const handleCreatePoll = useCallback(async (pollData) => {
        if (!conversationId) return;
        try {
            let data;
            if (conversationType === 'channel') {
                
                ({ data } = await api.post('/api/v2/messages/poll', {
                    channelId: conversationId,
                    poll: pollData,
                }));
            } else {
                
                ({ data } = await api.post('/api/v2/messages/poll', {
                    dmId: conversationId,
                    poll: pollData,
                }));
            }
            const msg = data.message;
            if (msg) {
                const normalizedEvent = {
                    id: msg._id,
                    _id: msg._id,
                    type: 'poll',
                    
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
            logger.error('[ChatWindowV2] handleCreatePoll error:', err);
            showToast(err?.response?.data?.message || 'Failed to create poll', 'error');
        }
    }, [conversationId, conversationType, conversation, currentUserId, showToast]);

    
    useEffect(() => {
        if (!rawSocket) return;
        const handler = ({ messageId, poll }) => {
            
            
            const idStr = messageId?.toString?.() || String(messageId);
            conversationRef.current?.updateEvent(idStr, { poll });
        };
        rawSocket.on('poll:vote_updated', handler);
        return () => rawSocket.off('poll:vote_updated', handler);
    }, [rawSocket]); 

    
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

    
    
    useEffect(() => {
        const openTabId = location?.state?.openTabId;
        if (!openTabId || appliedOpenTabId.current) return;
        if (tabs.length === 0) return; 
        const tab = tabs.find(t => t._id === openTabId);
        if (tab) {
            setActiveTab(openTabId);
            appliedOpenTabId.current = true;
            
            window.history.replaceState({}, '');
        }
    }, [location?.state?.openTabId, tabs]);

    const handleThreadOpen = useCallback((message) => {
        setActiveThread(message);
    }, []);

    
    const handleThreadClose = useCallback(() => {
        setActiveThread(null);
    }, []);

    // ── Message toolbar actions (shared by channel + DM message items) ──
    const patchEvent = useCallback((id, fields) => {
        conversationRef.current?.updateEvent(id, fields);
    }, []);

    const isChannelAdmin = useMemo(() => {
        if (chat?.type !== 'channel' || !currentUserId) return false;
        const me = String(currentUserId);
        return !!chat?.isAdmin
            || (chat?.admins || []).some(a => String(a?._id || a) === me)
            || String(chat?.createdBy?._id || chat?.createdBy || '') === me;
    }, [chat?.type, chat?.isAdmin, chat?.admins, chat?.createdBy, currentUserId]);

    const performDelete = useCallback(async (messageId, scope) => {
        const existing = conversationRef.current?.events?.find(e => e.id === messageId);
        if (scope === 'everyone' && existing) {
            patchEvent(messageId, {
                payload: { isDeleted: true, isDeletedUniversally: true, deletedBy: currentUserId, deletedByName: user?.username || null },
            });
        }
        const result = await actions.deleteMessage(messageId, scope);
        if (result?.success) {
            if (scope === 'me') conversationRef.current?.removeEvent(messageId);
            showToast(scope === 'me' ? 'Message deleted for you' : 'Message deleted for everyone', 'success');
        } else {
            if (scope === 'everyone' && existing) {
                patchEvent(messageId, {
                    payload: {
                        isDeleted: existing.payload?.isDeleted || false,
                        isDeletedUniversally: existing.payload?.isDeletedUniversally || false,
                        deletedBy: existing.payload?.deletedBy || null,
                        deletedByName: existing.payload?.deletedByName || null,
                    },
                });
            }
            showToast(result?.error || 'Failed to delete message', 'error');
        }
        return result;
    }, [actions, patchEvent, currentUserId, user?.username, showToast]);

    const [messageInfo, setMessageInfo] = useState(null);
    const loadMessageInfo = useCallback(async (msg) => {
        const id = msg._id || msg.id;
        setMessageInfo({ msg, status: 'loading', data: null, error: null });
        setActiveModal('message-info');
        try {
            const { data } = await api.get(`/api/v2/messages/${id}/info`);
            setMessageInfo(cur => (cur && (cur.msg._id || cur.msg.id) === id ? { msg, status: 'done', data, error: null } : cur));
        } catch (err) {
            logger.error('[ChatWindowV2] Failed to fetch message info:', err);
            setMessageInfo(cur => (cur && (cur.msg._id || cur.msg.id) === id
                ? { msg, status: 'error', data: null, error: err?.response?.data?.message || 'Could not load message info' }
                : cur));
        }
    }, []);

    const enhancedActions = useMemo(() => ({
        ...actions,
        sendMessage: handleSend,
        isChannelAdmin,

        // 'everyone' asks for confirmation first; 'me' is immediate.
        deleteMessage: async (messageId, scope = 'everyone') => {
            if (scope === 'everyone') {
                setConfirmDeleteId(messageId);
                return { success: false, pending: true };
            }
            return performDelete(messageId, scope);
        },

        forwardMessage: (messageId) => {
            setForwardingMessageId(messageId);
            setActiveModal('forward');
        },

        replyToMessage: (message) => {
            setReplyingTo(message);
        },

        copyText: async (msg) => {
            const text = getMessageText(msg);
            if (!text) { showToast('Nothing to copy', 'error'); return; }
            try {
                await navigator.clipboard.writeText(text);
                showToast('Copied', 'success');
            } catch {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    const ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                    showToast(ok ? 'Copied' : 'Could not copy text', ok ? 'success' : 'error');
                } catch {
                    showToast('Could not copy text', 'error');
                }
            }
        },

        togglePin: async (msg) => {
            const id = msg.id;
            const next = !msg.isPinned;
            const before = { isPinned: !!msg.isPinned, pinnedByName: msg.pinnedByName || null };
            const set = (fields) => patchEvent(id, { ...fields, payload: fields });
            set({ isPinned: next, pinnedByName: next ? (user?.username || 'You') : null });
            try {
                await api.post(`/api/v2/messages/${id}/pin`, { pin: next });
                showToast(next ? 'Message pinned' : 'Message unpinned', 'success');
            } catch (err) {
                set(before);
                showToast(err?.response?.data?.message || `Failed to ${next ? 'pin' : 'unpin'} message`, 'error');
            }
        },

        toggleBookmark: !features.bookmarks ? undefined : async (msg) => {
            const id = msg.id;
            const before = Array.isArray(msg.bookmarkedBy) ? msg.bookmarkedBy : [];
            const optimistic = toggleBookmarkedBy(before, currentUserId);
            patchEvent(id, { bookmarkedBy: optimistic.bookmarkedBy });
            try {
                const { data } = await api.post(`/api/v2/messages/${id}/bookmark`);
                const saved = typeof data?.bookmarked === 'boolean' ? data.bookmarked : optimistic.bookmarked;
                if (saved !== optimistic.bookmarked) {
                    patchEvent(id, { bookmarkedBy: toggleBookmarkedBy(optimistic.bookmarkedBy, currentUserId).bookmarkedBy });
                }
                showToast(saved ? 'Saved' : 'Removed from saved', 'success');
            } catch (err) {
                patchEvent(id, { bookmarkedBy: before });
                showToast(err?.response?.data?.message || 'Failed to update saved messages', 'error');
            }
        },

        // Encrypts with the conversation key; never sends plaintext.
        editMessage: async (msg, newText) => {
            const text = (newText || '').trim();
            if (!text) return false;
            let enc = null;
            try {
                enc = await encryptMessageForSending(text, conversationId, conversationType);
            } catch (err) {
                logger.warn('[ChatWindowV2] Edit encryption failed:', err?.message);
            }
            if (!enc?.ciphertext || !enc?.messageIv) {
                showToast('Could not encrypt your edit, so it was not saved. Try again once encryption is ready.', 'error');
                return false;
            }
            const id = msg.id;
            const existing = conversationRef.current?.events?.find(e => e.id === id);
            const nowIso = new Date().toISOString();
            const nextVersion = (Number(msg.version) || 1) + 1;
            patchEvent(id, {
                decryptedContent: text,
                text,
                editedAt: nowIso,
                version: nextVersion,
                restoredFromVersion: null,
                payload: { editedAt: nowIso, ciphertext: enc.ciphertext, messageIv: enc.messageIv, isEncrypted: true, version: nextVersion, restoredFromVersion: null },
            });
            try {
                const { data } = await api.patch(`/api/v2/messages/${id}`, { ciphertext: enc.ciphertext, messageIv: enc.messageIv });
                const saved = data?.message;
                if (saved) {
                    const fields = {
                        ...(saved.editedAt && { editedAt: saved.editedAt }),
                        ...(saved.version !== undefined && { version: saved.version }),
                        ...(Array.isArray(saved.editHistory) && { editHistory: saved.editHistory }),
                    };
                    patchEvent(id, { ...fields, payload: fields });
                }
                return true;
            } catch (err) {
                if (existing) {
                    patchEvent(id, {
                        decryptedContent: existing.decryptedContent,
                        text: existing.text,
                        editedAt: existing.editedAt,
                        version: existing.version,
                        restoredFromVersion: existing.restoredFromVersion,
                        payload: {
                            ...(existing.payload || {}),
                            editedAt: existing.payload?.editedAt ?? null,
                            version: existing.payload?.version ?? null,
                            restoredFromVersion: existing.payload?.restoredFromVersion ?? null,
                        },
                    });
                }
                showToast(err?.response?.data?.message || 'Failed to edit message', 'error');
                return false;
            }
        },

        infoMessage: (msg) => loadMessageInfo(msg),
        onRemind: features.reminders ? (msg) => setReminderMsg(msg) : undefined,
        features,
        onShowHistory: (msg) => setHistoryMsg(msg),
        onConvertToTask: (msg) => setTaskMsg(msg),
        onSummarizeThread: (msg) => setSummaryMsg(msg),
    }), [actions, handleSend, showToast, isChannelAdmin, performDelete, patchEvent, currentUserId, user?.username, conversationId, conversationType, loadMessageInfo, features]);

    // Stream update after a version restore from the history viewer.
    const handleVersionRestored = useCallback((message, plaintext, restoredVersion) => {
        if (!historyMsg) return;
        const id = historyMsg.id;
        const restoredFrom = message?.restoredFromVersion ?? restoredVersion ?? null;
        const editedAt = message?.editedAt || new Date().toISOString();
        const payloadFields = {
            editedAt,
            restoredFromVersion: restoredFrom,
            ...(message?.version !== undefined && { version: message.version }),
            ...(message?.payload?.ciphertext && { ciphertext: message.payload.ciphertext, messageIv: message.payload.messageIv, isEncrypted: true }),
        };
        patchEvent(id, {
            ...(plaintext != null && { decryptedContent: plaintext, text: plaintext }),
            editedAt,
            restoredFromVersion: restoredFrom,
            ...(message?.version !== undefined && { version: message.version }),
            ...(Array.isArray(message?.editHistory) && { editHistory: message.editHistory }),
            payload: payloadFields,
        });
    }, [historyMsg, patchEvent]);

    
    const handleForward = useCallback(async (targets) => {
        if (!forwardingMessageId || !targets?.length) return;
        try {
            
            const sourceMsg = conversation.events?.find(
                e => (e._id || e.id) === forwardingMessageId
            );
            const plaintextToForward = sourceMsg?.decryptedContent
                || sourceMsg?.text
                || sourceMsg?.payload?.text
                || null;

            if (!plaintextToForward) {
                
                await actions.forwardMessage(forwardingMessageId, targets);
                return;
            }

            
            const { encryptMessageForSending } = await import('../../../services/messageEncryptionService');
            const results = await Promise.allSettled(
                targets.map(async (target) => {
                    const targetType = target.type;

                    // DM targets are user ids: resolve the DM session first, because
                    // the message must be encrypted with that session's key.
                    let targetConversationId = target.id;
                    if (targetType === 'dm') {
                        const dmResolve = await api.get(
                            `/api/v2/messages/workspace/${workspaceId}/dm/resolve/${target.id}`
                        );
                        targetConversationId = dmResolve.data.dmSessionId;
                    }

                    const encrypted = await encryptMessageForSending(
                        plaintextToForward,
                        targetConversationId,
                        targetType,
                        null
                    );

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
                        await api.post('/api/v2/messages/direct', {
                            dmSessionId: targetConversationId,
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
            if (failed > 0) logger.warn(`[ChatWindowV2] Forward: ${succeeded} succeeded, ${failed} failed`);

        } catch (err) {
            logger.error('[ChatWindowV2] Forward failed:', err);
        } finally {
            setActiveModal(null);
            setForwardingMessageId(null);
        }
    }, [forwardingMessageId, actions, conversation.events, workspaceId]);

    
    
    
    const channelMembers = (chat?.members || []).map(m => {
        const user = m.user || m; 
        return {
            _id: user._id || user.userId || m.userId,
            username: user.username || user.name || '',
            profilePicture: user.profilePicture || user.avatar || null,
            name: user.name || user.username || '',
        };
    }).filter(m => m.username); 

    const userJoinedAt = conversationType === 'channel'
        ? chat?.members?.find(m => (m.user?._id || m.user) === currentUserId)?.joinedAt
        : null;

    return (
        <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Header
                chat={chat}
                onClose={onClose}
                connected={socket?.connected || false}
                onCreatePoll={features.polls ? () => setActiveModal('poll') : undefined}
                showSearch={showSearch}
                setShowSearch={setShowSearch}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showMenu={showMenu}
                setShowMenu={setShowMenu}
                setShowContactInfo={() => setActiveModal('contact')}
                setShowChannelManagement={(tab) => setActiveModal(tab ? `channel-${tab}` : 'channel-settings')}
                muted={muted}
                setMuted={handleMuteToggle}
                blocked={blocked}
                setBlocked={handleBlockToggle}
                onDeleteChat={handleDeleteChat}
                onClearChat={handleClearChat}
                onExitChannel={handleExitChannel}
                onDeleteChannel={handleDeleteChannel}
                currentUserId={currentUserId}
                showToast={showToast}
                onShowThreadsView={handleShowThreadsView}
                isThreadsOnly={showThreadsOnly}
                onShowMemberList={handleShowMemberList}
                
                onStartHuddle={features.huddles ? () => startOrJoinCall(false) : undefined}
                onStartVideoCall={features.huddles ? () => startOrJoinCall(true) : undefined}
                huddleActive={huddle.active}
                onShowBookmarks={() => setShowBookmarks(true)}
                onShowReminders={() => setShowReminders(true)}
                onShowPinned={(chat?.type === 'channel' || chat?.type === 'dm') ? () => setShowPinned(true) : undefined}
            />

            {}
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

            {}
            <CentralContentView
                typingUsers={typingUsers}
                
                activeTab={activeTab}
                tabs={tabs}

                
                isMember={isMember}
                isDiscoverablePublicChannel={isDiscoverablePublicChannel}
                isJoining={isJoining}
                canInteract={canInteract}

                
                chat={chat}
                conversation={conversation}
                enhancedActions={enhancedActions}
                conversationType={conversationType}
                channelMembers={channelMembers}
                userJoinedAt={userJoinedAt}
                currentUserId={currentUserId}

                
                threadCounts={threadCounts}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                activeThread={activeThread}
                onThreadOpen={features.threads ? handleThreadOpen : undefined}
                onThreadClose={handleThreadClose}

                
                onReply={(message) => setReplyingTo(message)}

                
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
                onSlashCommand={handleSlashCommand}
                onCreateChecklist={() => setShowChecklistModal(true)}
                onCreatePoll={features.polls ? () => setShowPollModal(true) : undefined}
                features={features}
                
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
                blocked={blocked || blockedByOther || postingLocked}
                blockedNotice={blocked
                    ? 'You blocked this person. Unblock them from the ⋮ menu to send messages.'
                    : blockedByOther ? "You can't send messages to this person."
                        : postingLocked ? 'Only channel admins can post here. You can still reply in threads.' : null}
                setNewMessage={setNewMessage}

                
                onJoinChannel={handleJoinChannel}
                onIgnore={onClose}

                
                rawSocket={rawSocket}
                socket={socket}
                workspaceId={workspaceId}
                showThreadsOnly={showThreadsOnly}
                searchQuery={showSearch ? searchQuery : ''}

                
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

                
                showSmartReply={chat?.type === 'channel' || chat?.type === 'dm'}
                showScreenRecord={chat?.type === 'channel' || chat?.type === 'dm'}

                
                showBookmarks={showBookmarks}
                onCloseBookmarks={() => setShowBookmarks(false)}
            />

            {}
            <ErrorDisplay error={conversation.error} />

            {}
            <ModalRenderer
                activeModal={activeModal}
                onClose={() => { setActiveModal(null); setForwardingMessageId(null); setMessageInfo(null); }}
                modalProps={{
                    
                    onCreate: handleCreatePoll,
                    channelId: chat?.id,

                    
                    members: chat?.members || [],
                    channelName: chat?.name,
                    currentUserId,

                    
                    contact: chat,

                    
                    channel: chat,
                    workspaceId,
                    initialTab: activeModal?.startsWith('channel-') ? activeModal.replace('channel-', '') : 'settings',

                    
                    currentChatId: conversationId,
                    currentChatType: conversationType,
                    onForward: handleForward,

                    
                    messageInfo,
                    onRetryMessageInfo: messageInfo ? () => loadMessageInfo(messageInfo.msg) : undefined,
                }}
            />
            {}
            <CreatePollModal
                isOpen={showPollModal}
                onClose={() => setShowPollModal(false)}
                onCreatePoll={handleCreatePoll}
                channelName={chat?.name || ''}
            />
            {}
            {reminderMsg && (
                <ReminderPicker
                    messageId={reminderMsg._id || reminderMsg.id}
                    onClose={() => setReminderMsg(null)}
                    onSet={(_reminder, at) => showToast(`Reminder set for ${formatReminderTime(at)}`, 'success')}
                />
            )}
            {taskMsg && (
                <ConvertToTaskModal
                    msg={taskMsg}
                    onClose={() => setTaskMsg(null)}
                    onCreated={(task, title) => {
                        showToast(`Task created: ${title}`, 'success');
                        if (task?._id) patchEvent(taskMsg.id, { linkedTaskId: task._id });
                    }}
                />
            )}
            {summaryMsg && (
                <ThreadSummaryModal
                    msg={summaryMsg}
                    conversationId={conversationId}
                    conversationType={conversationType}
                    onClose={() => setSummaryMsg(null)}
                    showToast={showToast}
                />
            )}
            {historyMsg && (
                <MessageDiffViewer
                    msg={historyMsg}
                    conversationId={conversationId}
                    conversationType={conversationType}
                    currentUserId={currentUserId}
                    onClose={() => setHistoryMsg(null)}
                    onRestored={handleVersionRestored}
                    showToast={showToast}
                />
            )}
            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={() => { const id = confirmDeleteId; if (id) performDelete(id, 'everyone'); }}
                title="Delete for everyone"
                message="This message will be removed for everyone in this conversation. This cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
            {}
            <ContactPickerModal
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                onSelect={handleSendContact}
                workspaceId={workspaceId || activeWorkspace?.id}
            />
            {}
            {showMeetingModal && (
                <ScheduleMeetingModal
                    conversationId={conversationId}
                    conversationType={conversationType}
                    onSchedule={handleSendMeeting}
                    onClose={() => setShowMeetingModal(false)}
                />
            )}
            {}
            {showReminders && <RemindersPanel onClose={() => setShowReminders(false)} />}
            {showChecklistModal && (
                <CreateChecklistModal
                    onClose={() => setShowChecklistModal(false)}
                    onCreate={async (checklist) => {
                        const result = await actions.sendMessage({ type: 'checklist', checklist });
                        if (!result.success) {
                            showToast(result.message || result.error || 'Failed to send checklist', 'error');
                            throw new Error('send failed');
                        }
                        if (result.message) {
                            await conversation.addRealtimeEvent({
                                id: result.message._id,
                                type: 'checklist',
                                payload: { ...result.message, reactions: [], replyCount: 0, clientTempId: result.tempId },
                                checklist: result.message.checklist,
                                sender: result.message.sender,
                                createdAt: result.message.createdAt,
                            }, currentUserId);
                        }
                    }}
                />
            )}
            {showPinned && (chat?.type === 'channel' || chat?.type === 'dm') && (
                <PinnedMessagesPanel
                    channelId={chat.type === 'channel' ? chat.id : undefined}
                    dmSessionId={chat.type === 'dm' ? chat.id : undefined}
                    currentUserId={currentUserId}
                    onClose={() => setShowPinned(false)}
                    onJump={(id) => { setShowPinned(false); jumpToLoadedMessage(id); }}
                />
            )}
            {(chat?.type === 'channel' || chat?.type === 'dm') && (
                <HuddleOverlay
                    active={huddle.active}
                    participants={huddle.participants}
                    muted={huddle.muted}
                    channelName={chat?.name || ''}
                    onToggleMute={huddle.toggleMute}
                    onLeave={huddle.leaveHuddle}
                    isVideo={huddle.isVideo}
                    cameraOn={huddle.cameraOn}
                    onToggleCamera={huddle.toggleCamera}
                    localStream={huddle.localStream}
                    remoteStreams={huddle.remoteStreams}
                />
            )}
            {}
            {features.huddles && (chat?.type === 'channel' || chat?.type === 'dm') && huddle.huddleAnnouncement && !huddle.active && (
                <div data-testid="huddle-announcement" style={{
                    position: 'fixed', bottom: '16px', right: '16px', zIndex: 50,
                    display: 'flex', alignItems: 'center', gap: '12px',
                    backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
                    padding: '12px 16px', borderRadius: '2px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                    border: '1px solid var(--border-accent)',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    animation: 'fadeIn 200ms ease',
                }}>
                    <span style={{ color: '#34d399' }}>●</span>
                    <div style={{ fontSize: '13px' }}>
                        <span style={{ fontWeight: 600 }}>{huddle.huddleAnnouncement.startedBy?.username || 'Someone'}</span>
                        {' '}started a huddle
                    </div>
                    <button
                        onClick={() => { const a = huddle.huddleAnnouncement; huddle.dismissAnnouncement(); huddle.joinHuddle(a.huddleId, { video: a.video }); }}
                        style={{ fontSize: '12px', backgroundColor: '#16a34a', color: '#fff', padding: '4px 12px', borderRadius: '2px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#15803d'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                    >Join</button>
                    <button
                        onClick={huddle.dismissAnnouncement}
                        style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >✕</button>
                </div>
            )}
        </div>
    );
}

export default ChatWindowV2;
