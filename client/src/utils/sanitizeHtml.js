/**
 * Allowlist HTML sanitiser for rich text rendered with innerHTML (note text blocks,
 * PDF export). No dependencies: the markup is parsed into an inert document with
 * DOMParser (scripts never run, images never load there) and rebuilt from an
 * allowlist of tags and attributes. Mirrors server/src/shared/utils/sanitizeHtml.js.
 *
 *  - script/style/iframe/svg/... are removed with their content
 *  - other unknown tags are unwrapped (their text is kept)
 *  - only allowlisted attributes survive; on* handlers never do
 *  - href/src must be http(s)/mailto/tel or relative (img may use data:image/*)
 *  - style is dropped when it contains url(), expression(), javascript:, etc.
 */

const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
    'noscript', 'noembed', 'noframes', 'template', 'svg', 'math', 'xml', 'title',
    'textarea', 'select', 'option', 'button', 'form', 'head', 'base', 'meta', 'link',
    'input', 'video', 'audio', 'source', 'track', 'canvas', 'portal', 'dialog',
]);

const ALLOWED_TAGS = new Set([
    'a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'sub', 'sup', 'mark',
    'small', 'code', 'pre', 'kbd', 'br', 'hr', 'p', 'div', 'span', 'font', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
]);

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

/** true when the URL is relative or uses an allowed scheme. */
export function isSafeUrl(value, { allowDataImage = false } = {}) {
    // eslint-disable-next-line no-control-regex
    const v = String(value || '').replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
    if (!v) return false;
    if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp);/.test(v)) return true;
    const scheme = /^([a-z][a-z0-9+.-]*):/.exec(v);
    if (!scheme) return true;
    return ['http', 'https', 'mailto', 'tel'].includes(scheme[1]);
}

function isSafeStyle(value) {
    return !/(url\s*\(|expression|javascript|vbscript|@import|behavior|-moz-binding|[\\<>])/i.test(String(value || ''));
}

function cleanNode(node, doc) {
    const out = doc.createDocumentFragment();
    node.childNodes.forEach((child) => {
        if (child.nodeType === 3) { // text
            out.appendChild(doc.createTextNode(child.nodeValue));
            return;
        }
        if (child.nodeType !== 1) return; // comments, PIs, ...
        const tag = child.nodeName.toLowerCase();
        if (DROP_WITH_CONTENT.has(tag)) return;
        if (!ALLOWED_TAGS.has(tag)) {
            out.appendChild(cleanNode(child, doc));
            return;
        }
        const el = doc.createElement(tag);
        const allowed = TAG_ATTRS[tag];
        Array.from(child.attributes).forEach(({ name, value }) => {
            const n = name.toLowerCase();
            if (!GLOBAL_ATTRS.has(n) && !(allowed && allowed.has(n))) return;
            if (n === 'href' && !isSafeUrl(value)) return;
            if (n === 'src' && !isSafeUrl(value, { allowDataImage: tag === 'img' })) return;
            if (n === 'style' && !isSafeStyle(value)) return;
            if (n === 'target' && !/^_(blank|self)$/i.test(value)) return;
            el.setAttribute(n, value);
        });
        if (tag === 'a' && el.hasAttribute('target')) el.setAttribute('rel', 'noopener noreferrer');
        el.appendChild(cleanNode(child, doc));
        out.appendChild(el);
    });
    return out;
}

/** Returns a sanitised HTML string. */
export function sanitizeHtml(input) {
    if (input == null || input === '') return '';
    const html = String(input);
    if (typeof DOMParser === 'undefined') {
        // No DOM (should not happen in the browser): fall back to plain text.
        return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
    const target = document.implementation.createHTMLDocument('');
    const wrapper = target.createElement('div');
    wrapper.appendChild(cleanNode(parsed.body, target));
    return wrapper.innerHTML;
}

/** Plain text of an HTML fragment (for search and previews). */
export function htmlToText(input) {
    if (!input) return '';
    const s = String(input);
    if (typeof DOMParser === 'undefined') return s.replace(/<[^>]*>/g, ' ');
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${s}`, 'text/html');
    doc.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6').forEach((n) => n.append(' '));
    return (doc.body.textContent || '').replace(/​/g, '');
}

export default sanitizeHtml;
