// First-run tour: coach marks over the tab bar and the Home header, one step at a time with
// Next / Back / Skip (or a swipe on the card). Opens by itself once per account, after any sheet
// or dialog in front has closed; Settings › Support › "Take the tour again" reopens it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, useSession } from '../../data/session.js';
import { useNav } from '../../app/nav.js';
import { useOverlay } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { cx } from '../../ui/cx.js';
import { TOUR_STEPS, moveStep, placeCard, shouldAutoStart, useTour } from './tourState.js';

const PAD = 6;
const OTHER_MODAL = '[aria-modal="true"]:not([data-tour-card])';

function findTarget(target) {
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
const sameRect = (a, b) => a === b || (a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
const blockedByModal = () => Boolean(document.querySelector(OTHER_MODAL));

export function PhoneTour() {
  const user = useSession((s) => s.user);
  const workspaceId = useSession((s) => s.workspaceId);
  const open = useTour((s) => s.open);
  const closedThisSession = useTour((s) => s.closedThisSession);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [paused, setPaused] = useState(false);
  const [cardH, setCardH] = useState(190);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const swipe = useRef(null);

  const eligible = shouldAutoStart({ user, workspaceId, closedThisSession }) && !open;
  useEffect(() => {
    if (!eligible) return undefined;
    let quiet = 0;
    const timer = setInterval(() => {
      quiet = blockedByModal() ? 0 : quiet + 1;
      if (quiet >= 2) {
        clearInterval(timer);
        useTour.getState().start();
      }
    }, 700);
    return () => clearInterval(timer);
  }, [eligible]);

  // Start on Home with nothing pushed, so the tab bar and the Home header are on screen.
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    const { tab, stacks } = useNav.getState();
    if (tab !== 'home' || stacks.home.length) useNav.getState().open('home');
  }, [open]);

  const finish = useCallback(() => {
    useTour.getState().close();
    // Skip and Done both count: shown once per account, on every device.
    useSession.getState().setUser({ tourDone: true });
    Promise.resolve(api().markTourDone?.()).catch(() => {});
  }, []);

  // Android back button and Escape (via the overlay stack) skip the tour.
  useOverlay(open, finish);

  const step = TOUR_STEPS[index];

  useEffect(() => {
    if (!open) return undefined;
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
  }, [open, step]);

  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h) setCardH((prev) => (prev === h ? prev : h));
  }, [open, paused, index]);

  useEffect(() => {
    if (open && !paused) nextRef.current?.focus({ preventScroll: true });
  }, [open, paused, index]);

  const go = useCallback(
    (dir) => {
      const next = moveStep(index, TOUR_STEPS.length, dir);
      if (next === null) finish();
      else setIndex(next);
    },
    [index, finish],
  );

  useEffect(() => {
    if (!open || paused) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go('next');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go('back');
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLElement && e.target.closest('button, a'))) {
        e.preventDefault();
        go('next');
      } else if (e.key === 'Tab' && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll('button')];
        const first = items[0];
        const last = items[items.length - 1];
        if (!cardRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, paused, go, finish]);

  if (!open || paused || !step) return null;

  const pos = placeCard(rect, { width: 360, height: cardH }, { width: window.innerWidth, height: window.innerHeight });
  const last = index === TOUR_STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* Catches taps so nothing underneath moves while the tour is open. */}
      <div className={cx('absolute inset-0', !rect && 'scrim animate-fade-in')} aria-hidden />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl transition-all duration-300"
          // An accent ring around the element, and the rest of the screen dimmed (theme tokens).
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 2px rgb(var(--c-accent)), 0 0 0 200vmax var(--scrim)' }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        data-tour-card=""
        className="glass-strong fixed rounded-card border p-4 transition-[top] duration-300"
        style={{ top: pos.top, left: pos.left, width: pos.width, boxShadow: 'var(--glass-edge), var(--shadow-pop)' }}
        onTouchStart={(e) => (swipe.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = swipe.current;
          swipe.current = null;
          const dx = start == null ? 0 : (e.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(dx) > 50) go(dx < 0 ? 'next' : 'back');
        }}
      >
        <div aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink">
            Step {index + 1} of {TOUR_STEPS.length}
          </p>
          <h2 id="tour-title" className="mt-1.5 text-[17px] font-semibold">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1 text-sm text-text-2">
            {step.body}
          </p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.target} className={cx('h-1 rounded-full transition-all', i === index ? 'w-5 bg-accent' : 'w-2.5 bg-line-strong')} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!last && (
            <Button variant="ghost" size="sm" className="-ml-2 text-text-2" onClick={finish}>
              Skip
            </Button>
          )}
          <span className="flex-1" />
          {index > 0 && (
            <Button variant="secondary" size="sm" onClick={() => go('back')}>
              Back
            </Button>
          )}
          <Button ref={nextRef} size="sm" onClick={() => go('next')}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
