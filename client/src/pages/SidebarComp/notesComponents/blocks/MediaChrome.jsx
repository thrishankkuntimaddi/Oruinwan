import React from 'react';
import { mediaStyles } from './mediaUtils';

/** Hover toolbar shown over a filled media block (download / replace / remove). */
export function MediaToolbar({ actions }) {
    const visible = actions.filter(Boolean);
    if (!visible.length) return null;
    return (
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', transition: 'opacity 150ms ease', zIndex: 2 }}>
            {visible.map(({ Icon, title, onClick, danger }) => (
                <button key={title} type="button" onClick={onClick} title={title} aria-label={title}
                    style={mediaStyles.iconBtn}
                    onMouseEnter={e => { e.currentTarget.style.color = danger ? 'var(--state-danger)' : 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                >
                    <Icon size={14} />
                </button>
            ))}
        </div>
    );
}

/** Upload progress overlay. */
export function UploadProgress({ value }) {
    if (value === undefined) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
            <div style={{ textAlign: 'center', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font)' }}>
                <div style={{ marginBottom: '8px' }}>Uploading… {value}%</div>
                <div style={mediaStyles.progressTrack}>
                    <div style={{ width: `${value}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms ease' }} />
                </div>
            </div>
        </div>
    );
}

/** A file-input styled as a button. */
export function UploadButton({ id, accept, label, onFile, secondary }) {
    return (
        <>
            <input type="file" accept={accept} id={id} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
            <label htmlFor={id} style={secondary ? mediaStyles.secondaryBtn : mediaStyles.primaryBtn}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                {label}
            </label>
        </>
    );
}
