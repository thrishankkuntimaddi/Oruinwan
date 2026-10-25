import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Monitor } from 'lucide-react';
import AuthShell from '../components/public/AuthShell';
import { AuthStatus } from '../components/public/AuthParts';

/**
 * Email buttons link to /open/<page> (server: appOpenLink). The Oruinwan app opens them when
 * it's installed — Android takes /open links itself (App Links); on a computer this page asks
 * the desktop app through oruinwan://open/<page>. Otherwise the page opens here in the browser.
 */

/** The page an /open link is for: "/open/settings/security?x=1" → "/settings/security?x=1". */
export function openTarget(pathname = '/', search = '', hash = '') {
    let page = String(pathname).replace(/^\/open(?=\/|$)/, '') || '/';
    if (!page.startsWith('/') || page.startsWith('//')) page = '/';
    // An /open link never leads to another /open link.
    if (page === '/open' || page.startsWith('/open/')) page = '/';
    return `${page}${search || ''}${hash || ''}`;
}

/**
 * What to do here: 'stay' inside the apps (they show the page), 'browser' on phones (the app
 * already took the link when installed), 'try-desktop' on a computer's browser.
 */
export function openPlan(userAgent = '') {
    if (/Electron|OruinwanApp/i.test(userAgent)) return 'stay';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return 'browser';
    // Firefox shows an error page for a link type nothing handles, so it isn't tried there.
    if (/Firefox\//i.test(userAgent)) return 'browser';
    return 'try-desktop';
}

export const DESKTOP_WAIT_MS = 1800;

export default function OpenInApp() {
    const { pathname, search, hash } = useLocation();
    const navigate = useNavigate();
    const target = openTarget(pathname, search, hash);
    const appLink = `oruinwan://open${target}`;
    const plan = openPlan(typeof navigator !== 'undefined' ? navigator.userAgent : '');
    const [state, setState] = useState(plan === 'try-desktop' ? 'trying' : 'leaving');
    const left = useRef(false);

    useEffect(() => {
        if (plan !== 'try-desktop') {
            navigate(target, { replace: true });
            return undefined;
        }
        // The browser hides or blurs this page when it hands the link to the app (or asks first).
        const away = () => { left.current = true; setState('opened'); };
        const onVisibility = () => { if (document.visibilityState === 'hidden') away(); };
        window.addEventListener('blur', away);
        document.addEventListener('visibilitychange', onVisibility);
        try {
            window.location.href = appLink;
        } catch {
            /* the browser refused: continue below */
        }
        const timer = setTimeout(() => {
            if (!left.current) navigate(target, { replace: true });
        }, DESKTOP_WAIT_MS);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('blur', away);
            document.removeEventListener('visibilitychange', onVisibility);
        };
        // Runs once per link.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, search, hash]);

    if (state === 'leaving') return null;
    return (
        <AuthShell title="Open Oruinwan">
            <AuthStatus
                icon={Monitor}
                spin={state === 'trying'}
                title={state === 'opened' ? 'Opened in the Oruinwan app' : 'Opening Oruinwan…'}
                lead={state === 'opened'
                    ? 'Switch to the app to carry on. Prefer the browser? Continue here.'
                    : 'Opening the desktop app if it’s installed, otherwise this page continues in the browser.'}
                actions={<>
                    <a href={appLink} className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" data-testid="open-desktop-app">
                        <Monitor size={15} aria-hidden="true" /> Open in the desktop app
                    </a>
                    <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block"
                        data-testid="open-in-browser" onClick={() => navigate(target, { replace: true })}>
                        Continue in the browser <ArrowRight size={15} />
                    </button>
                </>}
            />
        </AuthShell>
    );
}
