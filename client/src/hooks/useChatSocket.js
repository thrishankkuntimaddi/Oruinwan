import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext'; 

export function useChatSocket(conversationId, conversationType, eventHandler) {
    const { socket } = useSocket();
    const { encryptionReady } = useAuth(); 
    const eventHandlerRef = useRef(eventHandler); 
    
    const lastEventHashRef = useRef(new Set()); 
    const wasDisconnectedRef = useRef(false);  

    
    useEffect(() => {
        eventHandlerRef.current = eventHandler;
    }, [eventHandler]);

    
    const joinConversation = useCallback(() => {
        
        
        
        
        
        if (conversationType === 'dm') {
            return; 
        }

        if (!conversationId || !conversationType) {
            return;
        }

        

        
        if (!encryptionReady) {
            return;
        }

        
        if (!socket?.connected) {
            return;
        }

        
        socket.emit('chat:join', conversationId, (response) => {
            if (response?.error) {
                console.error(`❌[chat: join] Failed to join ${conversationType}: ${response.error} `, response);

                
                if (response.code === 'UNAUTHORIZED') {
                    console.error(`🚫[chat: join] Not authorized to join channel ${conversationId} `);
                    eventHandlerRef.current?.({
                        type: 'join-error',
                        payload: {
                            error: response.error,
                            code: response.code,
                            conversationId
                        }
                    });
                }
            } else if (response?.success) {
                
            }
        });
    }, [socket, conversationId, conversationType, encryptionReady]); 

    
    const leaveConversation = useCallback(() => {
        if (conversationType === 'dm') {
            return;
        }

        if (!socket || !conversationId) return;

        
        if (socket.connected) {
            socket.emit('chat:leave', { conversationId });
        }
    }, [socket, conversationId, conversationType]);

    
    useEffect(() => {
        
        if (encryptionReady && socket?.connected && conversationId) {
            joinConversation();
        }

        return () => {
            if (socket?.connected && conversationId) {
                socket.emit('chat:leave', conversationId);
            }
        };
    }, [socket, conversationId, conversationType, encryptionReady, joinConversation]); 

    
    const emitTyping = useCallback((isTyping) => {
        if (!socket || !conversationId) return;

        socket.emit('chat:typing', {
            channelId: conversationId,
            isTyping
        });
    }, [socket, conversationId]);

    
    const markAsRead = useCallback((messageIds) => {
        if (!socket || !conversationId || !messageIds?.length) return;

        socket.emit('messages:mark-read', {
            conversationId,
            conversationType,
            messageIds
        });
    }, [socket, conversationId, conversationType]);

    
    useEffect(() => {
        if (!socket || !conversationId) return;

        
        const handleConnect = () => {
            joinConversation();
            
            
            if (wasDisconnectedRef.current) {
                wasDisconnectedRef.current = false;
                eventHandlerRef.current?.({
                    type: 'reconnect',
                    payload: { conversationId }
                });
            }
        };

        const handleDisconnect = () => {
            wasDisconnectedRef.current = true;
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        

        const handleNewMessage = (data) => {
            
            const message = data.message || data;

            
            const messageChannelId = message.channelId || message.channel?._id || message.channel;
            const messageDmId = message.dmId || message.dm?._id || message.dm;

            
            const messageConversationId = conversationType === 'dm' ? messageDmId : messageChannelId;

            
            
            
            if (messageConversationId !== conversationId) {
                return; 
            }

            
            
            if (message.parentId) {
                eventHandlerRef.current?.({
                    type: 'thread-reply',
                    payload: data
                });
                return; 
            }

            eventHandlerRef.current?.({
                type: 'new-message',
                payload: data
            });
        };

        const handleMessageSent = (data) => {
            eventHandlerRef.current?.({
                type: 'message-sent',
                payload: data
            });
        };

        
        const handleThreadReply = (data) => {

            
            eventHandlerRef.current?.({
                type: 'thread-reply',
                payload: data
            });
        };

        
        const handleThreadCreated = (data) => {

            
            eventHandlerRef.current?.({
                type: 'thread:created',
                payload: data
            });
        };

        const handleSendError = (data) => {
            eventHandlerRef.current?.({
                type: 'send-error',
                payload: data
            });
        };

        const handleMessageDeleted = (data) => {
            eventHandlerRef.current?.({
                type: 'message-deleted',
                payload: data
            });
        };

        const handleMessageHidden = (data) => {
            
            eventHandlerRef.current?.({
                type: 'message-hidden',
                payload: data
            });
        };

        const handleMessageEdited = async (data) => {
            
            const msgId = data._id || data.id;

            
            
            
            let newDecryptedContent = null;

            if (data.text) {
                
                newDecryptedContent = data.text;
            } else if (data.payload?.ciphertext && data.payload?.messageIv) {
                
                try {
                    const { batchDecryptMessages } = await import('../services/messageEncryptionService');
                    const fake = [{ id: msgId, type: 'message', payload: data.payload }];
                    const decrypted = await batchDecryptMessages(fake, conversationId, conversationType, null);
                    newDecryptedContent = decrypted[0]?.decryptedContent || null;
                } catch (_) {  }
            }

            
            
            eventHandlerRef.current?.({
                type: 'message-updated',
                payload: {
                    messageId: msgId,
                    updates: {
                        ...(newDecryptedContent && {
                            text: newDecryptedContent,
                            decryptedContent: newDecryptedContent,
                        }),
                        editedAt: data.editedAt,
                        
                        editHistory: data.editHistory || [],
                        
                        ...(data.payload?.ciphertext && {
                            payload: {
                                ciphertext: data.payload.ciphertext,
                                messageIv: data.payload.messageIv,
                                isEncrypted: true
                            }
                        })
                    }
                }
            });
        };

        const handleMessageUpdated = (data) => {
            eventHandlerRef.current?.({
                type: 'message-updated',
                payload: data
            });
        };

        const handleMessagePinned = (data) => {
            eventHandlerRef.current?.({
                type: 'message-pinned',
                payload: data
            });
        };

        const handleMessageUnpinned = (data) => {
            eventHandlerRef.current?.({
                type: 'message-unpinned',
                payload: data
            });
        };

        

        const handleReactionAdded = (data) => {
            
            eventHandlerRef.current?.({
                type: 'reaction-added',
                payload: data
            });
        };

        const handleReactionRemoved = (data) => {
            
            eventHandlerRef.current?.({
                type: 'reaction-removed',
                payload: data
            });
        };

        

        const handleUserTyping = (data) => {
            eventHandlerRef.current?.({
                type: 'user-typing',
                payload: data
            });
        };

        

        const handlePollCreated = (data) => {
            eventHandlerRef.current?.({
                type: 'poll-created',
                payload: data
            });
        };

        const handlePollUpdated = (data) => {
            eventHandlerRef.current?.({
                type: 'poll-updated',
                payload: data
            });
        };

        const handlePollRemoved = (data) => {
            eventHandlerRef.current?.({
                type: 'poll-removed',
                payload: data
            });
        };

        

        const handleChannelUpdated = (data) => {
            eventHandlerRef.current?.({
                type: 'channel-updated',
                payload: data
            });
        };

        const handleMemberJoined = (data) => {
            eventHandlerRef.current?.({
                type: 'member-joined',
                payload: data
            });
        };

        const handleMemberLeft = (data) => {
            eventHandlerRef.current?.({
                type: 'member-left',
                payload: data
            });
        };

        

        const handleMessageRead = (data) => {
            eventHandlerRef.current?.({
                type: 'message-read',
                payload: data
            });
        };

        
        socket.on('new-message', handleNewMessage);
        socket.on('thread-reply', handleThreadReply); 
        socket.on('thread:created', handleThreadCreated); 
        socket.on('message-sent', handleMessageSent);
        socket.on('send-error', handleSendError);
        socket.on('message-deleted', handleMessageDeleted);
        socket.on('message:deleted', handleMessageDeleted);   
        socket.on('message:hidden', handleMessageHidden);     
        socket.on('message-updated', handleMessageUpdated);
        socket.on('message:edited', handleMessageEdited);     
        socket.on('message-pinned', handleMessagePinned);
        socket.on('message-unpinned', handleMessageUnpinned);

        socket.on('reaction-added', handleReactionAdded);
        socket.on('reaction-removed', handleReactionRemoved);
        socket.on('message:reaction_added', handleReactionAdded);   
        socket.on('message:reaction_removed', handleReactionRemoved); 

        socket.on('chat:user_typing', handleUserTyping);

        socket.on('poll:new', handlePollCreated);
        socket.on('poll:updated', handlePollUpdated);
        socket.on('poll:removed', handlePollRemoved);

        socket.on('channel-updated', handleChannelUpdated);
        socket.on('member-joined', handleMemberJoined);
        socket.on('member-left', handleMemberLeft);

        socket.on('message-read', handleMessageRead);

        
        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('thread-reply', handleThreadReply); 
            socket.off('thread:created', handleThreadCreated); 
            socket.off('message-sent', handleMessageSent);
            socket.off('send-error', handleSendError);
            socket.off('message-deleted', handleMessageDeleted);
            socket.off('message:deleted', handleMessageDeleted);
            socket.off('message:hidden', handleMessageHidden);
            socket.off('message-updated', handleMessageUpdated);
            socket.off('message:edited', handleMessageEdited);
            socket.off('message-pinned', handleMessagePinned);
            socket.off('message-unpinned', handleMessageUnpinned);

            socket.off('reaction-added', handleReactionAdded);
            socket.off('reaction-removed', handleReactionRemoved);
            socket.off('message:reaction_added', handleReactionAdded);
            socket.off('message:reaction_removed', handleReactionRemoved);

            socket.off('chat:user_typing', handleUserTyping);

            socket.off('poll:new', handlePollCreated);
            socket.off('poll:updated', handlePollUpdated);
            socket.off('poll:removed', handlePollRemoved);

            socket.off('channel-updated', handleChannelUpdated);
            socket.off('member-joined', handleMemberJoined);
            socket.off('member-left', handleMemberLeft);

            socket.off('message-read', handleMessageRead);

            
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);

            
            leaveConversation();
        };
    }, [socket, conversationId, conversationType, joinConversation, leaveConversation]);

    return {
        connected: socket?.connected || false,
        joinConversation,
        leaveConversation,
        emitTyping,
        markAsRead
    };
}
