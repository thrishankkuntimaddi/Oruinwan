// Overlays (sheets, dialogs, drawers) share one layer, z-[60]: the one opened last is appended
// last to <body>, so it is always on top of whatever opened it.
// Sheets and dialogs render through a portal on document.body, so an animated parent
// can never trap them under the tab bar. Each one registers with the nav store so the
// Android back button (or Escape) closes it first. On wide windows a sheet is a centred dialog.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNav } from '../app/nav.js';
import { cx } from './cx.js';
import { Button } from './Button.jsx';
import { Icon } from './Icon.jsx';
import { hideKeyboard } from '../native/index.js';

export function useOverlay(open, onClose) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const { pushOverlay, removeOverlay } = useNav.getState();
    pushOverlay(id, () => closeRef.current?.());
    return () => removeOverlay(id);
  }, [open, id]);
}

/** Keeps the overlay mounted for its exit animation. */
export function usePresence(open, ms = 200) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, ms);
    return () => clearTimeout(t);
  }, [open, mounted, ms]);
  return { mounted, closing };
}

/**
 * The bar at the top of a sheet is a handle: drag it (or the title) down to close the sheet,
 * up to make it taller. Dragging down from the top of the content closes it too.
 */
function useSheetDrag(onClose) {
  const [dy, setDy] = useState(0);
  const [tall, setTall] = useState(false);
  const drag = useRef(null);
  const start = (e, fromContent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const scroller = fromContent ? e.currentTarget : null;
    if (scroller && scroller.scrollTop > 0) return;
    drag.current = { y: e.clientY, fromContent, active: !fromContent, id: e.pointerId, el: e.currentTarget };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const delta = e.clientY - d.y;
    if (!d.active) {
      if (delta > 8) {
        d.active = true;
        try {
          d.el.setPointerCapture?.(d.id);
        } catch {
          /* not capturable */
        }
      } else if (delta < -4) {
        drag.current = null;
        return;
      } else return;
    }
    setDy(delta);
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    if (dy > 90) onClose?.();
    else if (dy < -50 && !d.fromContent) setTall(true);
    setDy(0);
  };
  const handle = { onPointerDown: (e) => start(e, false), onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  const content = { onPointerDown: (e) => start(e, true), onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  return { dy: Math.max(dy, -60), tall, setTall, handle, content, dragging: Boolean(drag.current?.active) };
}

export function Sheet({ open, onClose, title, children, footer, className, full = false }) {
  useOverlay(open, onClose);
  const { mounted, closing } = usePresence(open);
  const drag = useSheetDrag(onClose);
  useEffect(() => {
    if (open) hideKeyboard();
    else drag.setTall(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted) return null;
  const offset = drag.dy > 0 ? drag.dy : 0;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:items-center lg:justify-center lg:p-8" role="presentation">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={cx('scrim absolute inset-0 transition-opacity duration-200', closing ? 'opacity-0' : 'animate-fade-in')}
        style={offset ? { opacity: Math.max(0.2, 1 - offset / 400) } : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx(
          'glass-strong relative flex max-h-[92%] flex-col rounded-t-3xl border-t pb-safe',
          'lg:max-h-[85vh] lg:w-full lg:max-w-lg lg:rounded-3xl lg:border lg:pb-2',
          'transition-[transform,opacity,height] duration-200',
          closing ? 'translate-y-full lg:translate-y-0 lg:scale-95 lg:opacity-0' : 'animate-sheet-in',
          (full || drag.tall) && 'h-[92%] lg:h-[80vh]',
          className,
        )}
        style={{
          boxShadow: 'var(--glass-edge), var(--shadow-sheet)',
          ...(offset && !closing ? { transform: `translateY(${offset}px)`, transition: 'none' } : {}),
        }}
      >
        <div {...drag.handle} className="touch-none select-none lg:touch-auto" data-testid="sheet-handle">
          <div className="flex justify-center pt-2.5 pb-1 lg:pt-2">
            <span className="h-1 w-10 rounded-full bg-text-3/40 lg:hidden" />
          </div>
          {title && <h2 className="px-5 pt-1 pb-3 text-[17px] font-semibold lg:pt-3">{title}</h2>}
        </div>
        <div {...drag.content} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
        {footer && <div className="border-t border-[var(--glass-border)] px-4 pt-3 pb-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** A list of actions in a sheet. actions: [{ label, icon, onSelect, danger, hint }] */
export function ActionSheet({ open, onClose, title, actions }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-2 pb-2">
        {actions.filter(Boolean).map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              onClose();
              a.onSelect?.();
            }}
            className={cx(
              'flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left active:bg-surface-2',
              a.danger ? 'text-danger' : 'text-text',
            )}
          >
            {a.icon && <Icon as={a.icon} className={a.danger ? '' : 'text-text-2'} />}
            <span className="flex-1">
              <span className="block text-[15px]">{a.label}</span>
              {a.hint && <span className="block text-[13px] text-text-2">{a.hint}</span>}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Confirmation dialog for anything destructive. Never a single tap. */
export function Dialog({ open, onClose, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, busy, children }) {
  useOverlay(open, onClose);
  const { mounted, closing } = usePresence(open, 160);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-6" role="presentation">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={cx('scrim absolute inset-0', closing ? 'opacity-0 transition-opacity' : 'animate-fade-in')}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'glass-strong relative w-full max-w-sm rounded-3xl border p-5',
          closing ? 'scale-95 opacity-0 transition-all duration-150' : 'animate-pop-in',
        )}
        style={{ boxShadow: 'var(--glass-edge), var(--shadow-pop)' }}
      >
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {body && <p className="mt-2 text-sm leading-relaxed text-text-2">{body}</p>}
        {children}
        <div className="mt-5 flex gap-2.5">
          <Button variant="secondary" block onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger-solid' : 'primary'} block loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
