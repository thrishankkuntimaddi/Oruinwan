/**
 * gcsProxy.js — Shared utility for converting GCS attachment URLs to
 * authenticated backend proxy URLs.
 *
 * The GCS bucket has Uniform Bucket-Level Access with no allUsers grant,
 * so direct public URLs (storage.googleapis.com/...) return AccessDenied.
 * All file access must go through: GET /api/v2/uploads/file?path=<gcsPath>
 */

const GCS_PREFIX = 'https://storage.googleapis.com/';

/**
 * Convert any attachment URL to the authenticated backend proxy URL.
 * Handles three cases:
 *   1. Already a proxy URL:  /api/v2/uploads/file?path=...   → return as-is
 *   2. Old public GCS URL:   https://storage.googleapis.com/<bucket>/<gcsPath> → convert
 *   3. gcsPath field on attachment → build proxy URL from it
 *
 * @param {object} attachment  — msg.attachment object { url, gcsPath, ... }
 * @returns {string}           — proxy URL safe to use in <img src>, <a href>, etc.
 */
export function toProxyUrl(attachment = {}) {
    const { url = '', gcsPath } = attachment;

    // Case 1 — already a proxy URL (new uploads)
    if (url.startsWith('/api/v2/uploads/file')) return url;

    // Case 2 — legacy public GCS URL
    if (url.startsWith(GCS_PREFIX)) {
        const withoutPrefix = url.slice(GCS_PREFIX.length);
        const slashIdx = withoutPrefix.indexOf('/');
        const objectPath = slashIdx >= 0 ? withoutPrefix.slice(slashIdx + 1) : withoutPrefix;
        return `/api/v2/uploads/file?path=${encodeURIComponent(objectPath)}`;
    }

    // Case 3 — gcsPath stored on the attachment document in MongoDB
    if (gcsPath) {
        return `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`;
    }

    // Fallback — return whatever we received
    return url;
}
