import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const TYPES = {
    success: {
        icon: CheckCircle2,
        accent: 'var(--state-success)',
        bg: 'color-mix(in srgb, var(--state-success) 8%, transparent)',
        label: 'Success',
    },
    error: {
        icon: XCircle,
        accent: 'var(--state-danger)',
        bg: 'color-mix(in srgb, var(--state-danger) 8%, transparent)',
        label: 'Error',
    },
    warning: {
        icon: AlertTriangle,
        accent: 'var(--accent)',
        bg: 'var(--gl-accent-soft)',
        label: 'Warning',
    },
    info: {
        icon: Info,
        accent: 'var(--text-secondary)',
        bg: 'transparent',
        label: 'Info',
    },
};

/** One-line toast for incoming messages: "[avatar] Sender  preview…". */
const CompactToast = ({ title, message, avatar, onClick, dismiss, exiting }) => (
    <div
        role={onClick ? 'button' : undefined}
        onClick={onClick}
        className="gl-toast"
        style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            maxWidth: '300px', padding: '6px 8px 6px 6px',
            cursor: onClick ? 'pointer' : 'default',
            transform: exiting ? 'translateX(320px)' : 'translateX(0)',
            opacity: exiting ? 0 : 1,
            transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1), opacity 160ms ease',
        }}
    >
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'var(--gl-accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (title || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '12px', lineHeight: 1.4 }}>
            {title && <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{title}</span>}
            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message}</span>
        </div>
        <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
        >
            <X size={12} />
        </button>
    </div>
);

const Toast = ({ message, type = 'success', onClose, duration = 3000, title, avatar, onClick }) => {
    const [progress, setProgress] = useState(100);
    const [exiting, setExiting] = useState(false);

    const cfg = TYPES[type] || TYPES.success;
    const Icon = cfg.icon;

    // Keep the latest onClose in a ref so an inline callback from the parent
    // doesn't restart the auto-dismiss timer on every render.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    const exitTimerRef = useRef(null);
    useEffect(() => () => clearTimeout(exitTimerRef.current), []);

    const dismiss = useCallback(() => {
        setExiting(true);
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = setTimeout(() => onCloseRef.current?.(), 250);
    }, []);

    useEffect(() => {
        const step = 100 / (duration / 16);
        const iv = setInterval(() => setProgress(p => Math.max(0, p - step)), 16);
        const t = setTimeout(dismiss, duration);
        return () => { clearInterval(iv); clearTimeout(t); };
    }, [duration, dismiss]);

    if (type === 'message') {
        return (
            <CompactToast
                title={title}
                message={message}
                avatar={avatar}
                dismiss={dismiss}
                exiting={exiting}
                onClick={onClick ? () => { onClick(); dismiss(); } : undefined}
            />
        );
    }

    return (
        <div className="gl-toast" role={type === 'error' ? 'alert' : 'status'} style={{
            width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            transform: exiting ? 'translateX(340px)' : 'translateX(0)',
            opacity: exiting ? 0 : 1,
            transition: 'transform 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px 12px 16px', background: cfg.bg }}>
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: '0 2px 2px 0', background: cfg.accent }} />
                <Icon size={16} style={{ color: cfg.accent, flexShrink: 0, marginTop: '1px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cfg.accent, marginBottom: '2px' }}>
                        {cfg.label}
                    </p>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: '1.5', wordBreak: 'break-word' }}>
                        {message}
                    </p>
                </div>
                <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px', flexShrink: 0, lineHeight: 1, transition: 'color 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <X size={14} />
                </button>
            </div>
            {}
            <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: '100%', background: 'var(--lg-border)' }}>
                <div style={{ height: '100%', background: cfg.accent, width: `${progress}%`, transition: 'width 16ms linear' }} />
            </div>
        </div>
    );
};

export default Toast;
