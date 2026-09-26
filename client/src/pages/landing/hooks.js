import { useEffect, useState } from 'react';

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Adds `.is-in` to every [data-reveal] element under `rootRef` once it enters
// the viewport. Also picks up elements rendered later (tabs, async content).
export function useRevealAll(rootRef) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;
        const reveal = n => n.classList.add('is-in');
        if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
            const all = () => root.querySelectorAll('[data-reveal]:not(.is-in)').forEach(reveal);
            all();
            const mo = new MutationObserver(all);
            mo.observe(root, { childList: true, subtree: true });
            return () => mo.disconnect();
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        // Tracked per effect run (not on the DOM) so StrictMode's re-run observes everything again.
        const seen = new WeakSet();
        const watch = () => root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((n) => {
            if (seen.has(n)) return;
            seen.add(n);
            io.observe(n);
        });
        watch();
        const mo = new MutationObserver(watch);
        mo.observe(root, { childList: true, subtree: true });
        return () => { io.disconnect(); mo.disconnect(); };
    }, [rootRef]);
}

// Tracks which section id is currently in view (for nav highlighting).
export function useActiveSection(ids) {
    const [active, setActive] = useState(null);
    const key = ids.join('|');
    useEffect(() => {
        if (!('IntersectionObserver' in window)) return undefined;
        const els = key.split('|').map(id => document.getElementById(id)).filter(Boolean);
        const ob = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
        }, { rootMargin: '-45% 0px -50% 0px' });
        els.forEach(el => ob.observe(el));
        return () => ob.disconnect();
    }, [key]);
    return active;
}

export function useScrollState() {
    const [state, setState] = useState({ scrolled: false, progress: 0 });
    useEffect(() => {
        let raf = 0;
        const read = () => {
            raf = 0;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const y = window.scrollY;
            setState(prev => {
                const next = { scrolled: y > 24, progress: max > 0 ? Math.min(1, y / max) : 0 };
                return prev.scrolled === next.scrolled && Math.abs(prev.progress - next.progress) < 0.002 ? prev : next;
            });
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
        read();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);
    return state;
}

export function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
