// client/src/utils/deviceId.js

/**
 * Device ID Management for Phase 3
 * 
 * Purpose: Track browser/device sessions without creating device-specific identities
 * 
 * CRITICAL: Device ID is for AUTH sessions only, NOT crypto identities
 * - All devices share the same user identity keypair
 * - DeviceId is used for session tracking and revocation
 */

/**
 * Get or generate device ID (persisted in localStorage)
 * @returns {string} UUID v4
 */
export function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');

    if (!deviceId) {
        // Generate UUID v4
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
        console.log('🆔 [PHASE 3] Generated new device ID:', deviceId.substring(0, 8) + '...');
    }

    return deviceId;
}

/**
 * Clear device ID (on logout or revocation)
 */
export function clearDeviceId() {
    const deviceId = localStorage.getItem('deviceId');
    if (deviceId) {
        console.log('🗑️ [PHASE 3] Clearing device ID:', deviceId.substring(0, 8) + '...');
    }
    localStorage.removeItem('deviceId');
}

/**
 * Detect device name from user agent
 * @returns {string}
 */
export function getDeviceName() {
    const ua = navigator.userAgent;

    // Browser detection
    let browser = 'Unknown Browser';
    if (ua.includes('Chrome') && !ua.includes('Edge')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edge')) browser = 'Edge';

    // OS detection
    let os = 'Unknown OS';
    if (ua.includes('Mac OS X')) os = 'Mac';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return `${browser} on ${os}`;
}

/**
 * Detect platform
 * @returns {'web' | 'ios' | 'android' | 'unknown'}
 */
export function getPlatform() {
    const ua = navigator.userAgent;

    if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
    if (ua.includes('Android')) return 'android';

    return 'web';
}

/**
 * Get device metadata for login/signup
 * @returns {Object}
 */
export function getDeviceMetadata() {
    return {
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        platform: getPlatform()
    };
}
