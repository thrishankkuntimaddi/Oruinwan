// client/src/services/channelService.js
import api from './api';

export const channelService = {
    // Get user's channels for a specific workspace
    // Single canonical fetch — use this everywhere, not /api/workspaces/:id/channels
    getMyChannels: (workspaceId) => api.get(`/api/channels/my?workspaceId=${workspaceId}`),

    // Create new channel
    createChannel: (data) => api.post('/api/channels', data),

    // Update channel metadata (legacy — prefer PUT /:id/info for admin updates)
    updateChannel: (id, data) => api.put(`/api/channels/${id}`, data),

    // Delete channel
    deleteChannel: (id) => api.delete(`/api/channels/${id}`),

    // Join a public channel (member-invited / admin-added path)
    joinChannel: (id) => api.post(`/api/channels/${id}/join`),

    // Join a discoverable public channel (self-service discovery path)
    joinDiscoverableChannel: (id) => api.post(`/api/channels/${id}/join-discoverable`),

    // Exit a channel (was: /leave — corrected to /exit)
    exitChannel: (id) => api.post(`/api/channels/${id}/exit`),

    // Get channel members
    getChannelMembers: (id) => api.get(`/api/channels/${id}/members`),

    // Invite a user to channel (was: POST /:id/members — corrected to /:id/invite)
    inviteToChannel: (id, userId) => api.post(`/api/channels/${id}/invite`, { userId })
};
