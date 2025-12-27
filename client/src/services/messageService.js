// client/src/services/messageService.js
import api from './api';

export const messageService = {
    // Get chat list (Legacy/Global)
    getChatList: () => api.get('/api/chat/list'),

    // Get Workspace DMs
    getWorkspaceDMs: (workspaceId) => api.get(`/api/messages/workspace/${workspaceId}/dms`),

    // Get channel messages
    getChannelMessages: (channelId, limit = 50, before = null) => {
        const params = { limit };
        if (before) params.before = before;
        return api.get(`/api/messages/channel/${channelId}`, { params });
    },

    // Get DM messages
    getDMMessages: (userId, limit = 50, before = null) => {
        const params = { limit };
        if (before) params.before = before;
        return api.get(`/api/messages/dm/${userId}`, { params });
    },

    // Send message
    sendMessage: (data) => api.post('/api/messages', data),

    // Send broadcast message to multiple recipients
    sendBroadcast: async (workspaceId, recipientIds, message) => {
        // Send individual messages to each recipient using the correct endpoint
        const sendPromises = recipientIds.map(recipientId =>
            api.post('/api/messages/dm/send', {
                receiverId: recipientId,  // backend expects 'receiverId'
                workspaceId: workspaceId,
                text: message,             // backend expects 'text'
                attachments: []
            })
        );

        return Promise.all(sendPromises);
    },

    // Update message
    updateMessage: (id, data) => api.put(`/api/messages/${id}`, data),

    // Delete message
    deleteMessage: (id) => api.delete(`/api/messages/${id}`),

    // Get thread messages
    getThread: (messageId) => api.get(`/api/messages/thread/${messageId}`),

    // Get thread count
    getThreadCount: (messageId) => api.get(`/api/messages/${messageId}/thread-count`)
};
