// client/src/services/messageService.js
import api from './api';

export const messageService = {
    // Get chat list
    getChatList: () => api.get('/api/chat/list'),

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

    // Update message
    updateMessage: (id, data) => api.put(`/api/messages/${id}`, data),

    // Delete message
    deleteMessage: (id) => api.delete(`/api/messages/${id}`),

    // Get thread messages
    getThread: (messageId) => api.get(`/api/messages/thread/${messageId}`),

    // Get thread count
    getThreadCount: (messageId) => api.get(`/api/messages/${messageId}/thread-count`)
};
