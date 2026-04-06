// client/src/components/messagesComp/chatWindowComp/messages/TranslatePopover.jsx
// Language selection popover — rendered via a fixed portal.
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

const SUPPORTED_LANGS = [
    { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
    { code: 'fr', label: 'French',     flag: '🇫🇷' },
    { code: 'de', label: 'German',     flag: '🇩🇪' },
    { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
    { code: 'ar', label: 'Arabic',     flag: '🇸🇦' },
    { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
    { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
    { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
];

export default function TranslatePopover({ pos, status, onSelect, onClose, onRetry }) {
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const popover = (
        <div
            ref={ref}
            style={{
                position: 'fixed', zIndex: 9999, width: '200px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '2px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                animation: 'wsFadeIn 120ms ease',
                ...pos,
            }}
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    🌐 Translate to
                </span>
                <button
                    onClick={onClose}
                    style={{ padding: '2px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', borderRadius: '2px', transition: '100ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    aria-label="Close"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Loading state */}
            {status === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                    Translating…
                </div>
            )}

            {/* Error state */}
            {status === 'error' && (
                <div style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--state-danger)', marginBottom: '6px', margin: '0 0 6px' }}>Translation failed.</p>
                    <button
                        onClick={onRetry}
                        style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Language grid */}
            {!status && (
                <div style={{ padding: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                    {SUPPORTED_LANGS.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => onSelect(lang.code)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 8px', borderRadius: '2px',
                                fontSize: '12px', fontWeight: 500,
                                color: 'var(--text-secondary)',
                                background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
                                textAlign: 'left', fontFamily: 'var(--font)',
                                transition: '100ms ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            <span style={{ fontSize: '14px', lineHeight: 1 }}>{lang.flag}</span>
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return createPortal(popover, document.body);
}
