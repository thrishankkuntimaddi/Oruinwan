// client/src/services/api.js
//
// Migration path:
//   services → api.js (this file) → platform/sdk/api/apiClient.js
//
// The existing axios instance, interceptors, and all original exports are kept
// intact. The SDK wrapper block at the bottom of this file introduces the new
// surface that future phases (and platform clients) will consume.

import axios from 'axios';
import sdkApiClient from '@platform/sdk/api/apiClient.js';

// Export API_BASE so components can import it instead of redefining
export const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true // Important for cookies
});

// ============================================
// TOKEN REFRESH QUEUE (PREVENTS RACE CONDITIONS)
// ============================================
let isRefreshing = false;
let refreshQueue = [];
let onTokenRefreshed = null;

export const setOnTokenRefreshed = (callback) => {
    onTokenRefreshed = callback;
};

// Process queued requests after token refresh
const processQueue = (error, token = null) => {
    refreshQueue.forEach(promise => {
        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(token);
        }
    });
    refreshQueue = [];
};

// ============================================
// REQUEST INTERCEPTOR - Add token to all requests
// ============================================
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// ============================================
// RESPONSE INTERCEPTOR - Handle token refresh
// ============================================
api.interceptors.response.use(
    (response) => {
        // Fix 2: Pick up inline-refreshed access token from server middleware.
        // middleware/auth.js auto-refreshes via cookie and sets x-access-token.
        // Without reading this header, localStorage stays stale → stale 401 →
        // concurrent refresh race → force-logout within the 10s rotation window.
        const newToken = response.headers['x-access-token'];
        if (newToken) {
            localStorage.setItem('accessToken', newToken);
            if (onTokenRefreshed) onTokenRefreshed(newToken);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // ❌ Not a 401? Pass through the error
        if (error.response?.status !== 401) {
            return Promise.reject(error);
        }

        // ❌ Already retried? Don't loop infinitely
        if (originalRequest._retry) {
            console.error('🔴 [API] Token still invalid after refresh — dispatching force-logout');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.dispatchEvent(new CustomEvent('auth:force-logout'));
            return Promise.reject(error);
        }

        // 🔄 First 401 - try to refresh
        originalRequest._retry = true;

        // 📋 If already refreshing, queue this request
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                refreshQueue.push({ resolve, reject });
            })
                .then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                })
                .catch(err => {
                    return Promise.reject(err);
                });
        }

        // 🔄 Start refresh process
        isRefreshing = true;

        // Fix 1: Safety net — reset isRefreshing after 10s if it gets stuck.
        // This can happen if axios.post throws before the try/catch runs (e.g.,
        // network timeout, CORS error, malformed JSON response). Without this,
        // all subsequent 401s queue forever and the app silently hangs / logs out.
        const refreshTimeout = setTimeout(() => {
            if (isRefreshing) {
                console.warn('⚠️ [API] Refresh timeout (10s) — resetting isRefreshing and draining queue');
                isRefreshing = false;
                processQueue(new Error('Refresh timeout — server did not respond in 10s'), null);
            }
        }, 10000);

        try {


            // Use POST for refresh (mutations should not use GET)
            const storedRefreshToken = localStorage.getItem('refreshToken');
            const response = await axios.post(`${API_BASE}/api/auth/refresh`,
                storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
                { withCredentials: true }
            );

            const { accessToken, refreshToken: newRefreshToken } = response.data;
            localStorage.setItem('accessToken', accessToken);
            if (newRefreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
            }

            // Update original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            // Process queue with new token
            clearTimeout(refreshTimeout);
            processQueue(null, accessToken);
            if (onTokenRefreshed) {
                onTokenRefreshed(accessToken);
            }
            isRefreshing = false;

            // Retry original request
            return api(originalRequest);

        } catch (refreshError) {
            // ❌ Refresh failed — session is truly dead
            console.error('🔴 [API] Refresh token expired or invalid — dispatching force-logout');
            clearTimeout(refreshTimeout);
            processQueue(refreshError, null);
            isRefreshing = false;

            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.dispatchEvent(new CustomEvent('auth:force-logout'));

            return Promise.reject(refreshError);
        }
    }
);

// ============================================
// EXPORT ENHANCED API
// ============================================
export default api;

// ============================================
// HELPER: Fetch-style wrapper (optional)
// ============================================
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

// ============================================
// POLL API FUNCTIONS
// ============================================

export const pollApi = {
    // Create a new poll
    create: async (channelId, pollData) => {
        return api.post('/api/polls', {
            channelId,
            ...pollData
        });
    },

    // Get polls for a channel
    getByChannel: async (channelId) => {
        return api.get(`/api/polls/channel/${channelId}`);
    },

    // Vote on a poll
    vote: async (pollId, optionIds) => {
        return api.post(`/api/polls/${pollId}/vote`, {
            optionIds
        });
    },

    // Delete a poll
    delete: async (pollId) => {
        return api.delete(`/api/polls/${pollId}`);
    },

    // Close a poll
    close: async (pollId) => {
        return api.patch(`/api/polls/${pollId}/close`);
    }
};

// ============================================================
// PLATFORM SDK — COMPATIBILITY WRAPPERS
// ============================================================
// These exports delegate to the framework-agnostic SDK client.
// They allow new code and future platform clients (desktop, mobile)
// to call the SDK surface while the existing services continue to
// use the axios-based `api` default export above.
//
// The axios system remains the primary transport for the web app
// until a later phase replaces it end-to-end.
// ============================================================

/** SDK-backed GET — framework-agnostic */
export const sdkGet = (url, opts) => sdkApiClient.get(url, opts);

/** SDK-backed POST — framework-agnostic */
export const sdkPost = (url, body, opts) => sdkApiClient.post(url, body, opts);

/** SDK-backed PUT — framework-agnostic */
export const sdkPut = (url, body, opts) => sdkApiClient.put(url, body, opts);

/** SDK-backed PATCH — framework-agnostic */
export const sdkPatch = (url, body, opts) => sdkApiClient.patch(url, body, opts);

/** SDK-backed DELETE — framework-agnostic */
export const sdkDelete = (url, opts) => sdkApiClient.delete(url, opts);

/** SDK-backed generic request — framework-agnostic */
export const request = (method, url, body, opts) => sdkApiClient.request(method, url, body, opts);
