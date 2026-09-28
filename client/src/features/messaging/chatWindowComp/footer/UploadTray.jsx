import React from 'react';
import { X, RotateCw, FileText, Image as ImageIcon, Film, Mic, AlertCircle } from 'lucide-react';
import { formatBytes } from '../../../../utils/uploadFile';

function iconFor(type = '') {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('video/')) return Film;
    if (type.startsWith('audio/')) return Mic;
    return FileText;
}

const btn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
    color: 'var(--text-muted)', fontSize: 11, borderRadius: 2,
};

/** Uploads in progress above the composer: name, size, progress bar, cancel / retry. */
export default function UploadTray({ items, onCancel, onRetry, onDismiss }) {
    if (!items?.length) return null;
    return (
        <div data-testid="upload-tray" role="status" aria-live="polite"
            style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
            {items.map((it) => {
                const Icon = it.status === 'error' ? AlertCircle : iconFor(it.type);
                const failed = it.status === 'error';
                return (
                    <div key={it.id} data-testid="upload-item" data-status={it.status}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                            border: `1px solid ${failed ? 'var(--state-danger)' : 'var(--border-default)'}`,
                            background: 'var(--bg-active)', borderRadius: 2, minWidth: 0,
                        }}>
                        <Icon size={15} style={{ flexShrink: 0, color: failed ? 'var(--state-danger)' : 'var(--text-secondary)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</span>
                                <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                    {failed ? formatBytes(it.size)
                                        : it.status === 'sending' ? 'Sending…'
                                            : `${it.progress || 0}% · ${formatBytes(it.size)}`}
                                </span>
                            </div>
                            {failed ? (
                                <div style={{ fontSize: 11, color: 'var(--state-danger)', marginTop: 2 }}>{it.error}</div>
                            ) : (
                                <div style={{ height: 3, marginTop: 4, background: 'var(--border-default)', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${it.progress || 0}%`, background: 'var(--accent)', transition: 'width 120ms linear' }} />
                                </div>
                            )}
                        </div>
                        {failed && it.canRetry && (
                            <button type="button" style={btn} onClick={() => onRetry(it.id)} title="Retry upload" aria-label={`Retry ${it.name}`}>
                                <RotateCw size={13} /> Retry
                            </button>
                        )}
                        <button type="button" style={btn}
                            onClick={() => (failed ? onDismiss(it.id) : onCancel(it.id))}
                            title={failed ? 'Dismiss' : 'Cancel upload'} aria-label={failed ? `Dismiss ${it.name}` : `Cancel ${it.name}`}
                            disabled={it.status === 'sending'}>
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
