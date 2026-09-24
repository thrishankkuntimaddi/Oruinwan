import axios from 'axios';
import sdkApiClient from '@platform/sdk/api/apiClient.js';
import logger from '../utils/logger';

export const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

const api = axios.create({
    baseURL: API_BASE,
    
    
    
    
    withCredentials: true 
});

let onTokenRefreshed = null;

export const setOnTokenRefreshed = (callback) => {
    onTokenRefreshed = callback;
};

const REFRESH_TIMEOUT_MS = 10000;

// Single in-flight refresh shared by the axios interceptor, AuthContext and
// SocketContext. Web refresh relies solely on the httpOnly `jwt` cookie.
let refreshPromise = null;

export function refreshAccessToken() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
        const response = await axios.post(
            `${API_BASE}/api/auth/refresh`,
            {},
            { withCredentials: true, timeout: REFRESH_TIMEOUT_MS }
        );
        const accessToken = response?.data?.accessToken;
        if (!accessToken) {
            throw new Error('Refresh response did not include an access token');
        }
        localStorage.setItem('accessToken', accessToken);
        if (onTokenRefreshed) onTokenRefreshed(accessToken);
        return accessToken;
    })();
    refreshPromise.then(
        () => { refreshPromise = null; },
        () => { refreshPromise = null; }
    );
    return refreshPromise;
}

// Auth endpoints whose 401s must never trigger a refresh (would loop or mask
// credential errors).
const NO_REFRESH_AUTH_PATHS = [
    '/api/auth/refresh',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/register',
    '/api/auth/signup',
];

// 401 bodies emitted by server/src/shared/middleware/auth.js (requireAuth).
const AUTH_MIDDLEWARE_401_MESSAGES = new Set([
    'No token',
    'Invalid access token',
    'Invalid refresh token',
    'Refresh token expired',
]);
const AUTH_MIDDLEWARE_401_CODES = new Set([
    'TOKEN_EXPIRED',
    'ACCESS_TOKEN_EXPIRED',
    'TOKEN_INVALID',
    'INVALID_TOKEN',
    'NO_TOKEN',
]);

const getRequestPath = (config) => {
    const url = config?.url || '';
    try {
        return new URL(url, API_BASE).pathname;
    } catch {
        return url.split('?')[0];
    }
};

export const isTokenExpiredResponse = (response) => {
    const data = response?.data;
    if (!data || typeof data !== 'object') return false;
    if (data.code && AUTH_MIDDLEWARE_401_CODES.has(data.code)) return true;
    return AUTH_MIDDLEWARE_401_MESSAGES.has(data.message);
};

export const shouldAttemptRefresh = (config, response) => {
    if (!config || response?.status !== 401) return false;
    const path = getRequestPath(config);
    if (NO_REFRESH_AUTH_PATHS.some(p => path.startsWith(p))) return false;
    // /api/auth/* routes return business-logic 401s (e.g. "Invalid password");
    // only refresh when the body is the auth middleware's token signal.
    if (path.startsWith('/api/auth/')) return isTokenExpiredResponse(response);
    return true;
};

const dispatchForceLogout = (err) => {
    if (err && typeof err === 'object') {
        if (err.__forceLogoutDispatched) return;
        err.__forceLogoutDispatched = true;
    }
    localStorage.removeItem('accessToken');
    window.dispatchEvent(new CustomEvent('auth:force-logout'));
};

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => {
        const newToken = response.headers?.['x-access-token'];
        if (newToken) {
            localStorage.setItem('accessToken', newToken);
            if (onTokenRefreshed) onTokenRefreshed(newToken);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (!shouldAttemptRefresh(originalRequest, error.response)) {
            return Promise.reject(error);
        }

        if (originalRequest._retry) {
            logger.error('🔴 [API] Token still invalid after refresh — dispatching force-logout');
            dispatchForceLogout(error);
            return Promise.reject(error);
        }
        originalRequest._retry = true;

        let accessToken;
        try {
            accessToken = await refreshAccessToken();
        } catch (refreshError) {
            logger.error('🔴 [API] Refresh token expired or invalid — dispatching force-logout');
            dispatchForceLogout(refreshError);
            return Promise.reject(refreshError);
        }

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
    }
);

export default api;

export const apiFetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const data = options.body;

    const response = await api({
        url,
        method,
        headers,
        data
    });
    return response;
};

export const pollApi = {
    
    create: async (channelId, pollData) => {
        return api.post('/api/polls', {
            channelId,
            ...pollData
        });
    },

    
    getByChannel: async (channelId) => {
        return api.get(`/api/polls/channel/${channelId}`);
    },

    
    vote: async (pollId, optionIds) => {
        return api.post(`/api/polls/${pollId}/vote`, {
            optionIds
        });
    },

    
    delete: async (pollId) => {
        return api.delete(`/api/polls/${pollId}`);
    },

    
    close: async (pollId) => {
        return api.patch(`/api/polls/${pollId}/close`);
    }
};

export const sdkGet = (url, opts) => sdkApiClient.get(url, opts);

export const sdkPost = (url, body, opts) => sdkApiClient.post(url, body, opts);

export const sdkPut = (url, body, opts) => sdkApiClient.put(url, body, opts);

export const sdkPatch = (url, body, opts) => sdkApiClient.patch(url, body, opts);

export const sdkDelete = (url, opts) => sdkApiClient.delete(url, opts);

export const request = (method, url, body, opts) => sdkApiClient.request(method, url, body, opts);
