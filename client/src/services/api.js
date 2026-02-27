// client/src/services/api.js
import axios from 'axios';

// Export API_BASE so components can import it instead of redefining
export const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

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
    (response) => response,
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

        try {


            // Use POST for refresh (mutations should not use GET)
            const response = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
                withCredentials: true
            });

            const { accessToken } = response.data;
            localStorage.setItem('accessToken', accessToken);


            // Update original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            // Process queue with new token
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
            processQueue(refreshError, null);
            isRefreshing = false;

            localStorage.removeItem('accessToken');
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
