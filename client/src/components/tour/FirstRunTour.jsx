import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import logger from '../../utils/logger';
import { TOUR_STEPS, moveStep, placeCard, shouldAutoStart, tourStore, visibleSteps } from './tourState';
import './tour.css';

const PAD = 6; // spotlight padding around the element
const OTHER_MODAL = '[aria-modal="true"]:not([data-tour-card])';

/** The first on-screen element marked data-tour="<target>", or null. */
function findTarget(target) {
    if (typeof document === 'undefined') return null;
    for (const el of document.querySelectorAll(`[data-tour="${target}"]`)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth) return el;
    }
    return null;
}

const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
};
const sameRect = (a, b) => (a === b) || (a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
const blockedByModal = () => typeof document !== 'undefined' && Boolean(document.querySelector(OTHER_MODAL));

/**
 * First-run tour of the workspace shell (web, desktop and tablet): a spotlight on the real
 * element plus a small card with Back / Next / Skip. Opens by itself once per account
 * (preferences.tour.done), after any blocking dialog closes; "Take the tour again" in Help
 * reopens it. Esc skips, → / Enter go next, ← goes back.
 */
export default function FirstRunTour({ workspaceId }) {
    const { user, setUser } = useAuth();
    const store = useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get);
    const [steps, setSteps] = useState(TOUR_STEPS);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState(null);
    const [paused, setPaused] = useState(false);
    const [cardSize, setCardSize] = useState({ width: 320, height: 180 });
    const cardRef = useRef(null);
    const nextRef = useRef(null);
    const returnFocus = useRef(null);

    // Opens by itself once the workspace is on screen and nothing blocking is in front. Waits for
    // two quiet checks in a row so a dialog that appears a moment later (unlock) goes first.
    const userId = user?._id || user?.id;
    const eligible = shouldAutoStart({ user, workspaceId, closedThisSession: store.closedThisSession }) && !store.open;
    useEffect(() => {
        if (!eligible) return undefined;
        let quiet = 0;
        const timer = setInterval(() => {
            quiet = blockedByModal() ? 0 : quiet + 1;
            if (quiet >= 2) {
                clearInterval(timer);
                tourStore.start();
            }
        }, 700);
        return () => clearInterval(timer);
    }, [eligible, userId]);

    // On open: pick the steps for this layout, start at the first, remember focus.
    useEffect(() => {
        if (!store.open) return undefined;
        returnFocus.current = document.activeElement;
        setSteps(visibleSteps(TOUR_STEPS, (t) => Boolean(findTarget(t))));
        setIndex(0);
        return () => {
            const el = returnFocus.current;
            if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
        };
    }, [store.open]);

    const step = steps[Math.min(index, steps.length - 1)];

    // Follow the highlighted element (layout changes, resizes, panels loading), and step aside
    // while another modal (e.g. the unlock dialog) is in front.
    useEffect(() => {
        if (!store.open || !step) return undefined;
        const el0 = findTarget(step.target);
        el0?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        const measure = () => {
            setPaused(blockedByModal());
            const next = rectOf(findTarget(step.target));
            setRect((prev) => (sameRect(prev, next) ? prev : next));
        };
        measure();
        const timer = setInterval(measure, 400);
        window.addEventListener('resize', measure);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', measure);
        };
    }, [store.open, step]);

    useLayoutEffect(() => {
        if (!cardRef.current) return;
        const { offsetWidth: width, offsetHeight: height } = cardRef.current;
        setCardSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    }, [store.open, paused, index, steps]);

    // Move focus into the card on every step (the primary button), for keyboards and screen readers.
    useEffect(() => {
        if (store.open && !paused) nextRef.current?.focus({ preventScroll: true });
    }, [store.open, paused, index]);

    const finish = useCallback(() => {
        tourStore.close();
        // Skip and Finish both count: shown once per account, on every device.
        setUser?.((u) => (u ? { ...u, preferences: { ...(u.preferences || {}), tour: { done: true } } } : u));
        api.put('/api/auth/me', { preferences: { tour: { done: true } } })
            .catch((err) => logger.warn('Could not save the tour as seen', err));
    }, [setUser]);

    const go = useCallback((dir) => {
        const next = moveStep(index, steps.length, dir);
        if (next === null) finish();
        else setIndex(next);
    }, [index, steps.length, finish]);

    useEffect(() => {
        if (!store.open || paused) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); go('next'); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); go('back'); return; }
            // Enter on a focused button presses that button; elsewhere it means Next.
            if (e.key === 'Enter' && !(e.target instanceof HTMLElement && e.target.closest('button, a'))) { e.preventDefault(); go('next'); return; }
            if (e.key === 'Tab' && cardRef.current) {
                const items = [...cardRef.current.querySelectorAll('button')];
                if (!items.length) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (!cardRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
                else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [store.open, paused, go, finish]);

    if (!store.open || paused || !step || typeof document === 'undefined') return null;

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const pos = placeCard(rect, cardSize, viewport);
    const last = index === steps.length - 1;

    return createPortal(
        <div className="tour-root" data-placement={pos.placement}>
            {/* Catches clicks so the page underneath stays put while the tour is open. */}
            <div className={`tour-backdrop${rect ? '' : ' is-dim'}`} aria-hidden="true" />
            {rect && <div className="tour-spot" aria-hidden="true" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />}
            <div
                ref={cardRef}
                className="gl-card tour-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tour-title"
                aria-describedby="tour-body"
                data-tour-card=""
                style={{ top: pos.top, left: pos.left }}
            >
                <div aria-live="polite">
                    <p className="tour-count">Step {index + 1} of {steps.length}</p>
                    <h2 id="tour-title" className="tour-title">{step.title}</h2>
                    <p id="tour-body" className="tour-body">{step.body}</p>
                </div>
                <div className="tour-dots" aria-hidden="true">
                    {steps.map((s, i) => <span key={s.target} className={i === index ? 'is-on' : undefined} />)}
                </div>
                <div className="tour-actions">
                    {!last && <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={finish}>Skip tour</button>}
                    <span className="tour-grow" />
                    {index > 0 && <button type="button" className="gl-btn gl-btn--sm" onClick={() => go('back')}>Back</button>}
                    <button ref={nextRef} type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={() => go('next')}>
                        {last ? 'Done' : 'Next'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
