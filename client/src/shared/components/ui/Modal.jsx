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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: WIDTHS[size] || WIDTHS.md, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'slideUp 220ms cubic-bezier(0.16,1,0.3,1)' }}
            >
                {}
                {title && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
                        {dismissable && (
                            <CloseBtn onClick={onClose} />
                        )}
                    </div>
                )}

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }} className="custom-scrollbar">
                    {children}
                </div>

                {}
                {footer && (
                    <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-active)', flexShrink: 0 }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

const CloseBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ background: hov ? 'var(--bg-hover)' : 'none', border: 'none', color: hov ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
            <X size={15} />
        </button>
    );
};

export default Modal;
