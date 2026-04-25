import axios from 'axios';
import { getToken } from './storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.warn('[API] 401 Unauthorised — token may have expired');
    }
    return Promise.reject(err);
  }
);

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const logoutApi = () =>
  api.post('/auth/logout');

export const getMe = () =>
  api.get('/auth/me');

export const fetchMyWorkspaces = () =>
  api.get('/workspaces/my');

export const fetchWorkspaceChannels = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/channels`);

export const fetchWorkspaceMembers = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/members`);

export const fetchChannelMessages = (channelId) =>
  api.get(`/messages/channel/${channelId}`);

export const fetchDMMessages = (dmSessionId) =>
  api.get(`/messages/dm/${dmSessionId}`);

export const fetchDMSessions = (workspaceId) =>
  api.get(`/dm-sessions${workspaceId ? `?workspaceId=${workspaceId}` : ''}`);

export const fetchTasks = (workspaceId) =>
  api.get(`/tasks${workspaceId ? `?workspaceId=${workspaceId}` : ''}`);

export const createTask = (payload) =>
  api.post('/tasks', payload);

export const updateTask = (taskId, updates) =>
  api.patch(`/tasks/${taskId}`, updates);

export const registerDeviceToken = (token, platform) =>
  api.post('/push/register', { token, platform });

export const unregisterDeviceToken = (token) =>
  api.post('/push/unregister', { token });

export default api;
