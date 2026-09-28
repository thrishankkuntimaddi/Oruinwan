import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Inbox, Loader2, RefreshCcw, Search, X } from 'lucide-react';
import '../../styles/gloss.css';
import './dash.css';

/**
 * Building blocks for the company dashboards (Owner / Admin / Manager / Platform).
 * Visual language: Monolith Gloss (gl-*) + dash.css (cd-*). All token-based.
 */

export { Avatar, initialsOf } from './DashShell';

/** Page wrapper: a head that stays put and a scrolling body. */
export function DashPage({ head, children, wide = false, bodyClassName = '' }) {
    return (
        <div className="cd-page">
            <div className="cd-page-scroll">
                {head}
                <div className={`cd-page-body ${bodyClassName}`} data-wide={wide ? 'true' : undefined}>{children}</div>
            </div>
        </div>
    );
}

/** Eyebrow + title + lead on the left, actions on the right. */
export function PageHead({ eyebrow, title, lead, actions, icon: Icon }) {
    return (
        <header className="gl-page-head">
            <div style={{ minWidth: 0 }}>
                {eyebrow && <div className="gl-eyebrow">{eyebrow}</div>}
                <h1 className="gl-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {Icon && <span className="cd-head-icon"><Icon size={20} style={{ color: 'var(--accent)' }} /></span>}
                    {title}
                </h1>
                {lead && <p className="gl-page-lead">{lead}</p>}
            </div>
            {actions && <div className="cd-head-actions">{actions}</div>}
        </header>
    );
}

export function Section({ title, lead, action, children }) {
    return (
        <section className="cd-section">
            {(title || action) && (
                <div className="cd-section-head">
                    <div>
                        {title && <h2 className="cd-section-title">{title}</h2>}
                        {lead && <p className="cd-section-lead">{lead}</p>}
                    </div>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

/** A gl-card with an optional titled head. `flush` removes the padding (tables, lists). */
export function Panel({ title, icon: Icon, action, flush = false, children, className = '', style }) {
    return (
        <div className={`gl-card cd-panel ${className}`} data-flush={flush ? 'true' : undefined} style={style}>
            {(title || action) && (
                <div className="cd-panel-head">
                    {title && <h3 className="cd-panel-title">{Icon && <Icon size={14} />}{title}</h3>}
                    {action}
                </div>
            )}
            {children}
        </div>
    );
}

export function KpiGrid({ children, min }) {
    return <div className="cd-grid" style={min ? { '--cd-min': `${min}px` } : undefined}>{children}</div>;
}

export function Grid({ cols, children, min }) {
    return <div className="cd-grid" data-cols={cols} style={min ? { '--cd-min': `${min}px` } : undefined}>{children}</div>;
}

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString() : v);

/** A KPI card. `value` null/undefined renders a dash (never a fake number). */
export function Kpi({ label, value, hint, icon: Icon, tone, delta, deltaTone, onClick, loading }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag className={`gl-card cd-kpi${onClick ? ' gl-card--interactive' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
            <div className="cd-kpi-top">
                <span className="cd-kpi-label">{label}</span>
                {Icon && <span className="cd-kpi-icon" data-tone={tone}><Icon size={14} /></span>}
            </div>
            <div className="cd-kpi-value" data-long={typeof value === 'string' && value.length > 10 ? 'true' : undefined}>
                {loading ? <span className="cd-skel" style={{ display: 'inline-block', width: 56, height: 24 }} /> : (value === null || value === undefined || Number.isNaN(value) ? '—' : fmt(value))}
            </div>
            {(hint || delta) && (
                <div className="cd-kpi-hint">
                    {delta && <span className="cd-kpi-delta" data-tone={deltaTone}>{delta} </span>}
                    {hint}
                </div>
            )}
        </Tag>
    );
}

export function Meter({ value = 0, tone, label }) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    return (
        <div className="cd-meter" data-tone={tone} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
            <span style={{ width: `${v}%` }} />
        </div>
    );
}

export function Toolbar({ children }) {
    return <div className="cd-toolbar">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder = 'Search…', label }) {
    return (
        <label className="gl-search">
            <Search size={14} />
            <input
                className="gl-input"
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={label || placeholder}
            />
        </label>
    );
}

/** Segmented filter. options: [{ value, label, count }] */
export function FilterTabs({ value, onChange, options, label = 'Filter' }) {
    return (
        <div className="cd-tabs-scroll">
            <div className="gl-tabs" role="tablist" aria-label={label}>
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        role="tab"
                        className="gl-tab"
                        aria-selected={value === o.value}
                        onClick={() => onChange(o.value)}
                    >
                        {o.label}
                        {o.count !== undefined && <span className="gl-count">{o.count}</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function SelectBox({ value, onChange, children, label, style }) {
    return (
        <select className="gl-input cd-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={style}>
            {children}
        </select>
    );
}

/** Button in the gloss style. variant: default | primary | ghost | danger */
export function Btn({ variant, size, icon: Icon, loading, children, className = '', type = 'button', ...props }) {
    const cls = ['gl-btn', variant === 'primary' && 'gl-btn--primary', variant === 'ghost' && 'gl-btn--ghost', variant === 'danger' && 'cd-btn-danger', size === 'sm' && 'gl-btn--sm', size === 'lg' && 'gl-btn--lg', className]
        .filter(Boolean).join(' ');
    return (
        <button type={type} className={cls} disabled={loading || props.disabled} {...props}>
            {loading ? <Loader2 size={13} className="cd-spin" /> : Icon ? <Icon size={13} /> : null}
            {children}
        </button>
    );
}

export function IconBtn({ label, children, className = '', ...props }) {
    return (
        <button type="button" className={`gl-icon-btn ${className}`} aria-label={label} title={label} {...props}>{children}</button>
    );
}

export function Chip({ tone, children, title }) {
    return <span className="cd-chip" data-tone={tone} title={title}>{children}</span>;
}

export function Dot({ tone }) {
    return <span className="cd-dot" data-tone={tone} aria-hidden="true" />;
}

const ROLE_TONE = { owner: 'accent', admin: 'accent', manager: 'success', member: undefined, guest: 'warning' };
export function RoleChip({ role }) {
    const r = role || 'member';
    return <Chip tone={ROLE_TONE[r]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Chip>;
}

/**
 * Table with a sticky header inside a gl-card. columns: [{ key, label, className, render(row) }]
 * Pass `children` instead of rows/columns for a hand-built <tbody>.
 */
export function DataTable({ columns, rows, rowKey = (r) => r._id || r.id, onRowClick, empty, maxHeight, children, caption }) {
    return (
        <div className="gl-card cd-table-wrap" style={maxHeight ? { '--cd-table-max': typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight } : undefined}>
            <table className="cd-table">
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead>
                    <tr>{columns.map((c) => <th key={c.key} className={c.className} scope="col">{c.label}</th>)}</tr>
                </thead>
                {children || (
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={columns.length} style={{ padding: 0 }}>{empty || <EmptyState title="Nothing here yet" />}</td></tr>
                        ) : rows.map((r) => (
                            <tr key={rowKey(r)} data-clickable={onRowClick ? 'true' : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                                {columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>)}
                            </tr>
                        ))}
                    </tbody>
                )}
            </table>
        </div>
    );
}

export function LoadingState({ label = 'Loading…' }) {
    return (
        <div className="cd-state" role="status">
            <Loader2 size={18} className="cd-spin" style={{ color: 'var(--accent)' }} />
            <span>{label}</span>
        </div>
    );
}

export function ErrorState({ title = 'Could not load this', message, onRetry }) {
    return (
        <div className="cd-state" data-tone="danger" role="alert">
            <span className="gl-empty-mark"><AlertTriangle size={18} /></span>
            <p className="gl-empty-title">{title}</p>
            {message && <p className="gl-empty-text">{message}</p>}
            {onRetry && <Btn size="sm" icon={RefreshCcw} onClick={onRetry}>Try again</Btn>}
        </div>
    );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
    return (
        <div className="cd-state">
            <span className="gl-empty-mark"><Icon size={18} /></span>
            {title && <p className="gl-empty-title">{title}</p>}
            {text && <p className="gl-empty-text">{text}</p>}
            {action}
        </div>
    );
}

/** Glass dialog in a portal. Esc and backdrop close it (unless `busy`). */
export function Dialog({ open, title, lead, onClose, children, footer, size, busy }) {
    const ref = useRef(null);
    const titleId = useId();
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
        document.addEventListener('keydown', onKey);
        const t = setTimeout(() => ref.current?.querySelector('input, select, textarea, button[data-autofocus]')?.focus(), 0);
        return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
    }, [open, busy, onClose]);
    if (!open) return null;
    return createPortal(
        <div className="cd-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
            <div className="cd-dialog" data-size={size} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
                <div className="cd-dialog-head">
                    <div style={{ minWidth: 0 }}>
                        <h2 id={titleId}>{title}</h2>
                        {lead && <p>{lead}</p>}
                    </div>
                    <IconBtn label="Close" onClick={onClose} disabled={busy}><X size={16} /></IconBtn>
                </div>
                <div className="cd-dialog-body">{children}</div>
                {footer && <div className="cd-dialog-foot">{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}

/** Confirm dialog built on Dialog. */
export function Confirm({ open, title, children, confirmLabel = 'Confirm', tone, busy, onConfirm, onClose }) {
    return (
        <Dialog
            open={open}
            title={title}
            onClose={onClose}
            busy={busy}
            size="sm"
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
                    <Btn variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={onConfirm} data-autofocus="true">{confirmLabel}</Btn>
                </>
            )}
        >
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
        </Dialog>
    );
}

export function Field({ label, hint, error, children, htmlFor }) {
    return (
        <div className="cd-field">
            {label && <label htmlFor={htmlFor}>{label}</label>}
            {children}
            {error ? <div className="cd-error-text" role="alert">{error}</div> : hint ? <div className="cd-hint">{hint}</div> : null}
        </div>
    );
}

/** Human message from an API error. */
export const errorMessage = (err, fallback = 'Something went wrong') =>
    err?.response?.data?.message || err?.response?.data?.error || (err?.message && !/^Request failed/.test(err.message) ? err.message : null) || fallback;

/**
 * Load data with loading / error state.
 *   const { data, loading, error, reload, setData } = useAsync(() => api.get(...).then(r => r.data), [deps]);
 */
export function useAsync(fn, deps = [], { enabled = true } = {}) {
    const [state, setState] = useState({ data: null, loading: enabled, error: null });
    const fnRef = useRef(fn);
    fnRef.current = fn;
    const seq = useRef(0);
    const reload = useCallback(async () => {
        const id = ++seq.current;
        setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const data = await fnRef.current();
            if (id === seq.current) setState({ data, loading: false, error: null });
            return data;
        } catch (err) {
            if (id === seq.current) setState((s) => ({ ...s, loading: false, error: errorMessage(err, 'Could not load this data') }));
            return undefined;
        }
    }, []);
    useEffect(() => {
        if (enabled) reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, reload, ...deps]);
    const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
    return { ...state, reload, setData };
}

/** Relative time like "3h ago". */
export function timeAgo(date) {
    if (!date) return '—';
    const d = new Date(date);
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (Number.isNaN(s)) return '—';
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
    const dd = Math.round(h / 24); if (dd < 30) return `${dd}d ago`;
    return d.toLocaleDateString();
}
