/**
 * Choosing what MediaRecorder writes. The server accepts .webm, .mp4 and .m4a
 * (see docs/api/meetings.md, Recordings).
 */

const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4'];
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a', 'audio/mp4'];

/** Whether this browser can record at all. */
export function canRecord(Recorder = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined) {
    return typeof Recorder === 'function';
}

/** The first MIME type the recorder supports for this kind of recording, or '' (browser default). */
export function pickRecorderMime(Recorder, { video = false } = {}) {
    if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return '';
    const list = video ? VIDEO_TYPES : AUDIO_TYPES;
    return list.find((t) => { try { return Recorder.isTypeSupported(t); } catch { return false; } }) || '';
}

/** "video/webm;codecs=vp9,opus" -> "video/webm" (what the upload is labelled as). */
export function baseMime(mime, { video = false } = {}) {
    const base = String(mime || '').split(';')[0].trim().toLowerCase();
    if (base) return base;
    return video ? 'video/webm' : 'audio/webm';
}

/** File extension the server accepts for a base MIME type. */
export function extensionFor(mime) {
    const base = baseMime(mime);
    if (base === 'audio/mp4') return 'm4a';
    if (base.endsWith('/mp4')) return 'mp4';
    return 'webm';
}

/** "call-2026-10-21-1430.webm" */
export function recordingFileName(mime, date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    return `call-${stamp}.${extensionFor(mime)}`;
}

export const MAX_RECORDING_BYTES = 500 * 1024 * 1024;

/** "12.4 MB" */
export function formatBytes(n) {
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
    if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
    return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
