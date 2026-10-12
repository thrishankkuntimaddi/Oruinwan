import { useState, useEffect } from 'react';

// Tablets (shortest screen side 600 px or more: iPad mini is 744, Android tablets 600+) keep the
// desktop layout down to this width, so an iPad in portrait never gets the phone layout. Phones
// keep switching at the given breakpoint, as do desktop windows narrower than this.
const TABLET_MIN_WIDTH = 600;

function isTabletScreen() {
    if (typeof window === 'undefined' || !window.screen) return false;
    return Math.min(window.screen.width, window.screen.height) >= TABLET_MIN_WIDTH;
}

export function mobileLayout(width, breakpoint = 768, tablet = isTabletScreen()) {
    return width < (tablet ? Math.min(breakpoint, TABLET_MIN_WIDTH) : breakpoint);
}

export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() => mobileLayout(window.innerWidth, breakpoint));

    useEffect(() => {
        let rafId;
        const handler = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => setIsMobile(mobileLayout(window.innerWidth, breakpoint)));
        };
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('resize', handler);
            cancelAnimationFrame(rafId);
        };
    }, [breakpoint]);

    return isMobile;
}
