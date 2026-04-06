// Toast.jsx — Monolith Flow Design System
import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const TYPES = {
    success: {
        icon: CheckCircle2,
        accent: 'var(--state-success)',
        bg: 'rgba(90,186,138,0.08)',
        border: 'rgba(90,186,138,0.3)',
        label: 'Success',
    },
    error: {
        icon: XCircle,
        accent: 'var(--state-danger)',
        bg: 'rgba(224,82,82,0.08)',
        border: 'rgba(224,82,82,0.3)',
        label: 'Error',
    },
    warning: {
        icon: AlertTriangle,
        accent: 'var(--accent)',
        bg: 'rgba(184,149,106,0.08)',
        border: 'rgba(184,149,106,0.3)',
        label: 'Warning',
    },
    info: {
        icon: Info,
        accent: '#9b8ecf',
        bg: 'rgba(155,142,207,0.08)',
        border: 'rgba(155,142,207,0.3)',
        label: 'Info',
    },
};

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
    const [progress, setProgress] = useState(100);
    const [exiting, setExiting] = useState(false);

    const cfg = TYPES[type] || TYPES.success;
    const Icon = cfg.icon;

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(onClose, 250);
    }, [onClose]);

    useEffect(() => {
        const step = 100 / (duration / 16);
        const iv = setInterval(() => setProgress(p => Math.max(0, p - step)), 16);
        const t = setTimeout(dismiss, duration);
        return () => { clearInterval(iv); clearTimeout(t); };
    }, [duration, dismiss]);

    return (
        <div style={{
            position: 'relative',
            width: '320px',
            background: 'var(--bg-surface)',
            border: `1px solid ${cfg.border}`,
            borderLeft: `3px solid ${cfg.accent}`,
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            transform: exiting ? 'translateX(340px)' : 'translateX(0)',
            opacity: exiting ? 0 : 1,
            transition: 'transform 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: cfg.bg }}>
                <Icon size={16} style={{ color: cfg.accent, flexShrink: 0, marginTop: '1px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cfg.accent, marginBottom: '2px' }}>
                        {cfg.label}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', wordBreak: 'break-word' }}>
                        {message}
                    </p>
                </div>
                <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px', flexShrink: 0, lineHeight: 1, transition: 'color 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <X size={14} />
                </button>
            </div>
            {/* Progress ticks */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: '100%', background: 'var(--bg-active)' }}>
                <div style={{ height: '100%', background: cfg.accent, width: `${progress}%`, transition: 'width 16ms linear' }} />
            </div>
        </div>
    );
};

export default Toast;
