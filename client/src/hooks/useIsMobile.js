import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

    useEffect(() => {
        let rafId;
        const handler = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => setIsMobile(window.innerWidth < breakpoint));
        };
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('resize', handler);
            cancelAnimationFrame(rafId);
        };
    }, [breakpoint]);

    return isMobile;
}
