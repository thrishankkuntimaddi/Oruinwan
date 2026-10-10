// Screen scaffolding: a header (large title on tab roots, compact with back on pushed
// screens) and a scroll body that remembers its position.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNav } from '../app/nav.js';
import { cx } from './cx.js';
import { IconButton } from './Button.jsx';

export function Screen({ children, className }) {
  return <div className={cx('flex h-full flex-col bg-bg', className)}>{children}</div>;
}

export function Header({ title, subtitle, back = true, actions, leading, large = false, border, children, onBack }) {
  const pop = useNav((s) => s.pop);
  return (
    <header className={cx('shrink-0 bg-bg/95 pt-safe backdrop-blur-md z-10', border && 'border-b border-line-soft')}>
      <div className="flex h-14 items-center gap-1 px-2">
        {leading ||
          (back ? <IconButton icon={ArrowLeft} label="Back" onClick={onBack || pop} /> : <span className="w-2" />)}
        <div className={cx('min-w-0 flex-1', back ? 'pl-1' : 'pl-2')}>
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
export function Body({ children, className, tab, onRefresh, padBottom = true, ...rest }) {
  const ref = useRef(null);
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
      className={cx('relative min-h-0 flex-1 overflow-y-auto overscroll-contain', padBottom && 'pb-28', className)}
      {...touch}
      {...rest}
    >
      {onRefresh && (
        <div
          className="flex items-end justify-center overflow-hidden text-text-2 transition-[height] duration-150"
          style={{ height: pull }}
          aria-hidden={!refreshing}
        >
          <span className={cx('mb-3 h-5 w-5 rounded-full border-2 border-accent border-t-transparent', refreshing && 'animate-spin')}
            style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)`, opacity: Math.min(pull / 56, 1) }} />
        </div>
      )}
      {children}
    </div>
  );
}
