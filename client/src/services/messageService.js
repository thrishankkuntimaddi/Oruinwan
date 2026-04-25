import api from './api';

export const messageService = {
    
    getChatList: () => api.get('/api/chat/list'),

    
    getWorkspaceDMs: (workspaceId) => api.get(`/api/v2/messages/workspace/${workspaceId}/dms`),

    
    getChannelMessages: (channelId, limit = 50, before = null) => {
        const params = { limit };
        if (before) params.before = before;
        return api.get(`/api/v2/messages/channel/${channelId}`, { params });
    },

    
    getDMMessages: (workspaceId, dmSessionId, limit = 50, before = null) => {
        const params = { limit };
        if (before) params.before = before;
        return api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${dmSessionId}`, { params });
    },

    
    sendDirectMessage: (data) => api.post('/api/v2/messages/direct', data),

    
    sendChannelMessage: (data) => api.post('/api/v2/messages/channel', data),

    
    sendBroadcast: async (workspaceId, recipientIds, message) => {
        const sendPromises = recipientIds.map(recipientId =>
            api.post('/api/v2/messages/direct', {
                receiverId: recipientId,
                workspaceId: workspaceId,
                text: message,
                attachments: []
            })
        );

        return Promise.all(sendPromises);
    },

    
    updateMessage: (id, data) => api.patch(`/api/v2/messages/${id}`, data),

    
    
    deleteMessage: (id, scope = 'everyone', socketId = null) => {
        const headers = socketId ? { 'x-socket-id': socketId } : {};
        return api.delete(`/api/v2/messages/${id}`, {
            data: { scope },
            headers
        });
    },

    
    getThread: (messageId) => api.get(`/api/v2/messages/thread/${messageId}`),

    
    getThreadCount: (messageId) => api.get(`/api/v2/messages/${messageId}/thread-count`),

    
    getMissedMessages: (conversationId, type, lastSeenMessageId = null) => {
        const params = { conversationId, type };
        if (lastSeenMessageId) params.lastSeenMessageId = lastSeenMessageId;
        return api.get('/api/v2/messages/missed', { params });
    }
};
