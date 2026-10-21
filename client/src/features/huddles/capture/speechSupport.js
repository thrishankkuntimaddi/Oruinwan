/**
 * Live captions use the browser's own speech-to-text (Web Speech API). Each
 * person transcribes only their own microphone, on their own device.
 */

/** The SpeechRecognition constructor of this browser, or null. */
export function getSpeechRecognition(win = typeof window !== 'undefined' ? window : undefined) {
    if (!win) return null;
    return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/**
 * Whether live captions can run here, and if not, a sentence saying why.
 * Electron exposes webkitSpeechRecognition but has no speech service behind it,
 * so the desktop app is reported as unsupported instead of failing later.
 */
export function speechSupport(win = typeof window !== 'undefined' ? window : undefined) {
    const nav = win?.navigator;
    const ua = String(nav?.userAgent || '');
    if (/Electron\//.test(ua)) {
        return { supported: false, reason: 'Live captions are not available in the desktop app. Open Oruinwan in Chrome, Edge or Safari to turn them on.' };
    }
    if (!getSpeechRecognition(win)) {
        return { supported: false, reason: 'This browser has no speech recognition, so it cannot make live captions. Chrome, Edge and Safari can.' };
    }
    if (win && win.isSecureContext === false) {
        return { supported: false, reason: 'Live captions need a secure (https) connection.' };
    }
    return { supported: true, reason: '' };
}

/** A short message for a SpeechRecognition `error` event code. `fatal` stops captions. */
export function speechErrorInfo(code) {
    switch (code) {
        case 'no-speech':
        case 'aborted':
            return { fatal: false, message: '' };
        case 'not-allowed':
        case 'service-not-allowed':
            return { fatal: true, message: 'The browser blocked speech recognition. Allow microphone access for this site and try again.' };
        case 'audio-capture':
            return { fatal: true, message: 'No microphone was available for live captions.' };
        case 'network':
            return { fatal: true, message: 'The browser’s speech service could not be reached, so live captions stopped.' };
        case 'language-not-supported':
            return { fatal: true, message: 'Live captions do not support your browser language.' };
        default:
            return { fatal: false, message: code ? `Live captions hit a problem (${code}).` : '' };
    }
}
