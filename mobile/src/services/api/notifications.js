import http from '../http';

export const fetchNotifications = (workspaceId, { page = 1, limit = 30, unreadOnly } = {}) =>
  http.get('/notifications', {
    params: { workspaceId, page, limit, ...(unreadOnly ? { unreadOnly: 'true' } : {}) },
  });
export const fetchUnreadCount = (workspaceId) =>
  http.get('/notifications/unread-count', { params: { workspaceId } });
export const markNotificationRead = (id) => http.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = (workspaceId) =>
  http.patch('/notifications/read-all', null, { params: { workspaceId } });

export const registerDeviceToken = (token, platform) => http.post('/push/register', { token, platform });
export const unregisterDeviceToken = (token) => http.post('/push/unregister', { token });
