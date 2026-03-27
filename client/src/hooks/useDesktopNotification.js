/**
 * useDesktopNotification.js
 *
 * Hook that manages browser Notification API permission and exposes
 * a helper to fire OS-level desktop notifications.
 *
 * Usage:
 *   const { permission, triggerDesktopNotification } = useDesktopNotification();
 */
import { useState, useEffect, useCallback } from 'react';

export function useDesktopNotification() {
    const [permission, setPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    // Request permission once on mount (if not already granted/denied)
    useEffect(() => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().then((perm) => {
                setPermission(perm);
            }).catch(() => {
                // Permission request failed silently
            });
        }
    }, []);

    /**
     * Trigger a browser OS notification if permission is granted.
     * Only fires when the document is hidden (app not in focus) to avoid spam.
     */
    const triggerDesktopNotification = useCallback((title, body, icon = '/favicon.ico') => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        // Don't show desktop notification if user is already looking at the app
        if (!document.hidden) return;

        try {
            const notif = new Notification(title, {
                body,
                icon,
                tag: `chttrix-${Date.now()}`, // prevents duplicate stacking
                silent: false,
            });

            // Auto-close after 5 seconds
            setTimeout(() => notif.close(), 5000);

            notif.onclick = () => {
                window.focus();
                notif.close();
            };
        } catch {
            // Desktop notifications not supported silently
        }
    }, []);

    return { permission, triggerDesktopNotification };
}

export default useDesktopNotification;
