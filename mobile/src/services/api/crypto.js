import http from '../http';

export const fetchIdentityState = () => http.get('/v2/crypto/identity');
export const fetchConversationKey = (conversationId, type) =>
  http.get(`/v2/conversations/${conversationId}/keys`, { params: { type } });
export const fetchWorkspaceConversationKeys = (workspaceId) =>
  http.get(`/v2/conversations/workspace/${workspaceId}/keys`);
export const storeConversationKeys = (conversationId, body) =>
  http.post(`/v2/conversations/${conversationId}/keys`, body);
export const fetchPublicKeys = (userIds) => http.post('/v2/identity/public-keys', { userIds });
export const repairKeyAccess = () => http.post('/v2/conversations/repair-access');
