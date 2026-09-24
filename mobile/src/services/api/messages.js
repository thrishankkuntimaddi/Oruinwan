import http from '../http';

export const fetchChannelMessages = (channelId, params = {}) =>
  http.get(`/v2/messages/channel/${channelId}`, { params });

export const fetchChannelJumpAnchor = (channelId, dayStart, dayEnd) =>
  http.get(`/v2/messages/channel/${channelId}/jump-anchor`, { params: { dayStart, dayEnd } });

export const fetchDMSessions = (workspaceId) =>
  http.get(`/v2/messages/workspace/${workspaceId}/dms`);

/** dmId may be a DM session id or the other user's id (session is created). */
export const fetchDMMessages = (workspaceId, dmId, params = {}) =>
  http.get(`/v2/messages/workspace/${workspaceId}/dm/${dmId}`, { params });

export const sendChannelMessageApi = (body) => http.post('/v2/messages/channel', body);
export const sendDirectMessageApi = (body) => http.post('/v2/messages/direct', body);
