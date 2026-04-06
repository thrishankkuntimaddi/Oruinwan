// ConfirmationModal.jsx — Monolith Flow Design System
import React, { useEffect } from 'react';
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

/**
 * Monolith Flow Confirmation Dialog
 * Props: isOpen, onClose, onConfirm, title, message,
 *        confirmText, cancelText, variant (danger|warning|info)
 */
export default function ConfirmationModal({
    isOpen, onClose, onConfirm,
    title, message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
}) {
    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const VARIANTS = {
        danger:  { icon: AlertTriangle, color: 'var(--state-danger)',  bg: 'rgba(224,82,82,0.08)',   border: 'rgba(224,82,82,0.25)',   btnBg: 'var(--state-danger)',  btnColor: '#fff' },
        warning: { icon: AlertCircle,   color: 'var(--accent)',         bg: 'rgba(184,149,106,0.08)', border: 'rgba(184,149,106,0.25)', btnBg: 'var(--accent)',        btnColor: 'var(--bg-base)' },
        info:    { icon: Info,          color: '#9b8ecf',               bg: 'rgba(155,142,207,0.08)', border: 'rgba(155,142,207,0.25)', btnBg: '#9b8ecf',              btnColor: '#fff' },
    };
    const cfg = VARIANTS[variant] || VARIANTS.danger;
    const Icon = cfg.icon;

    const handleConfirm = () => { onConfirm(); onClose(); };

    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '440px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'slideUp 220ms cubic-bezier(0.16,1,0.3,1)' }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', background: cfg.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon size={15} style={{ color: cfg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {title}
                        </span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', lineHeight: 1, transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 18px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>{message}</p>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                    <CancelBtn onClick={onClose} label={cancelText} />
                    <ConfirmBtn onClick={handleConfirm} label={confirmText} bg={cfg.btnBg} color={cfg.btnColor} />
                </div>
            </div>
        </div>
    );
}

const CancelBtn = ({ onClick, label }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '7px 16px', background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease' }}>
            {label}
        </button>
    );
};

const ConfirmBtn = ({ onClick, label, bg, color }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '7px 16px', background: bg, border: 'none', color, fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: hov ? 0.88 : 1, transition: 'opacity 150ms ease' }}>
            {label}
        </button>
    );
};
