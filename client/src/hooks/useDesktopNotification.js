import { useState, useEffect, useCallback } from 'react';

export function useDesktopNotification() {
    const [permission, setPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    
    useEffect(() => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().then((perm) => {
                setPermission(perm);
            }).catch(() => {
                
            });
        }
    }, []);

    
    const triggerDesktopNotification = useCallback((title, body, icon = '/favicon.ico') => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        
        if (!document.hidden) return;

        try {
            const notif = new Notification(title, {
                body,
                icon,
                tag: `chttrix-${Date.now()}`, 
                silent: false,
            });

            
            setTimeout(() => notif.close(), 5000);

            notif.onclick = () => {
                window.focus();
                notif.close();
            };
        } catch {
            
        }
    }, []);

    return { permission, triggerDesktopNotification };
}

export default useDesktopNotification;
