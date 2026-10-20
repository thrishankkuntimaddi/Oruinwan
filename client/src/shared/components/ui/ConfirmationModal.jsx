import React, { useEffect } from 'react';
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

export default function ConfirmationModal({
    isOpen, onClose, onConfirm,
    title, message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
}) {
    
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const VARIANTS = {
        danger:  { icon: AlertTriangle, color: 'var(--state-danger)', bg: 'color-mix(in srgb, var(--state-danger) 8%, transparent)', btn: 'gl-btn gl-x-danger-solid' },
        warning: { icon: AlertCircle,   color: 'var(--accent)',       bg: 'var(--gl-accent-soft)', btn: 'gl-btn gl-btn--primary' },
        info:    { icon: Info,          color: 'var(--accent)',       bg: 'var(--gl-accent-soft)', btn: 'gl-btn gl-btn--primary' },
    };
    const cfg = VARIANTS[variant] || VARIANTS.danger;
    const Icon = cfg.icon;

    const handleConfirm = () => { onConfirm(); onClose(); };

    return (
        <div
            onClick={onClose}
            className="gl-scrim"
            style={{ zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'var(--font)' }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                onClick={e => e.stopPropagation()}
                className="gl-dialog"
                style={{ width: '100%', maxWidth: '440px' }}
            >
                <div className="gl-dialog-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: cfg.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon size={15} style={{ color: cfg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {title}
                        </span>
                    </div>
                    <button type="button" onClick={onClose} className="gl-icon-btn" aria-label="Close">
                        <X size={14} />
                    </button>
                </div>

                <div style={{ padding: '20px 18px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>{message}</p>
                </div>

                <div className="gl-dialog-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px' }}>
                    <button type="button" className="gl-btn" onClick={onClose}>{cancelText}</button>
                    <button type="button" className={cfg.btn} onClick={handleConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
}
