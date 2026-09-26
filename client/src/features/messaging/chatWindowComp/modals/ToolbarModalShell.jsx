import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export const fieldStyle = {
    width: '100%', padding: '7px 10px', fontSize: '13px',
    backgroundColor: 'var(--bg-input, var(--bg-active))', border: '1px solid var(--border-default)',
    borderRadius: '2px', outline: 'none', color: 'var(--text-primary)',
    fontFamily: FONT, boxSizing: 'border-box', colorScheme: 'dark',
};

export const labelStyle = {
    display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontFamily: FONT,
};

export function PrimaryButton({ children, disabled, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '7px 16px', fontSize: '13px', fontWeight: 600, fontFamily: FONT,
                backgroundColor: disabled ? 'var(--bg-active)' : 'var(--accent)',
                color: disabled ? 'var(--text-muted)' : '#0c0c0c',
                border: `1px solid ${disabled ? 'var(--border-default)' : 'var(--accent)'}`,
                borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
        >
            {children}
        </button>
    );
}

export function SecondaryButton({ children, onClick, disabled }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '7px 14px', fontSize: '13px', fontWeight: 500, fontFamily: FONT,
                backgroundColor: 'var(--bg-active)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)', borderRadius: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
        >
            {children}
        </button>
    );
}

/** Centered dark dialog used by the message toolbar modals. Escape / backdrop close it. */
export default function ToolbarModalShell({ title, icon, onClose, children, footer, width = 440 }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return createPortal(
        <div
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 1200, padding: '16px',
                backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: `${width}px`, maxHeight: 'calc(100vh - 32px)',
                    display: 'flex', flexDirection: 'column',
                    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                    borderRadius: '2px', boxShadow: '0 20px 60px rgba(0,0,0,0.55)', overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {icon}{title}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{ padding: '4px', border: 'none', outline: 'none', background: 'none', cursor: 'pointer', borderRadius: '2px', display: 'flex', color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <X size={15} />
                    </button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
                {footer && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--border-default)', flexShrink: 0 }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
