import axios from 'axios';
import sdkApiClient from '@platform/sdk/api/apiClient.js';

export const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

const api = axios.create({
    baseURL: API_BASE,
    
    
    
    
    withCredentials: true 
});

let isRefreshing = false;
let refreshQueue = [];
let onTokenRefreshed = null;

export const setOnTokenRefreshed = (callback) => {
    onTokenRefreshed = callback;
};

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
        
        
        
        
        const newToken = response.headers['x-access-token'];
        if (newToken) {
            localStorage.setItem('accessToken', newToken);
            if (onTokenRefreshed) onTokenRefreshed(newToken);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        
        if (error.response?.status !== 401) {
            return Promise.reject(error);
        }

        
        if (originalRequest._retry) {
            console.error('🔴 [API] Token still invalid after refresh — dispatching force-logout');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.dispatchEvent(new CustomEvent('auth:force-logout'));
            return Promise.reject(error);
        }

        
        originalRequest._retry = true;

        
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

        
        isRefreshing = true;

        
        
        
        
        const refreshTimeout = setTimeout(() => {
            if (isRefreshing) {
                console.warn('⚠️ [API] Refresh timeout (10s) — resetting isRefreshing and draining queue');
                isRefreshing = false;
                processQueue(new Error('Refresh timeout — server did not respond in 10s'), null);
            }
        }, 10000);

        try {

            
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

            
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            
            clearTimeout(refreshTimeout);
            processQueue(null, accessToken);
            if (onTokenRefreshed) {
                onTokenRefreshed(accessToken);
            }
            isRefreshing = false;

            
            return api(originalRequest);

        } catch (refreshError) {
            
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
