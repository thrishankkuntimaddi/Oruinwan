'use strict';

const dns = require('dns').promises;
const { URL } = require('url');
const net = require('net');

// ── SSRF IP blocklist ──────────────────────────────────────────────────────
function isPrivateIP(ip) {
    if (ip === '127.0.0.1' || ip.startsWith('127.')) return true;
    if (ip === '::1') return true;
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
}

async function assertNotSSRF(rawUrl) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }

    const { hostname, protocol } = parsed;
    if (!['http:', 'https:'].includes(protocol)) throw new Error('Only http/https URLs are allowed');

    const blocked = ['localhost', 'metadata.google.internal', '169.254.169.254'];
    if (blocked.includes(hostname.toLowerCase())) throw new Error('Blocked URL: internal host');

    let addresses = [];
    try {
        const [ipv4, ipv6] = await Promise.allSettled([
            dns.resolve4(hostname).catch(() => []),
            dns.resolve6(hostname).catch(() => []),
        ]);
        addresses = [...(ipv4.value || []), ...(ipv6.value || [])];
    } catch { throw new Error('Could not resolve hostname'); }

    for (const addr of addresses) {
        if (net.isIP(addr) && isPrivateIP(addr)) throw new Error('Blocked URL: resolves to private IP');
    }
    return parsed;
}

/**
 * Lazily requires open-graph-scraper so the server starts even if the module
 * hasn't been installed yet (fails gracefully on first request instead).
 */
async function fetchLinkPreview(url) {
    // SSRF guard — throws if blocked
    await assertNotSSRF(url);

    // Lazy require so module absence only affects this code path
    let ogs;
    try {
        ogs = require('open-graph-scraper');
    } catch {
        throw new Error('Link preview service unavailable (open-graph-scraper not installed)');
    }

    const options = {
        url,
        timeout: 5000,
        fetchOptions: {
            headers: { 'User-Agent': 'Chttrix-LinkPreviewBot/1.0 (+https://chttrix.app)' },
        },
        onlyGetOpenGraphInfo: false,
    };

    const { result, error } = await ogs(options);
    if (error) throw new Error('Could not fetch preview');

    return {
        url: result.ogUrl || url,
        title: result.ogTitle || result.twitterTitle || '',
        description: result.ogDescription || result.twitterDescription || '',
        image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || '',
        site: result.ogSiteName || result.twitterSite || new URL(url).hostname,
    };
}

module.exports = { fetchLinkPreview };
