import { describe, it, expect, vi } from 'vitest';

vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const { openInAppLink } = await import('../pages/JoinWorkspace.jsx');

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/131 Safari/537.36';
const href = 'https://oruinwan.poelys.com/join-workspace?token=abc123';

describe('invitation page: open in the phone app', () => {
    it('Android: an intent link into the app that falls back to this page, marked so it does not ask again', () => {
        const link = openInAppLink('abc123', { userAgent: ANDROID, href });
        expect(link.startsWith('intent://join-workspace?token=abc123#Intent;scheme=oruinwan;package=com.oruinwan.app;')).toBe(true);
        const fallback = decodeURIComponent(link.match(/S\.browser_fallback_url=([^;]+)/)[1]);
        expect(fallback).toBe('https://oruinwan.poelys.com/join-workspace?token=abc123&inapp=no');
    });

    it('iPhone: the oruinwan:// link', () => {
        expect(openInAppLink('abc123', { userAgent: IPHONE, href })).toBe('oruinwan://join-workspace?token=abc123');
    });

    it('computers and the desktop app: none', () => {
        expect(openInAppLink('abc123', { userAgent: MAC, href })).toBeNull();
        expect(openInAppLink('abc123', { userAgent: `${MAC} Electron/33`, href })).toBeNull();
        expect(openInAppLink('', { userAgent: ANDROID, href })).toBeNull();
    });
});
