import { useMediaUrl, getMediaUrl } from '../../../../utils/mediaUrl';
import { uploadNoteAttachment } from '../../../../utils/uploadHelpers';
import { isSafeUrl } from '../../../../utils/sanitizeHtml';

/**
 * Media blocks store the URL the upload API returned
 * (`/api/v2/uploads/file?path=notes/...`), an external http(s) URL, or (images only)
 * a data:image URL. Stored files need a signed URL before <img>/<video>/<audio> can load them.
 */
export function isStoredFile(url) {
    return typeof url === 'string' && url.startsWith('/api/v2/uploads/file');
}

/** { url, error } ready for a media element; url is null while signing. */
export function useBlockMediaUrl(content, { allowDataImage = false } = {}) {
    const stored = isStoredFile(content);
    const signed = useMediaUrl(stored ? { url: content } : null);
    const noop = () => {};
    if (!content) return { url: null, error: null, onMediaError: noop };
    // Signed links expire after a few minutes: a media element that fails re-signs once.
    if (stored) return { ...signed, onMediaError: signed.attempt < 1 ? signed.refresh : noop };
    if (!isSafeUrl(content, { allowDataImage })) return { url: null, error: new Error('Unsupported URL'), onMediaError: noop };
    return { url: content, error: null, onMediaError: noop };
}

export function fileNameOf(block, fallback = 'file') {
    if (block?.meta?.name) return block.meta.name;
    const content = String(block?.content || '');
    if (isStoredFile(content)) {
        const path = new URLSearchParams(content.split('?')[1] || '').get('path') || '';
        return path.split('/').pop() || fallback;
    }
    try { return decodeURIComponent(new URL(content).pathname.split('/').pop()) || fallback; } catch { return fallback; }
}

/** Download a block's file with its original name. External URLs open in a new tab. */
export async function downloadBlockFile(block) {
    const content = block?.content;
    if (!content) return;
    const name = fileNameOf(block);
    if (!isStoredFile(content)) {
        if (content.startsWith('data:image/')) {
            triggerDownload(content, name);
            return;
        }
        if (isSafeUrl(content)) window.open(content, '_blank', 'noopener,noreferrer');
        return;
    }
    const url = await getMediaUrl({ url: content });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blobUrl = URL.createObjectURL(await res.blob());
    triggerDownload(blobUrl, name);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

function triggerDownload(href, name) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

/**
 * Upload a file for a block and report progress. Resolves { url, name, size, mimeType }.
 * Throws an Error whose message is the server's.
 */
export async function uploadBlockFile(file, { workspaceId, noteId, blockId, setUploadProgress }) {
    const clear = () => setUploadProgress(prev => {
        const next = { ...prev };
        delete next[blockId];
        return next;
    });
    setUploadProgress(prev => ({ ...prev, [blockId]: 0 }));
    try {
        const result = await uploadNoteAttachment(file, workspaceId, noteId, (p) => {
            setUploadProgress(prev => ({ ...prev, [blockId]: p }));
        });
        return { url: result.url, name: result.originalName || file.name, size: result.size ?? file.size, mimeType: result.mimeType || file.type };
    } catch (error) {
        throw new Error(error?.response?.data?.message || 'Upload failed');
    } finally {
        clear();
    }
}

export function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shared token styles for media blocks. */
export const mediaStyles = {
    frame: { width: '100%', maxWidth: '672px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', position: 'relative', overflow: 'hidden' },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px', gap: '12px' },
    emptyLabel: { fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 },
    primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 16px', background: 'var(--accent)', color: '#0c0c0c', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)' },
    secondaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 16px', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)' },
    input: { width: '100%', padding: '7px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' },
    iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px', background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer' },
    progressTrack: { width: '192px', height: '4px', background: 'var(--bg-active)', borderRadius: '2px', overflow: 'hidden' },
    error: { fontSize: '12px', color: 'var(--state-danger)', padding: '16px', margin: 0 },
};
