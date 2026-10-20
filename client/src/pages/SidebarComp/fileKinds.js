// What kind of file this is, for icons and labels. Shared by the Files page and the Files side panel.
import { Image, Film, Music, FileText, FileSpreadsheet, Presentation, FileType, Archive, Paperclip } from 'lucide-react';

const KINDS = [
    { test: (m) => m.startsWith('image/'), Icon: Image, label: 'Image' },
    { test: (m) => m.startsWith('video/'), Icon: Film, label: 'Video' },
    { test: (m) => m.startsWith('audio/'), Icon: Music, label: 'Audio' },
    { test: (m) => m.includes('pdf'), Icon: FileText, label: 'PDF' },
    { test: (m) => m.includes('spreadsheet') || m.includes('excel') || m.includes('csv'), Icon: FileSpreadsheet, label: 'Spreadsheet' },
    { test: (m) => m.includes('presentation') || m.includes('powerpoint'), Icon: Presentation, label: 'Slides' },
    { test: (m) => m.includes('word') || m.includes('document') || m.startsWith('text/'), Icon: FileType, label: 'Document' },
    { test: (m) => m.includes('zip') || m.includes('compressed') || m.includes('tar'), Icon: Archive, label: 'Archive' },
];
const OTHER = { Icon: Paperclip, label: 'File' };

/** { Icon, label } for a MIME type. */
export function fileKind(mimeType = '') {
    const m = String(mimeType || '').toLowerCase();
    return KINDS.find((k) => k.test(m)) || OTHER;
}

export function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fired after an upload or delete so the page and the side panel reload each other's list. */
export const FILES_CHANGED = 'oruinwan:files-changed';
export const announceFilesChanged = (source) => window.dispatchEvent(new CustomEvent(FILES_CHANGED, { detail: { source } }));
