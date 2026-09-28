'use strict';

/**
 * Conservative allowlist HTML sanitiser (no dependencies).
 *
 * - Elements whose content is itself dangerous (script, style, iframe, svg, ...) are
 *   removed together with their content.
 * - Every other tag is rebuilt from scratch: tags outside ALLOWED_TAGS are dropped
 *   (their text is kept), and only allowlisted attributes survive. Event handlers
 *   (on*), srcdoc, formaction, etc. are therefore never emitted.
 * - URL attributes must use http(s)/mailto/tel or be relative; img may also use
 *   data:image/(png|jpeg|gif|webp). Entity-encoded / whitespace-obfuscated schemes
 *   ("jav&#x61;script:") are decoded before the check.
 * - style is kept only when it contains no url(), expression(), javascript:, @import,
 *   backslashes or angle brackets.
 * - A stray "<" or ">" in text is escaped, comments/CDATA are removed.
 *
 * The client also sanitises on render; this is the server-side belt.
 */

const DROP_WITH_CONTENT = [
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
    'noscript', 'noembed', 'noframes', 'template', 'svg', 'math', 'xml', 'title',
    'textarea', 'select', 'option', 'button', 'form', 'head', 'base', 'meta', 'link',
];

const ALLOWED_TAGS = new Set([
    'a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'sub', 'sup', 'mark',
    'small', 'code', 'pre', 'kbd', 'br', 'hr', 'p', 'div', 'span', 'font', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const GLOBAL_ATTRS = new Set(['class', 'title', 'dir', 'style', 'data-block-id']);
const TAG_ATTRS = {
    a: new Set(['href', 'target', 'rel']),
    img: new Set(['src', 'alt', 'width', 'height']),
    font: new Set(['color', 'size', 'face']),
    td: new Set(['colspan', 'rowspan', 'align']),
    th: new Set(['colspan', 'rowspan', 'align']),
    p: new Set(['align']),
    div: new Set(['align']),
    ol: new Set(['start', 'type']),
    li: new Set(['value']),
};

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^>]*)?)\/?>/g;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function decodeEntities(str) {
    return String(str)
        .replace(/&#x([0-9a-f]+);?/gi, (_, h) => safeFromCode(parseInt(h, 16)))
        .replace(/&#(\d+);?/g, (_, d) => safeFromCode(parseInt(d, 10)))
        .replace(/&colon;/gi, ':')
        .replace(/&tab;/gi, '\t')
        .replace(/&newline;/gi, '\n')
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&');
}

function safeFromCode(n) {
    if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return '';
    try { return String.fromCodePoint(n); } catch { return ''; }
}

function escapeAttr(v) {
    return String(v).replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
        .replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** true when the URL is relative or uses an allowed scheme. */
function isSafeUrl(value, { allowDataImage = false } = {}) {
    const v = decodeEntities(value).replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
    if (!v) return false;
    if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp);/.test(v)) return true;
    const scheme = /^([a-z][a-z0-9+.-]*):/.exec(v);
    if (!scheme) return true; // relative or protocol-relative
    return ['http', 'https', 'mailto', 'tel'].includes(scheme[1]);
}

function isSafeStyle(value) {
    const v = decodeEntities(value).toLowerCase();
    return !/(url\s*\(|expression|javascript|vbscript|@import|behavior|-moz-binding|[\\<>])/.test(v);
}

function cleanAttributes(tag, raw) {
    const allowed = TAG_ATTRS[tag];
    const out = [];
    const seen = new Set();
    let m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(raw || ''))) {
        const name = m[1].toLowerCase();
        if (seen.has(name)) continue;
        if (!GLOBAL_ATTRS.has(name) && !(allowed && allowed.has(name))) continue;
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        if (name === 'href' && !isSafeUrl(value)) continue;
        if (name === 'src' && !isSafeUrl(value, { allowDataImage: tag === 'img' })) continue;
        if (name === 'style' && !isSafeStyle(value)) continue;
        if (name === 'target' && !/^_(blank|self)$/i.test(value)) continue;
        seen.add(name);
        out.push(`${name}="${escapeAttr(value)}"`);
    }
    if (tag === 'a' && seen.has('target')) {
        const relIdx = out.findIndex(a => a.startsWith('rel='));
        const rel = 'rel="noopener noreferrer"';
        if (relIdx >= 0) out[relIdx] = rel; else out.push(rel);
    }
    return out.length ? ` ${out.join(' ')}` : '';
}

function escapeText(text) {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeHtml(input) {
    if (input == null) return '';
    let html = String(input);

    // Comments, CDATA, processing instructions, doctype.
    html = html.replace(/<!--[\s\S]*?(-->|$)/g, '')
        .replace(/<!\[CDATA\[[\s\S]*?(\]\]>|$)/gi, '')
        .replace(/<[!?][^>]*>?/g, '');

    // Dangerous elements with their content; repeat until stable (nested tricks).
    const dropRe = new RegExp(`<(${DROP_WITH_CONTENT.join('|')})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
    const dropOpenRe = new RegExp(`<\\/?(${DROP_WITH_CONTENT.join('|')})\\b[^>]*>?`, 'gi');
    for (let i = 0, prev = null; i < 10 && prev !== html; i++) {
        prev = html;
        html = html.replace(dropRe, '').replace(dropOpenRe, '');
    }

    let out = '';
    let last = 0;
    TAG_RE.lastIndex = 0;
    let m;
    while ((m = TAG_RE.exec(html))) {
        out += escapeText(html.slice(last, m.index));
        last = TAG_RE.lastIndex;
        const closing = m[1] === '/';
        const tag = m[2].toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) continue;
        if (closing) {
            if (!VOID_TAGS.has(tag)) out += `</${tag}>`;
            continue;
        }
        out += `<${tag}${cleanAttributes(tag, m[3])}>`;
    }
    out += escapeText(html.slice(last));
    return out;
}

module.exports = { sanitizeHtml, isSafeUrl };
