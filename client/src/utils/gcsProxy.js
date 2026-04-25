const GCS_PREFIX = 'https://storage.googleapis.com/';

export function toProxyUrl(attachment = {}) {
    const { url = '', gcsPath } = attachment;

    
    if (url.startsWith('/api/v2/uploads/file')) return url;

    
    if (url.startsWith(GCS_PREFIX)) {
        const withoutPrefix = url.slice(GCS_PREFIX.length);
        const slashIdx = withoutPrefix.indexOf('/');
        const objectPath = slashIdx >= 0 ? withoutPrefix.slice(slashIdx + 1) : withoutPrefix;
        return `/api/v2/uploads/file?path=${encodeURIComponent(objectPath)}`;
    }

    
    if (gcsPath) {
        return `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`;
    }

    
    return url;
}
