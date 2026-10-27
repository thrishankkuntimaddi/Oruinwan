import { describe, expect, it } from 'vitest';
import { phoneLayoutUrl, shouldUsePhoneLayout } from '../appMode/phoneLayout';

describe('phone-sized browser windows', () => {
    it('switch to the phone layout on workspace pages, keeping the page', () => {
        expect(shouldUsePhoneLayout({ width: 480, pathname: '/workspace/abc/messages', isApp: false })).toBe(true);
        expect(phoneLayoutUrl('/workspace/abc/messages', '?x=1')).toBe(`/m/?open=${encodeURIComponent('/workspace/abc/messages?x=1')}`);
    });
    it('stay put when wide, in the desktop app, on public pages, or after choosing the full website', () => {
        expect(shouldUsePhoneLayout({ width: 900, pathname: '/workspace/abc', isApp: false })).toBe(false);
        expect(shouldUsePhoneLayout({ width: 480, pathname: '/workspace/abc', isApp: true })).toBe(false);
        expect(shouldUsePhoneLayout({ width: 480, pathname: '/pricing', isApp: false })).toBe(false);
        expect(shouldUsePhoneLayout({ width: 480, pathname: '/workspace/abc', cookie: 'a=b; oru_web=1', isApp: false })).toBe(false);
    });
});
