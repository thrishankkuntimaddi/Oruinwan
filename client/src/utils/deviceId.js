export function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');

    if (!deviceId) {
        
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
        console.log('🆔 [PHASE 3] Generated new device ID:', deviceId.substring(0, 8) + '...');
    }

    return deviceId;
}

export function clearDeviceId() {
    const deviceId = localStorage.getItem('deviceId');
    if (deviceId) {
        console.log('🗑️ [PHASE 3] Clearing device ID:', deviceId.substring(0, 8) + '...');
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
