import api from '@services/api';
import { getMediaUrl } from './mediaUrl';

// Same limit as the server (server/src/modules/uploads/upload.controller.js).
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '100 MB';

// Refused by the server as well (programs and installers).
const BLOCKED_EXTENSIONS = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'vbe', 'jse', 'wsf', 'cpl']);

const extOf = (name = '') => (String(name).includes('.') ? String(name).split('.').pop().toLowerCase() : '');

export function formatBytes(n) {
    const b = Number(n);
    if (!Number.isFinite(b) || b < 0) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Image formats that most browsers can't show in a message (sent as a file instead). */
export function isNonDisplayableImage(file) {
    const t = String(file?.type || '').toLowerCase();
    const ext = extOf(file?.name);
    return /^image\/(heic|heif|tiff|svg\+xml)/.test(t) || ['heic', 'heif', 'tif', 'tiff', 'svg'].includes(ext);
}

/** A reason the file can't be uploaded, or null. */
export function validateUpload(file) {
    if (!file) return 'No file selected';
    if (file.size === 0) return `“${file.name || 'File'}” is empty`;
    if (file.size > MAX_UPLOAD_BYTES) return `“${file.name || 'File'}” is ${formatBytes(file.size)} — the limit is ${MAX_UPLOAD_LABEL}`;
    if (BLOCKED_EXTENSIONS.has(extOf(file.name))) return 'Programs and installers can’t be shared';
    return null;
}

/** A plain-language message for a failed upload. */
export function describeUploadError(err) {
    if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError') return 'Cancelled';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'You’re offline — it will retry when you reconnect';
    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
    if (status === 413) return serverMsg || `File too large (max ${MAX_UPLOAD_LABEL})`;
    if (status === 415) return serverMsg || 'This file type is not allowed';
    if (status === 403) return serverMsg || 'File sharing is turned off here';
    if (!err?.response) return 'Network error — check your connection and retry';
    return serverMsg || 'Upload failed';
}

/** Pixel size of an image file (EXIF orientation applied), or null. */
export function readImageSize(file) {
    return new Promise((resolve) => {
        if (!file || !String(file.type).startsWith('image/') || isNonDisplayableImage(file)) { resolve(null); return; }
        const url = URL.createObjectURL(file);
        const img = new Image();
        const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
        img.onload = () => done(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
        img.onerror = () => done(null);
        img.src = url;
    });
}

/**
 * Upload one file for a conversation. Resolves with the attachment the server returns
 * ({ url, name, size, mimeType, type, gcsPath, ... }).
 * @param {object} opts { conversationId, conversationType, onProgress(0..100), signal }
 */
export async function uploadFile(file, { conversationId, conversationType = 'channel', onProgress, signal, filename } = {}) {
    const problem = validateUpload(file);
    if (problem) throw Object.assign(new Error(problem), { userMessage: problem, noRetry: true });
    const formData = new FormData();
    if (filename) formData.append('file', file, filename);
    else formData.append('file', file);
    formData.append('conversationType', conversationType || 'channel');
    if (conversationId) formData.append('conversationId', conversationId);
    const { data } = await api.post('/api/v2/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
        onUploadProgress: (e) => {
            if (!onProgress) return;
            const total = e.total || file.size || 1;
            onProgress(Math.min(100, Math.round((e.loaded / total) * 100)));
        },
    });
    return data;
}

/** Download a stored attachment with its real name (the <a download> attribute is ignored cross-origin). */
export async function downloadAttachment(attachment) {
    const url = await getMediaUrl(attachment);
    if (!url) throw new Error('No file');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = attachment?.name || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
