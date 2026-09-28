// Helpers for recording voice notes, video notes and screen recordings with
// MediaRecorder. Chrome/Firefox record WebM (Opus/VP8/VP9); Safari records MP4 (AAC/H.264).

const CANDIDATES = {
    audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac'],
    video: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'],
};

/** Best supported recording type for 'audio' | 'video', or '' to let the browser choose. */
export function pickRecordingMimeType(kind) {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return (CANDIDATES[kind] || []).find((t) => {
        try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || '';
}

export function extensionForMime(mime = '') {
    const m = String(mime).toLowerCase();
    if (m.includes('mp4')) return m.startsWith('audio') ? 'm4a' : 'mp4';
    if (m.includes('ogg')) return 'ogg';
    if (m.includes('aac')) return 'aac';
    return 'webm';
}

/** The base type without codec parameters ("audio/webm;codecs=opus" -> "audio/webm"). */
export const baseMime = (mime = '') => String(mime).split(';')[0].trim();

export function canRecord() {
    return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** Plain-language explanation of a getUserMedia / MediaRecorder failure. */
export function describeMediaError(err, kind = 'microphone') {
    const device = kind === 'camera' ? 'camera' : 'microphone';
    switch (err?.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return `${device === 'camera' ? 'Camera' : 'Microphone'} access is blocked. Allow it in your browser’s site settings, then try again.`;
        case 'NotFoundError':
        case 'OverconstrainedError':
            return `No ${device} found. Connect one and try again.`;
        case 'NotReadableError':
        case 'AbortError':
            return `Your ${device} is in use by another app or tab.`;
        case 'NotSupportedError':
            return 'Recording isn’t supported in this browser.';
        default:
            return `Couldn’t start the ${device}${err?.message ? ` (${err.message})` : ''}.`;
    }
}

export const formatClock = (s) => {
    const n = Math.max(0, Math.floor(Number(s) || 0));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};
