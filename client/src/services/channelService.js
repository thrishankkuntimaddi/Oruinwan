// client/src/services/channelService.js
import api from './api';

export const channelService = {
    // Get user's channels
    getMyChannels: () => api.get('/api/channels/my'),

    // Get all channels (workspace)
    getAllChannels: () => api.get('/api/chat/channels'),

    // Get public channels
    getPublicChannels: () => api.get('/api/chat/channels/public'),

    // Create new channel
    createChannel: (data) => api.post('/api/channels', data),

    // Update channel
    updateChannel: (id, data) => api.put(`/api/channels/${id}`, data),

    // Delete channel
    deleteChannel: (id) => api.delete(`/api/channels/${id}`),

    // Join channel
    joinChannel: (id) => api.post(`/api/channels/${id}/join`),

    // Leave channel
    leaveChannel: (id) => api.post(`/api/channels/${id}/leave`),

    // Get channel members
    getChannelMembers: (id) => api.get(`/api/channels/${id}/members`),

    // Add member to channel
    addMember: (id, userId) => api.post(`/api/channels/${id}/members`, { userId })
};
