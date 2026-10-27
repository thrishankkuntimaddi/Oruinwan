// A browser window as narrow as a phone gets the phone app's layout (the website's /m/, the same
// interface as the Android and iPhone apps) instead of the computer layout squeezed down; the
// phone layout sends wide windows back (mobile/src/app/layoutSwitch.js). Not in the desktop app,
// and not for anyone who chose "Use the full website" (the oru_web cookie, set by the server).
import { useEffect } from 'react';
import { IS_APP } from './env';

export const PHONE_MAX_WIDTH = 600;

/** Where the phone layout opens this page (the server maps it the same way for phones). */
export function phoneLayoutUrl(pathname, search = '') {
    const page = `${pathname}${search || ''}`;
    return page === '/' ? '/m/' : `/m/?open=${encodeURIComponent(page)}`;
}

/** Whether this page should switch to the phone layout at this width. */
export function shouldUsePhoneLayout({ width, pathname, cookie = '', isApp = IS_APP }) {
    if (isApp || width >= PHONE_MAX_WIDTH) return false;
    if (/(?:^|;\s*)oru_web=1/.test(String(cookie))) return false;
    return /^\/workspaces?(\/|$)/.test(String(pathname || ''));
}

export function usePhoneLayoutSwitch() {
    useEffect(() => {
        if (IS_APP || typeof window === 'undefined') return undefined;
        let timer = null;
        const check = () => {
            clearTimeout(timer);
            // After the resize settles, so dragging the window edge doesn't flip back and forth.
            timer = setTimeout(() => {
                const { pathname, search } = window.location;
                if (shouldUsePhoneLayout({ width: window.innerWidth, pathname, cookie: document.cookie })) {
                    window.location.assign(phoneLayoutUrl(pathname, search));
                }
            }, 600);
        };
        check();
        window.addEventListener('resize', check);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', check);
        };
    }, []);
}
