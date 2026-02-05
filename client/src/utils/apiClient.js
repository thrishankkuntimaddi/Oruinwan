// client/src/utils/apiClient.js

/**
 * API Client with Device ID Support (Phase 3)
 * 
 * Wrapper around fetch to automatically include:
 * - Authorization header
 * - X-Device-ID header
 * - Handle DEVICE_REVOKED errors
 */

import { getDeviceId, clearDeviceId } from './deviceId';

/**
 * Authenticated fetch with device tracking
 * 
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
    const deviceId = getDeviceId();
    const accessToken = localStorage.getItem('accessToken');

    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include'
        });

        // ⚠️ PHASE 3: Handle device revocation
        if (response.status === 403) {
            const data = await response.json().catch(() => ({}));
            if (data.code === 'DEVICE_REVOKED') {
                console.error('❌ [PHASE 3] Device has been revoked');
                handleDeviceRevocation();
                throw new Error('DEVICE_REVOKED');
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
}

/**
 * Handle device revocation
 * - Clear device ID
 * - Clear tokens
 * - Redirect to login
 */
function handleDeviceRevocation() {
    // Clear device ID
    clearDeviceId();

    // Clear auth tokens
    localStorage.removeItem('accessToken');

    // Redirect to login with reason
    window.location.href = '/login?reason=device_revoked';
}
