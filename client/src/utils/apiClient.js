import { getDeviceId, clearDeviceId } from './deviceId';

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

function handleDeviceRevocation() {
    
    clearDeviceId();

    
    localStorage.removeItem('accessToken');

    
    window.location.href = '/login?reason=device_revoked';
}
