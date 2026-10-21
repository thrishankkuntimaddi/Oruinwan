import { getDeviceId } from '../../utils/deviceId';

/** "Mac", "Windows", … from a user agent. */
function osName(ua, touch) {
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac OS X|Macintosh/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux|CrOS/.test(ua)) return 'Linux';
    return 'computer';
}

function browserName(ua) {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Browser';
}

/**
 * Which device this call runs on, sent with huddle:start / huddle:join:
 * { id, label, platform }. The id is this browser's device id, so two tabs of the
 * same browser count as one device (a new tab just takes the call over).
 */
export function callDevice(win = typeof window !== 'undefined' ? window : undefined) {
    let id = null;
    try { id = getDeviceId(); } catch { /* storage blocked: no stable id */ }
    const nav = win?.navigator || {};
    const ua = nav.userAgent || '';
    const os = osName(ua, nav.maxTouchPoints || 0);
    if (win?.oruinwanDesktop) return { id, label: `Desktop app on ${os}`, platform: 'desktop' };
    const native = win?.Capacitor?.getPlatform?.();
    if (native === 'android') return { id, label: 'Android tablet', platform: 'android' };
    if (native === 'ios') return { id, label: os === 'iPad' ? 'iPad' : 'iPhone', platform: 'ios' };
    return { id, label: `${browserName(ua)} on ${os}`, platform: 'web' };
}

/** "Desktop app on Mac" → shown as "your Desktop app on Mac". */
export function deviceLabel(device) {
    return device?.label || 'another device';
}
