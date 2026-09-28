'use strict';

const dns = require('dns').promises;
const { URL } = require('url');
const net = require('net');

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 1024 * 1024;

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return false;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true; // multicast / reserved / broadcast
    return false;
}

function isPrivateIP(ip) {
    const addr = String(ip || '').replace(/^\[|\]$/g, '').toLowerCase();
    if (net.isIPv4(addr)) return isPrivateIPv4(addr);
    if (!net.isIPv6(addr)) return false;
    if (addr === '::' || addr === '::1') return true;
    // IPv4-mapped / -compatible (::ffff:127.0.0.1, ::ffff:7f00:1)
    const mapped = addr.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    const hexMapped = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
        const hi = parseInt(hexMapped[1], 16);
        const lo = parseInt(hexMapped[2], 16);
        return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(addr.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    return false;
}

async function assertNotSSRF(rawUrl) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }

    const { protocol } = parsed;
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

    if (!['http:', 'https:'].includes(protocol)) throw new Error('Only http/https URLs are allowed');
    if (parsed.username || parsed.password) throw new Error('Blocked URL: credentials in URL');

    const blocked = ['localhost', 'metadata.google.internal', '169.254.169.254'];
    const lower = hostname.toLowerCase();
    if (blocked.includes(lower) || lower.endsWith('.localhost') || lower.endsWith('.internal')) {
        throw new Error('Blocked URL: internal host');
    }

    // An IP address in the URL is checked directly (DNS lookups of an IP return nothing).
    if (net.isIP(hostname)) {
        if (isPrivateIP(hostname)) throw new Error('Blocked URL: private address');
        return parsed;
    }

    let addresses = [];
    try {
        const [ipv4, ipv6] = await Promise.allSettled([
            dns.resolve4(hostname).catch(() => []),
            dns.resolve6(hostname).catch(() => []),
        ]);
        addresses = [...(ipv4.value || []), ...(ipv6.value || [])];
    } catch { throw new Error('Could not resolve hostname'); }
    if (addresses.length === 0) throw new Error('Could not resolve hostname');

    for (const addr of addresses) {
        if (net.isIP(addr) && isPrivateIP(addr)) throw new Error('Blocked URL: resolves to private IP');
    }
    return parsed;
}

/**
 * Fetch the page HTML, following redirects one hop at a time so every hop is checked
 * (an external page must not be able to redirect the server to an internal address).
 */
async function fetchPageHtml(url, fetchImpl = fetch) {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        await assertNotSSRF(current);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        let res;
        try {
            res = await fetchImpl(current, {
                redirect: 'manual',
                signal: ctrl.signal,
                headers: {
                    'User-Agent': 'Oruinwan-LinkPreviewBot/1.0 (+https://oruinwan.com)',
                    Accept: 'text/html,application/xhtml+xml',
                },
            });
            if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
                current = new URL(res.headers.get('location'), current).toString();
                continue;
            }
            if (!res.ok) throw new Error('Could not fetch preview');
            const type = String(res.headers.get('content-type') || '');
            if (!/text\/html|application\/xhtml\+xml/i.test(type)) throw new Error('Could not fetch preview');
            // Read at most MAX_HTML_BYTES: <head> is all that is needed.
            const reader = res.body.getReader();
            const chunks = [];
            let total = 0;
            while (total < MAX_HTML_BYTES) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                total += value.length;
            }
            reader.cancel().catch(() => {});
            return { html: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8'), finalUrl: current };
        } finally {
            clearTimeout(timer);
        }
    }
    throw new Error('Could not fetch preview (too many redirects)');
}

async function fetchLinkPreview(url, { fetchImpl } = {}) {
    let ogs;
    try {
        ogs = require('open-graph-scraper');
    } catch {
        throw new Error('Link preview service unavailable (open-graph-scraper not installed)');
    }

    const { html, finalUrl } = await fetchPageHtml(url, fetchImpl);
    const { result, error } = await ogs({ html });
    if (error) throw new Error('Could not fetch preview');

    // Only web images: a data:/javascript: "image" would be rendered by every receiver.
    const img = result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || '';
    let image = '';
    try { image = img ? new URL(img, finalUrl).toString() : ''; } catch { image = ''; }
    if (image && !/^https?:\/\//i.test(image)) image = '';

    return {
        url, // the link as written in the message (not a page-supplied og:url)
        title: result.ogTitle || result.twitterTitle || '',
        description: result.ogDescription || result.twitterDescription || '',
        image,
        site: result.ogSiteName || result.twitterSite || new URL(finalUrl || url).hostname,
    };
}

module.exports = { fetchLinkPreview, assertNotSSRF, isPrivateIP, fetchPageHtml };
