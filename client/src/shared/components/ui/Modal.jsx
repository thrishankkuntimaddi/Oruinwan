import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const WIDTHS = { sm: '420px', md: '560px', lg: '760px', xl: '960px' };

const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', dismissable = true }) => {
    useEffect(() => {
        if (!isOpen || !dismissable) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, dismissable]);

    if (!isOpen) return null;

    return (
        <div
            onClick={dismissable ? onClose : undefined}
            className="gl-scrim"
            style={{ zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'var(--font)' }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                onClick={e => e.stopPropagation()}
                className="gl-dialog"
                style={{ width: '100%', maxWidth: WIDTHS[size] || WIDTHS.md, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                {title && (
                    <div className="gl-dialog-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
                        {dismissable && (
                            <CloseBtn onClick={onClose} />
                        )}
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }} className="custom-scrollbar">
                    {children}
                </div>

                {footer && (
                    <div className="gl-dialog-foot" style={{ padding: '12px 18px', flexShrink: 0 }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

const CloseBtn = ({ onClick }) => (
    <button type="button" onClick={onClick} className="gl-icon-btn" aria-label="Close">
        <X size={15} />
    </button>
);

export default Modal;
