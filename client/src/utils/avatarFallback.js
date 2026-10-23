// Many screens draw profile pictures with a plain <img>. When one fails to load (a Google photo
// that refuses our referrer, a deleted upload, offline), swap it for the person's initial so
// nobody sees a broken-image icon. Only round images (avatars) are touched, never attachments.

const FALLBACK_FLAG = 'data-avatar-fallback';

/** An SVG data URL with the first letter of `name` on the theme colour. */
export function initialsDataUrl(name = '') {
    const letter = (String(name).trim().charAt(0) || '?').toUpperCase()
        .replace(/[&<>"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
        + `<rect width="64" height="64" fill="#3a3027"/>`
        + `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="30" font-weight="700" fill="#e8d3b5">${letter || '?'}</text>`
        + `</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** True for images drawn as avatars: round, or marked as one. */
export function looksLikeAvatar(img, getStyle = (el) => globalThis.getComputedStyle?.(el)) {
    if (!img || img.tagName !== 'IMG') return false;
    if (img.dataset?.avatar !== undefined) return true;
    const cls = typeof img.className === 'string' ? img.className : '';
    if (/\b(rounded-full|avatar)\b/i.test(cls)) return true;
    const radius = getStyle(img)?.borderRadius || img.style?.borderRadius || '';
    return /50%|9999px|999px/.test(radius);
}

const RETRY_FLAG = 'data-avatar-retried';

/**
 * Handles one image error. Google profile photos refuse requests that carry our referrer, so
 * those are retried once without it ('retried'); otherwise the initials go in ('fallback').
 * Returns false when the image is left alone.
 */
export function handleImageError(img, getStyle) {
    if (!looksLikeAvatar(img, getStyle) || img.hasAttribute(FALLBACK_FLAG)) return false;
    const src = img.getAttribute('src') || '';
    if (/googleusercontent\.com/i.test(src) && !img.hasAttribute(RETRY_FLAG) && img.referrerPolicy !== 'no-referrer') {
        img.setAttribute(RETRY_FLAG, '');
        img.referrerPolicy = 'no-referrer';
        img.src = src;
        return 'retried';
    }
    img.setAttribute(FALLBACK_FLAG, '');
    img.removeAttribute('srcset');
    img.src = initialsDataUrl(img.alt || img.title || img.getAttribute('aria-label') || '');
    return true;
}

/** Listens for image errors anywhere on the page (error events don't bubble, so capture). */
export function installAvatarFallback(doc = globalThis.document) {
    if (!doc?.addEventListener) return () => {};
    const onError = (e) => { try { handleImageError(e.target); } catch { /* never break the page */ } };
    doc.addEventListener('error', onError, true);
    return () => doc.removeEventListener('error', onError, true);
}
