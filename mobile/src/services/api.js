/**
 * Chttrix Mobile — API Service
 * Centralised Axios client for all REST API calls to the Chttrix backend.
 */
import axios from 'axios';
import { getToken } from './storage';

// Default backend URL — override via environment variable if needed
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// ─── Response interceptor: handle 401 ────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — could trigger logout here if needed
      console.warn('[API] 401 Unauthorised — token may have expired');
    }
    return Promise.reject(error);
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const logout = () =>
  api.post('/auth/logout');

export const getMe = () =>
  api.get('/auth/me');

// ──────────────────────────────────────────────────────────────────────────────
// Messages
// ──────────────────────────────────────────────────────────────────────────────
export const fetchMessages = (dmSessionId) =>
  api.get(`/messages/dm/${dmSessionId}`);

export const fetchChannelMessages = (channelId) =>
  api.get(`/messages/channel/${channelId}`);

export const sendMessage = (payload) =>
  api.post('/messages', payload);

// ──────────────────────────────────────────────────────────────────────────────
// DM Sessions
// ──────────────────────────────────────────────────────────────────────────────
export const fetchDMSessions = (workspaceId) =>
  api.get(`/dm-sessions?workspaceId=${workspaceId}`);

// ──────────────────────────────────────────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────────────────────────────────────────
export const fetchTasks = (workspaceId) =>
  api.get(`/tasks?workspaceId=${workspaceId}`);

export const createTask = (payload) =>
  api.post('/tasks', payload);

export const updateTask = (taskId, updates) =>
  api.patch(`/tasks/${taskId}`, updates);

// ──────────────────────────────────────────────────────────────────────────────
// Push Notifications — Device Token Registration
// ──────────────────────────────────────────────────────────────────────────────
export const registerDeviceToken = (token, platform) =>
  api.post('/push/register', { token, platform });

export const unregisterDeviceToken = (token) =>
  api.post('/push/unregister', { token });

export default api;
