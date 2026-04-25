import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChatSocket, useConversation, useMessageActions } from '../../../hooks';
import Header from './header/header.jsx';
import ChannelTabs from './tabs/ChannelTabs.jsx';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import { useContacts } from '../../../contexts/ContactsContext';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';

import CentralContentView from './views/CentralContentView.jsx';
import ErrorDisplay from './views/ErrorDisplay.jsx';
import ModalRenderer from './views/ModalRenderer.jsx';

import CreatePollModal from './modals/CreatePollModal.jsx';

import ContactPickerModal from './modals/ContactPickerModal.jsx';

import ScheduleMeetingModal from './modals/ScheduleMeetingModal.jsx';

import BookmarksPanel from './panels/BookmarksPanel.jsx';
import ReminderPicker from './modals/ReminderPicker.jsx';
import EditHistoryModal from './modals/EditHistoryModal.jsx';

import useHeaderActions from './hooks/useHeaderActions.js';
import useCanvasActions from './hooks/useCanvasActions.js';
import useMessageInput from './hooks/useMessageInput.js';

import { useLinkPreview } from './hooks/useLinkPreview.js';

import { useHuddle } from './hooks/useHuddle.js';
import HuddleOverlay from './huddle/HuddleOverlay.jsx';

import './chatWindow.css';

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
            console.error('Join channel error:', err);
            showToast(err.response?.data?.message || 'Failed to join channel', 'error');
        } finally {
            setIsJoining(false);
        }
    }, [chat, showToast, navigate, refreshContacts, activeWorkspace, onChatUpdate]);

    
    const [activeThread, setActiveThread] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
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
    
    const [messageInfoData, setMessageInfoData] = useState(null);
    
    const [showPollModal, setShowPollModal] = useState(false);
    
    const [showContactModal, setShowContactModal] = useState(false);
    
    const [showMeetingModal, setShowMeetingModal] = useState(false);
    
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [reminderMsgId, setReminderMsgId] = useState(null);
    const [historyMsg, setHistoryMsg] = useState(null);

    
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [muted, setMuted] = useState(false);
    const [blocked, setBlocked] = useState(false);

    
    React.useEffect(() => {
        if (chat?.type !== 'dm' || !chat?.id) return;
        api.get(`/api/v2/dm/${chat.id}/status`)
            .then(({ data }) => {
                setMuted(data.isMuted || false);
                setBlocked(data.isBlocked || false);
            })
            .catch(() => { }); 
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

    
    React.useEffect(() => {
        conversationRef.current = conversation;
    }, [conversation]);

    
    
    
    const headerActions = useHeaderActions({
        chat,
        showToast,
        onClose,
        onDeleteChat
    });

    
    const handleMuteToggle = React.useCallback(async () => {
        if (chat?.type !== 'dm') { setMuted(m => !m); return; }
        const next = await headerActions.handleMuteToggle(muted);
        setMuted(next);
    }, [chat?.type, headerActions, muted]);

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
                
                if (event.payload) {
                    conversationRef.current.updateEvent(event.payload.messageId || event.payload._id, {
                        
                        isPinned: true,
                        pinnedBy: event.payload.pinnedBy,
                        pinnedAt: event.payload.pinnedAt,
                        editedAt: event.payload.editedAt,
                        payload: {
                            ...event.payload,
                            isPinned: true
                        }
                    });
                }
                break;

            case 'message-unpinned':
                
                if (event.payload) {
                    conversationRef.current.updateEvent(event.payload.messageId || event.payload._id, {
                        
                        isPinned: false,
                        pinnedBy: null,
                        pinnedAt: null,
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

            case 'user-typing':
                
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

    
    const handleMessageChange = messageInputActions.handleMessageChange;
    const handleEmojiPick = messageInputActions.handleEmojiPick;
    const handleAttach = messageInputActions.handleAttach;

    
    const { preview: linkPreview, loading: linkPreviewLoading, clearPreview: clearLinkPreview } = useLinkPreview(newMessage);

    
    const handleSend = useCallback(async (markdown) => {
        
        

        
        const messageData = {
            text: markdown,
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
            console.error('[ChatWindowV2] handleSendAttachment error:', err);
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
            console.error('[ChatWindowV2] handleSendContact error:', err);
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
            }
        } catch (err) {
            console.error('[ChatWindowV2] handleSendMeeting error:', err);
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
            console.error('[ChatWindowV2] handleCreatePoll error:', err);
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

    
    const enhancedActions = useMemo(() => ({
        ...actions,
        sendMessage: handleSend,
        
        
        deleteMessage: async (messageId, scope = 'everyone') => {
            const result = await actions.deleteMessage(messageId, scope);
            if (result?.success && scope === 'me') {
                conversation.removeEvent(messageId);
            }
            return result;
        },
        
        forwardMessage: (messageId) => {
            setForwardingMessageId(messageId);
            setActiveModal('forward');
        },
        
        replyToMessage: (message) => {
            setReplyingTo(message);
        },
        
        infoMessage: async (messageId, decryptedText) => {
            try {
                const response = await api.get(`/api/v2/messages/${messageId}/info`);
                
                const data = response.data;
                if (decryptedText && data.message) {
                    data.message.text = decryptedText;
                }
                setMessageInfoData(data);
                setActiveModal('message-info');
            } catch (err) {
                console.error('[ChatWindowV2] Failed to fetch message info:', err);
            }
        },
        
        onRemind: (messageId) => setReminderMsgId(messageId),
        
        onShowHistory: (msg) => setHistoryMsg(msg),
        
        onConvertToTask: async (messageId) => {
            try {
                await api.post(`/api/v2/messages/${messageId}/convert-task`);
                showToast('Task created from message!', 'success');
            } catch (err) {
                showToast(err?.response?.data?.message || 'Failed to create task', 'error');
            }
        },
    }), [actions, handleSend, showToast]); 

    
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
                    const targetConversationId = target.id;
                    const targetType = target.type; 

                    const encrypted = await encryptMessageForSending(
                        plaintextToForward,
                        targetConversationId,
                        targetType,
                        null 
                    );

                    if (!encrypted || encrypted.status === 'ENCRYPTION_NOT_READY') {
                        throw new Error(`Encryption not ready for ${targetType}:${targetConversationId}`);
                    }

                    
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
                
                onStartHuddle={chat?.type === 'channel'
                    ? (huddle.active ? huddle.leaveHuddle : huddle.startHuddle)
                    : (huddle.active ? huddle.leaveHuddle : huddle.startHuddle)}
                huddleActive={huddle.active}
                onShowBookmarks={() => setShowBookmarks(true)}
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
                onThreadOpen={handleThreadOpen}
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
                onCreatePoll={() => setShowPollModal(true)}
                
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

                
                onJoinChannel={handleJoinChannel}
                onIgnore={onClose}

                
                rawSocket={rawSocket}
                socket={socket}
                workspaceId={workspaceId}
                showThreadsOnly={showThreadsOnly}

                
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

                
                showSmartReply={chat?.type === 'channel'}
                showScreenRecord={chat?.type === 'channel'}

                
                showBookmarks={showBookmarks}
                onCloseBookmarks={() => setShowBookmarks(false)}
            />

            {}
            <ErrorDisplay error={conversation.error} />

            {}
            <ModalRenderer
                activeModal={activeModal}
                onClose={() => { setActiveModal(null); setForwardingMessageId(null); }}
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

                    
                    messageInfoData,
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
            {reminderMsgId && (
                <ReminderPicker
                    messageId={reminderMsgId}
                    onClose={() => setReminderMsgId(null)}
                />
            )}
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
            {(chat?.type === 'channel' || chat?.type === 'dm') && (
                <HuddleOverlay
                    active={huddle.active}
                    participants={huddle.participants}
                    muted={huddle.muted}
                    channelName={chat?.name || ''}
                    onToggleMute={huddle.toggleMute}
                    onLeave={huddle.leaveHuddle}
                />
            )}
            {}
            {chat?.type === 'channel' && huddle.huddleAnnouncement && !huddle.active && (
                <div style={{
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
                        onClick={() => { huddle.joinHuddle(huddle.huddleAnnouncement.huddleId); huddle.dismissAnnouncement(); }}
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
