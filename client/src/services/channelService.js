// client/src/services/channelService.js
import api from './api';

export const channelService = {
    // ─── Canonical channel list ───────────────────────────────────────────────
    // Gets channels for a workspace including membership flags (isMember, isDiscoverable).
    // ChannelsPanel and useChannels both call this same endpoint.
    getWorkspaceChannels: (workspaceId) => api.get(`/api/workspaces/${workspaceId}/channels`),

    // Backward-compat alias — points to the same richer workspace endpoint.
    getMyChannels: (workspaceId) => api.get(`/api/workspaces/${workspaceId}/channels`),

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
