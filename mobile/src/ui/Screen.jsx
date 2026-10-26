// Screen scaffolding: a header (large title on tab roots, compact with back on pushed
// screens) and a scroll body that remembers its position.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNav } from '../app/nav.js';
import { usePane } from '../app/layout.js';
import { cx } from './cx.js';
import { IconButton } from './Button.jsx';

/** True for a screen shown as a tab's main screen (Files, Knowledge or Huddles on the tab bar): no Back. */
export const TabRootContext = createContext(false);

export function Screen({ children, className }) {
  return <div className={cx('flex h-full flex-col bg-bg', className)}>{children}</div>;
}

export function Header({ title, subtitle, back = true, actions, leading, large = false, border, children, onBack }) {
  const pop = useNav((s) => s.pop);
  // The first screen in a wide window's detail pane sits beside its list: nothing to go back to.
  const { split, depth } = usePane();
  const tabRoot = useContext(TabRootContext);
  const showBack = back && !tabRoot && !(split && depth === 0 && !onBack);
  return (
    <header className={cx('glass-header shrink-0 pt-safe z-10', border && 'border-b border-line-soft')}>
      <div className="flex h-14 items-center gap-1 px-2">
        {leading ||
          (showBack ? <IconButton icon={ArrowLeft} label="Back" onClick={onBack || (() => pop() || useNav.getState().back())} /> : <span className="w-2" />)}
        <div className={cx('min-w-0 flex-1', showBack ? 'pl-1' : 'pl-2')}>
          {!large && (
            <>
              <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
              {subtitle && <p className="truncate text-xs text-text-2">{subtitle}</p>}
            </>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center">{actions}</div>}
      </div>
      {large && (
        <div className="px-4 pb-2">
          <h1 className="text-[28px] font-bold tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-text-2">{subtitle}</p>}
        </div>
      )}
      {children}
    </header>
  );
}

/** Scrollable body; listens for "tap active tab" to scroll back to top. */
export function Body({ children, className, tab, onRefresh, padBottom = true, fluid = false, ...rest }) {
  const ref = useRef(null);
  // In a tablet's detail pane, keep lines readable: content is centred at a comfortable width.
  const { split } = usePane();
  const contained = split && !fluid;
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null);

  useEffect(() => {
    if (!tab) return undefined;
    const h = (e) => {
      if (e.detail === tab) ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('oru:scroll-top', h);
    return () => window.removeEventListener('oru:scroll-top', h);
  }, [tab]);

  const touch = onRefresh
    ? {
        onTouchStart: (e) => {
          start.current = ref.current.scrollTop <= 0 ? e.touches[0].clientY : null;
        },
        onTouchMove: (e) => {
          if (start.current == null || refreshing) return;
          const d = e.touches[0].clientY - start.current;
          setPull(d > 0 ? Math.min(d * 0.45, 80) : 0);
        },
        onTouchEnd: async () => {
          if (pull > 56 && !refreshing) {
            setRefreshing(true);
            setPull(48);
            try {
              await onRefresh();
            } finally {
              setRefreshing(false);
              setPull(0);
            }
          } else setPull(0);
          start.current = null;
        },
      }
    : {};

  return (
    <div
      ref={ref}
      className={cx('relative min-h-0 flex-1 overflow-y-auto overscroll-contain', padBottom && 'pb-28 lg:pb-10', className)}
      {...touch}
      {...rest}
    >
      {onRefresh && (pull > 0 || refreshing) && (
        // Pull to refresh: a spinner that follows the finger (transform and opacity only).
        <div className="pointer-events-none sticky top-0 z-10 flex h-0 justify-center" data-testid="pull-refresh" role={refreshing ? 'status' : undefined} aria-label={refreshing ? 'Refreshing' : undefined}>
          <span
            className="mt-1 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface shadow-sm"
            style={{
              transform: `translateY(${Math.min(pull, 64) - 20}px)`,
              opacity: Math.min(pull / 40, 1),
              transition: start.current == null ? 'transform 200ms var(--ease-out-soft), opacity 200ms' : 'none',
            }}
          >
            <span
              className={cx('h-5 w-5 rounded-full border-2 border-accent border-t-transparent', refreshing && 'animate-spin')}
              style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)` }}
            />
          </span>
        </div>
      )}
      {contained ? <div className="mx-auto w-full max-w-3xl">{children}</div> : children}
    </div>
  );
}
