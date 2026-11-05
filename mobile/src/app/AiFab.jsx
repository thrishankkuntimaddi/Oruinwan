// Oruinwan AI's floating button, bottom right above the tab bar, with a face that follows your
// touch (AiEyes). The same look on every tab; on Chats, Tasks and Notes it is smaller and sits just
// above the tab's own button ("New task"…); on Home and Activity it takes that spot. Tapping it
// opens the quick AI window (QuickAi.jsx) right there.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { nav, useNav } from './nav.js';
import { useFlag } from '../config/flags.js';
import { useKeyboard } from '../native/keyboard.js';
import { cx } from '../ui/cx.js';
import { AiEyes } from './AiEyes.jsx';
import { useQuickAi } from './QuickAi.jsx';
import { bindAiMood, pokeAi, setMood } from './aiMood.js';
import { fly, leaveSpot, takeSpot } from './aiFlight.js';
import { nearestCorner, onLeft, onTop, setAiCorner, useAiCorner, useEffectiveCorner } from './aiCorner.js';

/** Tabs whose main screen has its own button (ui/Button.jsx Fab) bottom right. */
export const TABS_WITH_FAB = new Set(['chats', 'tasks', 'notes']);

const BIG = 56;
const SMALL = 44;

export function AiFab({ tab, hidden = false }) {
  const aiOn = useFlag('ai');
  const keyboardOpen = useKeyboard((s) => s.open);
  const quickOpen = useQuickAi((s) => s.open);
  // A little hop (legs out) each time the page changes.
  const page = useNav((st) => {
    const stack = st.stacks?.[st.tab] || [];
    return `${st.tab}:${stack[stack.length - 1]?.key || 'root'}`;
  });
  const [hop, setHop] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setHop((n) => n + 1);
    return undefined;
  }, [page]);
  // Its mood follows what happens around the app (aiMood.js).
  useEffect(() => (aiOn ? bindAiMood() : undefined), [aiOn]);
  const holdTimer = useRef(null);
  const openTimer = useRef(null);
  // A screen opens over the tab (a chat): the button flies up to that screen's AI button. It
  // closes: the button flies back down here (aiFlight.js).
  const btn = useRef(null);
  const wasHidden = useRef(hidden);
  const [flying, setFlying] = useState(false);
  useLayoutEffect(() => {
    if (hidden === wasHidden.current) return undefined;
    wasHidden.current = hidden;
    if (hidden) {
      leaveSpot(btn.current);
      return undefined;
    }
    const from = takeSpot();
    if (!from || !btn.current) return undefined;
    setFlying(true);
    return fly(from, btn.current, () => setFlying(false));
  }, [hidden]);
  // Drag it to any corner: it follows the finger, then snaps to the nearest corner (aiCorner.js)
  // and glides there from where it was let go.
  const corner = useEffectiveCorner();
  const movable = useAiCorner((s) => s.movable);
  // Only when chosen in Settings: otherwise the AI button lives in each screen's header.
  const floating = useAiCorner((s) => s.floating);
  const [drag, setDrag] = useState(null); // { x, y } offset while dragging
  const press = useRef(null);
  const dragged = useRef(false);
  const dropRect = useRef(null);
  useLayoutEffect(() => {
    const el = btn.current;
    const from = dropRect.current;
    dropRect.current = null;
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    el.style.transition = 'none';
    el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
    requestAnimationFrame(() => {
      el.style.transition = 'transform 320ms var(--ease-out-soft)';
      el.style.transform = '';
      setTimeout(() => {
        el.style.transition = '';
      }, 340);
    });
  }, [corner]);
  if (!aiOn || tab === 'ai' || !floating) return null;
  const left = onLeft(corner);
  const top = onTop(corner);
  // Small above the tab's own button only where that button is (bottom right).
  const small = TABS_WITH_FAB.has(tab) && corner === 'bottom-right';
  const size = small ? SMALL : BIG;
  const off = hidden || keyboardOpen || quickOpen;
  const startPress = (e) => {
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged.current = false;
  };
  const movePress = (e) => {
    const p = press.current;
    if (!p || !movable) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!dragged.current && Math.hypot(dx, dy) < 10) return;
    if (!dragged.current) {
      dragged.current = true;
      clearTimeout(holdTimer.current);
      try {
        e.currentTarget.setPointerCapture(p.id);
      } catch {
        /* not capturable */
      }
      setMood('surprised', 0);
    }
    setDrag({ x: dx, y: dy });
  };
  const endPress = (e) => {
    const was = dragged.current;
    press.current = null;
    if (!was) return;
    const r = e.currentTarget.getBoundingClientRect();
    dropRect.current = r;
    setDrag(null);
    setMood('happy', 1200);
    const next = nearestCorner(r.left + r.width / 2, r.top + r.height / 2, window.innerWidth, window.innerHeight);
    if (next === corner) {
      // Same corner: glide back from where it was let go.
      const el = e.currentTarget;
      el.style.transition = 'none';
      el.style.transform = `translate(${drag?.x || 0}px, ${drag?.y || 0}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 320ms var(--ease-out-soft)';
        el.style.transform = '';
      });
      dropRect.current = null;
    } else setAiCorner(next);
  };
  return (
    <button
      ref={btn}
      type="button"
      aria-label="Oruinwan AI"
      title="Oruinwan AI"
      data-tour="ai"
      data-size={small ? 'small' : 'big'}
      onClick={() => {
        // A drag to another corner is not a tap.
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        // One tap: a happy face, then the quick window. Quick taps play with it instead (the third
        // sticks its tongue out), so the window waits a moment to see if another tap comes.
        const mood = pokeAi();
        clearTimeout(openTimer.current);
        if (mood === 'tongue') return;
        openTimer.current = setTimeout(() => {
          if (useQuickAi.getState().show) useQuickAi.getState().show();
          else nav.openAi();
        }, 260);
      }}
      onPointerDown={(e) => {
        startPress(e);
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => setMood('surprised', 1500), 450);
      }}
      onPointerMove={movePress}
      onPointerUp={(e) => {
        clearTimeout(holdTimer.current);
        endPress(e);
      }}
      onPointerCancel={(e) => {
        clearTimeout(holdTimer.current);
        endPress(e);
      }}
      onPointerLeave={() => !dragged.current && clearTimeout(holdTimer.current)}
      data-no-swipe={movable || undefined}
      data-corner={corner}
      tabIndex={off ? -1 : 0}
      aria-hidden={off || undefined}
      className={cx(
        'pressable glass absolute z-[15] grid place-items-center rounded-2xl border border-[var(--glass-border)] text-accent-ink shadow-lg',
        (off || flying) && 'pointer-events-none opacity-0',
        flying && 'invisible',
      )}
      style={{
        width: size,
        height: size,
        touchAction: movable ? 'none' : undefined,
        ...(left ? { left: 16 } : { right: 16 }),
        // Top corners sit below the screen's header; bottom ones above the tab bar.
        ...(top
          ? { top: 'calc(var(--sat) + 150px)' }
          : { bottom: small ? `calc(var(--sab) + 76px + ${BIG + 12}px)` : 'calc(var(--sab) + 76px)' }),
        ...(drag ? { transform: `translate(${drag.x}px, ${drag.y}px) scale(1.08)`, transition: 'none', zIndex: 40 } : {}),
        transition: drag ? 'none' : 'width 260ms var(--ease-out-soft), height 260ms var(--ease-out-soft), bottom 260ms var(--ease-out-soft), opacity 160ms ease-out',
      }}
    >
      {/* Keyed by the hop count, so each page change replays the hop. */}
      <span key={hop} className={cx('ai-fab-body grid place-items-center', hop > 0 && 'is-hopping')}>
        <AiEyes size={small ? 24 : 30} />
        <span className="ai-fab-legs" aria-hidden>
          <i />
          <i />
        </span>
      </span>
    </button>
  );
}
