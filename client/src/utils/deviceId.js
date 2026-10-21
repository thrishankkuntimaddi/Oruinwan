import logger from './logger';
export function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');

    if (!deviceId) {
        
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
        logger.debug('🆔 [PHASE 3] Generated new device ID:', deviceId.substring(0, 8) + '...');
    }

    return deviceId;
}

/**
 * Keep a device id the server made (X-Device-Id on a sign-in answer) when this
 * browser has none of its own yet, so later requests send the same id.
 */
export function adoptDeviceId(id) {
    try {
        if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(id)) return false;
        if (localStorage.getItem('deviceId')) return false;
        localStorage.setItem('deviceId', id);
        return true;
    } catch {
        return false;
    }
}

export function clearDeviceId() {
    const deviceId = localStorage.getItem('deviceId');
    if (deviceId) {
        logger.debug('🗑️ [PHASE 3] Clearing device ID:', deviceId.substring(0, 8) + '...');
    }
    localStorage.removeItem('deviceId');
}

export function getDeviceName() {
    const ua = navigator.userAgent;

    
    let browser = 'Unknown Browser';
    if (ua.includes('Chrome') && !ua.includes('Edge')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edge')) browser = 'Edge';

    
    let os = 'Unknown OS';
    if (ua.includes('Mac OS X')) os = 'Mac';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return `${browser} on ${os}`;
}

export function getPlatform() {
    const ua = navigator.userAgent;

    if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
    if (ua.includes('Android')) return 'android';

    return 'web';
}

export function getDeviceMetadata() {
    return {
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        platform: getPlatform()
    };
}
