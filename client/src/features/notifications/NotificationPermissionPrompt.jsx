import React, { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import './notificationPrompt.css';

const DISMISS_KEY = 'oruinwan.notifPrompt.dismissedAt';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000;

/**
 * Whether to offer turning on browser notifications: the browser supports them, the person hasn't
 * answered yet, and they didn't say "Not now" recently. The desktop app has its own notifications.
 */
export function shouldOfferNotifications({ win = typeof window !== 'undefined' ? window : undefined, now = Date.now() } = {}) {
    if (!win || win.oruinwanDesktopBridge?.notify || win.oruinwanDesktop) return false;
    // An automated browser (tests) can't answer the question.
    if (win.navigator?.webdriver) return false;
    if (typeof win.Notification === 'undefined' || win.Notification.permission !== 'default') return false;
    try {
        const at = Number(win.localStorage?.getItem(DISMISS_KEY) || 0);
        if (at && now - at < DISMISS_FOR_MS) return false;
    } catch { /* storage blocked: ask anyway */ }
    return true;
}

/**
 * "Turn on notifications so calls and messages reach you": browsers only allow the permission
 * question after a click, so this card asks instead of the page asking on load.
 */
export default function NotificationPermissionPrompt({ enabled }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!enabled || !shouldOfferNotifications()) return undefined;
        const t = setTimeout(() => setOpen(shouldOfferNotifications()), SHOW_AFTER_MS);
        return () => clearTimeout(t);
    }, [enabled]);

    if (!open) return null;

    const later = () => {
        try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
        setOpen(false);
    };
    const turnOn = async () => {
        try { await window.Notification.requestPermission(); } catch { /* old Safari: callback form only */ }
        setOpen(false);
    };

    return (
        <div className="np-card" role="dialog" aria-label="Turn on notifications" data-testid="notification-permission-prompt">
            <span className="np-icon" aria-hidden="true"><BellRing size={18} /></span>
            <div className="np-text">
                <p className="np-title">Turn on notifications</p>
                <p className="np-sub">So calls and messages reach you when Oruinwan is in the background.</p>
                <div className="np-actions">
                    <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={turnOn}>Turn on</button>
                    <button type="button" className="gl-btn gl-btn--sm" onClick={later}>Not now</button>
                </div>
            </div>
            <button type="button" className="np-close" aria-label="Close" onClick={later}><X size={14} /></button>
        </div>
    );
}
