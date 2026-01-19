// client/src/services/messageService.js
/**
 * Message Service - API v2
 * 
 * Migrated to use /api/v2/messages/* endpoints
 * Legacy /api/messages/* endpoints still available for backward compatibility
 */
import api from './api';

export const messageService = {
    // Get chat list (Legacy/Global - no v2 equivalent yet)
    getChatList: () => api.get('/api/chat/list'),

    // Get Workspace DMs
    getWorkspaceDMs: (workspaceId) => api.get(`/api/v2/messages/workspace/${workspaceId}/dms`),

    // Get channel messages
    getChannelMessages: (channelId, limit = 50, before = null) => {
        const params = { limit };
        if (before) params.before = before;
        return api.get(`/api/v2/messages/channel/${channelId}`, { params });
    },

    // Get DM messages by session ID
    getDMMessages: (workspaceId, dmSessionId, limit = 50, before = null) => {
        const params = { limit };
        if (before) params.before = before;
        return api.get(`/api/v2/messages/workspace/${workspaceId}/dm/${dmSessionId}`, { params });
    },

    // Send direct message (v2)
    sendDirectMessage: (data) => api.post('/api/v2/messages/direct', data),

    // Send channel message (v2)
    sendChannelMessage: (data) => api.post('/api/v2/messages/channel', data),

    // Send broadcast message to multiple recipients
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

    // Update message (still using v1 - no v2 endpoint yet)
    updateMessage: (id, data) => api.put(`/api/messages/${id}`, data),

    // Delete message (still using v1 - no v2 endpoint yet)
    deleteMessage: (id) => api.delete(`/api/messages/${id}`),

    // Get thread messages (still using v1 - no v2 endpoint yet)
    getThread: (messageId) => api.get(`/api/messages/thread/${messageId}`),

    // Get thread count (still using v1 - no v2 endpoint yet)
    getThreadCount: (messageId) => api.get(`/api/messages/${messageId}/thread-count`)
};

