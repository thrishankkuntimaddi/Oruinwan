// Files shared in conversations and the workspace library: what kind each one is, how it is
// shown, and whether it can be uploaded. Limits match the server
// (server/src/modules/uploads/upload.controller.js) and the web client (client/src/utils/uploadFile.js).

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '100 MB';

// Refused by the server as well (programs and installers).
const BLOCKED_EXTENSIONS = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'vbe', 'jse', 'wsf', 'cpl']);

export const extOf = (name = '') => (String(name).includes('.') ? String(name).split('.').pop().toLowerCase() : '');

export function formatBytes(n) {
  const b = Number(n);
  if (!Number.isFinite(b) || b < 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** A reason the file can't be uploaded, or null. */
export function validateUpload(file) {
  if (!file) return 'No file selected';
  const name = file.name || 'File';
  if (!file.size) return `“${name}” is empty`;
  if (file.size > MAX_UPLOAD_BYTES) return `“${name}” is ${formatBytes(file.size)}. The limit is ${MAX_UPLOAD_LABEL}.`;
  if (BLOCKED_EXTENSIONS.has(extOf(file.name))) return 'Programs and installers can’t be shared.';
  return null;
}

// Images phone WebViews can't draw (HEIC, TIFF) or that are unsafe to draw (SVG) are files.
const NON_DISPLAYABLE = /^image\/(heic|heif|tiff|svg\+xml)/;

/**
 * How a file is shown: 'image' | 'video' | 'audio' | 'pdf' | 'file'.
 * `f` is an attachment or library file: { mimeType, name, type }.
 */
export function previewKind(f) {
  const mime = String(f?.mimeType || '').toLowerCase();
  const ext = extOf(f?.name);
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return NON_DISPLAYABLE.test(mime) ? 'file' : 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (!mime) {
    if (f?.type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
    if (f?.type === 'video' || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
    if (f?.type === 'voice' || f?.type === 'audio' || ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus'].includes(ext)) return 'audio';
  }
  return 'file';
}

/** Row icon in the Files list: 'image' | 'video' | 'audio' | 'pdf' | 'sheet' | 'doc'. */
export function fileIconKind(f) {
  const kind = previewKind(f);
  if (kind !== 'file') return kind;
  const t = `${f?.mimeType || ''} ${f?.name || ''}`.toLowerCase();
  if (/sheet|excel|csv|\.xlsx?\b|numbers/.test(t)) return 'sheet';
  return 'doc';
}

/** The message type the server stores for an uploaded attachment. */
export function messageTypeFor(attachment) {
  return ['image', 'video', 'voice', 'file'].includes(attachment?.type) ? attachment.type : 'file';
}

/** Pixel size of an image file, or null (used to reserve space before it loads). */
export function readImageSize(file) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !file || previewKind({ mimeType: file.type, name: file.name }) !== 'image') {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (v) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    img.onload = () => done(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => done(null);
    img.src = url;
  });
}

/** Display size for an image of width × height inside a max box, keeping its shape. */
export function fitBox(width, height, maxW = 240, maxH = 280) {
  if (!width || !height) return { width: maxW, height: Math.round(maxW * 0.66) };
  const scale = Math.min(1, maxW / width, maxH / height);
  return { width: Math.max(80, Math.round(width * scale)), height: Math.max(60, Math.round(height * scale)) };
}

/** "0:42", "12:05" for a duration in seconds. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
