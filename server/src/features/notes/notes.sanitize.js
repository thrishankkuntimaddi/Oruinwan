'use strict';

/**
 * Server-side sanitising of note content before it is stored.
 *
 * The web editor stores content as a JSON array of blocks:
 *   [{ id, type: 'text'|'heading'|'code'|'image'|..., content, meta }]
 * Only `text` blocks carry HTML (rendered via innerHTML), so only those are run
 * through the HTML sanitiser; code/heading/etc. are rendered as text by the client
 * and are left untouched (a code block may legitimately contain "<script>").
 * Media blocks carry a URL, which must be http(s)/relative/data:image.
 * Content that is not a JSON block array (legacy/plain HTML) is sanitised as HTML.
 */

const { sanitizeHtml, isSafeUrl } = require('../../shared/utils/sanitizeHtml');

const HTML_BLOCK_TYPES = new Set(['text']);
const URL_BLOCK_TYPES = new Set(['image', 'video', 'audio', 'file', 'embed']);

function sanitizeBlock(block) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return block;
    const b = { ...block };
    if (typeof b.content === 'string') {
        if (HTML_BLOCK_TYPES.has(b.type)) b.content = sanitizeHtml(b.content);
        else if (URL_BLOCK_TYPES.has(b.type) && b.content && !isSafeUrl(b.content, { allowDataImage: b.type === 'image' })) b.content = '';
    }
    if (b.meta && typeof b.meta === 'object') {
        const meta = { ...b.meta };
        for (const k of ['url', 'src', 'href']) {
            if (typeof meta[k] === 'string' && meta[k] && !isSafeUrl(meta[k], { allowDataImage: true })) meta[k] = '';
        }
        b.meta = meta;
    }
    return b;
}

function sanitizeNoteContent(content) {
    if (content == null) return '';
    const str = String(content);
    const trimmed = str.trim();
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return JSON.stringify(parsed.map(sanitizeBlock));
        } catch { /* not JSON: fall through to HTML */ }
    }
    return sanitizeHtml(str);
}

module.exports = { sanitizeNoteContent, sanitizeBlock };
