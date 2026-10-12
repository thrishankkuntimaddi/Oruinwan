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

function useOverlay(open, onClose) {
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
function usePresence(open, ms = 200) {
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

export function Sheet({ open, onClose, title, children, footer, className, full = false }) {
  useOverlay(open, onClose);
  const { mounted, closing } = usePresence(open);
  useEffect(() => {
    if (open) hideKeyboard();
  }, [open]);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8" role="presentation">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={cx('absolute inset-0 bg-overlay/60 transition-opacity duration-200', closing ? 'opacity-0' : 'animate-fade-in')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx(
          'relative flex max-h-[92%] flex-col rounded-t-3xl border-t border-line bg-surface pb-safe',
          'lg:max-h-[85vh] lg:w-full lg:max-w-lg lg:rounded-3xl lg:border lg:pb-2',
          'transition-[transform,opacity] duration-200',
          closing ? 'translate-y-full lg:translate-y-0 lg:scale-95 lg:opacity-0' : 'animate-sheet-in',
          full && 'h-[92%] lg:h-[80vh]',
          className,
        )}
        style={{ boxShadow: 'var(--shadow-sheet)' }}
      >
        <div className="flex justify-center pt-2.5 pb-1 lg:pt-2">
          <span className="h-1 w-10 rounded-full bg-line-strong lg:hidden" />
        </div>
        {title && <h2 className="px-5 pt-1 pb-3 text-[17px] font-semibold lg:pt-3">{title}</h2>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-line-soft px-4 pt-3 pb-3">{footer}</div>}
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
export function Dialog({ open, onClose, title, body, confirmLabel = 'Confirm', danger, onConfirm, busy, children }) {
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
        className={cx('absolute inset-0 bg-overlay/65', closing ? 'opacity-0 transition-opacity' : 'animate-fade-in')}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative w-full max-w-sm rounded-3xl border border-line bg-surface p-5',
          closing ? 'scale-95 opacity-0 transition-all duration-150' : 'animate-pop-in',
        )}
        style={{ boxShadow: 'var(--shadow-pop)' }}
      >
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {body && <p className="mt-2 text-sm leading-relaxed text-text-2">{body}</p>}
        {children}
        <div className="mt-5 flex gap-2.5">
          <Button variant="secondary" block onClick={onClose} disabled={busy}>
            Cancel
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
