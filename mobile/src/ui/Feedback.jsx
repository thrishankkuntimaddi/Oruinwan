import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { on } from '../lib/bus.js';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { Button } from './Button.jsx';

export function EmptyState({ icon, title, body, action, className }) {
  return (
    <div className={cx('flex flex-col items-center px-8 py-14 text-center', className)}>
      {icon && (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
          <Icon as={icon} size="lg" />
        </span>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-text-2">{body}</p>}
      {action && (
        <Button className="mt-5" variant="secondary" size="sm" icon={action.icon} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function SkeletonRows({ count = 6, avatar = true }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="px-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          {avatar && <span className="skeleton h-10 w-10 shrink-0 rounded-full" />}
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-3.5 w-2/5 rounded" />
            <span className="skeleton block h-3 w-4/5 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function Badge({ count, className, muted }) {
  if (!count) return null;
  return (
    <span
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
        muted ? 'bg-surface-3 text-text-2' : 'bg-accent text-on-accent',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

const TONE_ICON = { success: CheckCircle2, danger: AlertTriangle, neutral: Info, warning: AlertTriangle };
const TONE_CLASS = { success: 'text-success', danger: 'text-danger', neutral: 'text-accent-ink', warning: 'text-warning' };

export function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(
    () =>
      on('toast', (t) => {
        setToasts((list) => [...list.slice(-2), t]);
        setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 3200);
      }),
    [],
  );
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(var(--sab) + 84px)' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-pop-in flex max-w-sm items-center gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm"
          style={{ boxShadow: 'var(--shadow-pop)' }}
        >
          <Icon as={TONE_ICON[t.tone] || Info} size="sm" className={TONE_CLASS[t.tone] || TONE_CLASS.neutral} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function Spinner({ className }) {
  return (
    <span className={cx('inline-flex gap-1', className)} aria-label="Loading" role="status">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          style={{ animation: `dot-pulse 1.2s ${i * 0.16}s infinite ease-in-out` }}
        />
      ))}
    </span>
  );
}
