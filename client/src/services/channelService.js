import api from './api';

export const channelService = {
    
    
    
    getWorkspaceChannels: (workspaceId) => api.get(`/api/workspaces/${workspaceId}/channels`),

    
    getMyChannels: (workspaceId) => api.get(`/api/workspaces/${workspaceId}/channels`),

    
    createChannel: (data) => api.post('/api/channels', data),

    
    updateChannel: (id, data) => api.put(`/api/channels/${id}`, data),

    
    deleteChannel: (id) => api.delete(`/api/channels/${id}`),

    
    joinChannel: (id) => api.post(`/api/channels/${id}/join`),

    
    joinDiscoverableChannel: (id) => api.post(`/api/channels/${id}/join-discoverable`),

    
    exitChannel: (id) => api.post(`/api/channels/${id}/exit`),

    
    getChannelMembers: (id) => api.get(`/api/channels/${id}/members`),

    
    inviteToChannel: (id, userId) => api.post(`/api/channels/${id}/invite`, { userId })
};
