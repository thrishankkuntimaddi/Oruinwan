import http from '../http';

export const fetchMyWorkspaces = () => http.get('/workspaces/my');
export const fetchWorkspaceChannels = (workspaceId) => http.get(`/workspaces/${workspaceId}/channels`);
export const fetchWorkspaceMembers = (workspaceId) => http.get(`/workspaces/${workspaceId}/members`);
export const joinChannelApi = (channelId) => http.post(`/channels/${channelId}/join`);
