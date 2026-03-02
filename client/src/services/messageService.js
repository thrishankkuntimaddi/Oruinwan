// client/src/services/messageService.js
/**
 * Message Service - API v2
 * 
 * Migrated to use /api/v2/messages/* endpoints
 * Canonical /api/v2/messages/* endpoints
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

    // Update message (v2 - PATCH)
    updateMessage: (id, data) => api.patch(`/api/v2/messages/${id}`, data),

    // Delete message (v2)
    deleteMessage: (id) => api.delete(`/api/v2/messages/${id}`),

    // Get thread messages (v2)
    getThread: (messageId) => api.get(`/api/v2/messages/thread/${messageId}`),

    // Get thread count (v2)
    getThreadCount: (messageId) => api.get(`/api/v2/messages/${messageId}/thread-count`),

    // Offline recovery: fetch messages sent after lastSeenMessageId (or latest 50 if null)
    getMissedMessages: (conversationId, type, lastSeenMessageId = null) => {
        const params = { conversationId, type };
        if (lastSeenMessageId) params.lastSeenMessageId = lastSeenMessageId;
        return api.get('/api/v2/messages/missed', { params });
    }
};

