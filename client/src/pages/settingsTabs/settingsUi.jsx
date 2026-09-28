import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCcw } from 'lucide-react';
import SettingSwitch from '../../components/ui/SettingSwitch';
import './settings.css';

/**
 * Building blocks shared by every Settings tab, so they all look and behave
 * the same: sections, rows, fields, buttons, the unsaved-changes bar,
 * notices, dialogs and loading/error states. Styles live in settings.css.
 */

/** Title and one-line explanation at the top of a tab. */
export function PageIntro({ title, description, action }) {
    return (
        <header className="stg-intro">
            <div className="stg-intro-row">
                <div>
                    <h1>{title}</h1>
                    {description && <p>{description}</p>}
                </div>
                {action}
            </div>
        </header>
    );
}

/** A titled card. `pad` gives the body even padding (for forms); rows don't need it. */
export function Section({ title, description, action, tone, pad = false, children, id }) {
    const headingId = useId();
    return (
        <section className="stg-section" data-tone={tone} aria-labelledby={title ? headingId : undefined} id={id}>
            {(title || action) && (
                <div className="stg-section-head">
                    <div>
                        {title && <h2 id={headingId}>{title}</h2>}
                        {description && <p>{description}</p>}
                    </div>
                    {action && <div className="stg-section-action">{action}</div>}
                </div>
            )}
            <div className="stg-section-body" data-pad={pad ? 'true' : undefined}>{children}</div>
        </section>
    );
}

/** Label + description on the left, a control on the right. */
export function Row({ label, description, children, stack = false, htmlFor }) {
    return (
        <div className="stg-row" data-stack={stack ? 'true' : undefined}>
            <div className="stg-row-text">
                {htmlFor ? <label htmlFor={htmlFor} className="stg-row-label">{label}</label> : <div className="stg-row-label">{label}</div>}
                {description && <div className="stg-row-desc">{description}</div>}
            </div>
            {children != null && <div className="stg-row-control">{children}</div>}
        </div>
    );
}

export function SwitchRow({ label, description, checked, onChange, disabled }) {
    return (
        <Row label={label} description={description}>
            <SettingSwitch checked={!!checked} onChange={onChange} disabled={disabled} label={label} />
        </Row>
    );
}

/** A labelled form field. Pass the input as children; `id` links the label. */
export function Field({ label, hint, error, id, children }) {
    return (
        <div className="stg-field">
            {label && <label className="stg-label" htmlFor={id}>{label}</label>}
            {children}
            {error ? <div className="stg-error-text" role="alert">{error}</div> : hint ? <div className="stg-hint">{hint}</div> : null}
        </div>
    );
}

export const Input = React.forwardRef(function Input({ className = '', invalid, ...props }, ref) {
    return <input ref={ref} className={`stg-input ${className}`} aria-invalid={invalid ? 'true' : undefined} {...props} />;
});

export function Select({ className = '', children, ...props }) {
    return <select className={`stg-select ${className}`} {...props}>{children}</select>;
}

export function Textarea({ className = '', ...props }) {
    return <textarea className={`stg-textarea ${className}`} {...props} />;
}

/**
 * variant: 'primary' | 'secondary' (default) | 'ghost' | 'danger' | 'danger-soft'.
 * `loading` shows a spinner and disables the button.
 */
export function Button({ variant = 'secondary', size, block, loading, icon: Icon, children, disabled, type = 'button', ...props }) {
    return (
        <button
            type={type}
            className="stg-btn"
            data-variant={variant === 'secondary' ? undefined : variant}
            data-size={size}
            data-block={block ? 'true' : undefined}
            disabled={disabled || loading}
            aria-busy={loading ? 'true' : undefined}
            {...props}
        >
            {loading ? <Loader2 size={13} className="stg-spin" /> : Icon ? <Icon size={13} /> : null}
            {children}
        </button>
    );
}

export function IconButton({ label, tone, children, ...props }) {
    return (
        <button type="button" className="stg-icon-btn" aria-label={label} title={label} data-tone={tone} {...props}>
            {children}
        </button>
    );
}

const NOTICE_ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle };

export function Notice({ tone = 'info', children, action }) {
    const Icon = NOTICE_ICONS[tone] || Info;
    return (
        <div className="stg-notice" data-tone={tone} role={tone === 'danger' ? 'alert' : undefined}>
            <Icon size={14} />
            <div className="stg-notice-body">{children}</div>
            {action}
        </div>
    );
}

export function Badge({ tone, children }) {
    return <span className="stg-badge" data-tone={tone}>{children}</span>;
}

export function LoadingState({ label = 'Loading…', inline = false }) {
    return (
        <div className="stg-state" data-inline={inline ? 'true' : undefined} role="status">
            <Loader2 size={16} className="stg-spin" /> {label}
        </div>
    );
}

export function ErrorState({ message, onRetry }) {
    return (
        <div className="stg-state" role="alert">
            <AlertCircle size={20} />
            <div>{message}</div>
            {onRetry && <Button size="sm" icon={RefreshCcw} onClick={onRetry}>Try again</Button>}
        </div>
    );
}

export function EmptyState({ icon: Icon, children }) {
    return (
        <div className="stg-state">
            {Icon && <Icon size={22} />}
            <div>{children}</div>
        </div>
    );
}

/** Sticky "unsaved changes" bar shown at the bottom of a tab while a form is dirty. */
export function SaveBar({ visible, saving, onSave, onDiscard, message = 'You have unsaved changes', saveLabel = 'Save changes', disabled }) {
    if (!visible) return null;
    return (
        <div className="stg-savebar" role="region" aria-label="Unsaved changes">
            <span className="stg-savebar-text"><strong>{message}</strong></span>
            <Button variant="ghost" onClick={onDiscard} disabled={saving}>Discard</Button>
            <Button variant="primary" onClick={onSave} loading={saving} disabled={disabled}>{saving ? 'Saving…' : saveLabel}</Button>
        </div>
    );
}

/**
 * Confirmation dialog, rendered in a portal. `confirmWord` requires the user to
 * type it before confirming (for destructive actions). Esc and the backdrop cancel.
 */
export function ConfirmDialog({
    open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary',
    confirmWord, loading, onConfirm, onCancel, size, confirmDisabled,
}) {
    const [typed, setTyped] = useState('');
    const inputId = useId();
    const dialogRef = useRef(null);

    useEffect(() => { if (open) setTyped(''); }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !loading) onCancel?.(); };
        document.addEventListener('keydown', onKey);
        const t = setTimeout(() => {
            const el = dialogRef.current?.querySelector('input, button[data-autofocus]');
            el?.focus();
        }, 0);
        return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
    }, [open, loading, onCancel]);

    if (!open) return null;
    const blocked = confirmDisabled || (confirmWord && typed.trim() !== confirmWord);
    return createPortal(
        <div className="stg-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onCancel?.(); }}>
            <div className="stg-dialog" data-size={size} role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>
                <h3>{title}</h3>
                <div className="stg-dialog-body">{children}</div>
                {confirmWord && (
                    <div className="stg-field" style={{ marginTop: 16 }}>
                        <label className="stg-label" htmlFor={inputId}>Type <span className="stg-mono" style={{ color: 'var(--state-danger)' }}>{confirmWord}</span> to confirm</label>
                        <input id={inputId} className="stg-input stg-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
                    </div>
                )}
                <div className="stg-dialog-actions">
                    <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
                    <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={blocked} data-autofocus={confirmWord ? undefined : 'true'}>
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** Human message from an API error. */
export const errorMessage = (err, fallback = 'Something went wrong') =>
    err?.response?.data?.message || err?.response?.data?.error || (err?.message && !/^Request failed/.test(err.message) ? err.message : null) || fallback;

const shallowEqual = (a, b) => {
    const ka = Object.keys(a || {});
    const kb = Object.keys(b || {});
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.is(a[k], b[k]));
};

/**
 * Load → edit → save for a settings form.
 *
 *   const form = useSettingsForm({ initial, load: () => api..., save: (values, changed) => api... });
 *   form.values, form.set('key', v), form.dirty, form.save(), form.discard()
 *
 * `load` and `save` return the saved values (save may return undefined to keep what was sent).
 */
export function useSettingsForm({ initial, load, save, onSaved, onError }) {
    const [values, setValues] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [loading, setLoading] = useState(!!load);
    const [loadError, setLoadError] = useState(null);
    const [saving, setSaving] = useState(false);
    const loadRef = useRef(load);
    loadRef.current = load;

    const reload = useCallback(async () => {
        if (!loadRef.current) return;
        setLoading(true);
        setLoadError(null);
        try {
            const data = await loadRef.current();
            const next = { ...initial, ...(data || {}) };
            setValues(next);
            setSaved(next);
        } catch (err) {
            setLoadError(errorMessage(err, 'Could not load these settings'));
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const set = useCallback((key, value) => setValues((v) => ({ ...v, [key]: value })), []);
    const dirty = !shallowEqual(values, saved);
    const changed = Object.keys(values || {}).filter((k) => !Object.is(values[k], saved?.[k]));

    const doSave = useCallback(async () => {
        if (!dirty || saving) return false;
        setSaving(true);
        try {
            const result = await save(values, Object.fromEntries(changed.map((k) => [k, values[k]])));
            const next = result && typeof result === 'object' ? { ...values, ...result } : values;
            setValues(next);
            setSaved(next);
            onSaved?.(next);
            return true;
        } catch (err) {
            onError?.(errorMessage(err, 'Could not save your changes'));
            return false;
        } finally {
            setSaving(false);
        }
    }, [dirty, saving, save, values, changed, onSaved, onError]);

    return {
        values, set, setValues, saved, dirty, changed, loading, loadError, saving,
        save: doSave, discard: () => setValues(saved), reload,
    };
}
