import React from 'react';
import { AlertTriangle } from 'lucide-react';

const S = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(4px)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' },
    box:     { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', padding: '24px', maxWidth: '420px', width: '100%', margin: '0 16px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' },
    iconWrap:{ width: '36px', height: '36px', borderRadius: '2px', backgroundColor: 'rgba(198,60,60,0.12)', border: '1px solid rgba(198,60,60,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title:   { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' },
    body:    { fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6 },
    cancel:  { padding: '7px 16px', fontSize: '13px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease' },
    confirm: { padding: '7px 16px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: 'var(--state-danger)', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease' },
};

export default function RemoveMemberModal({ isOpen, onClose, onConfirm, loading }) {
    if (!isOpen) return null;
    return (
        <div style={S.overlay} onClick={onClose}>
            <div style={S.box} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={S.iconWrap}><AlertTriangle size={18} style={{ color: 'var(--state-danger)' }} /></div>
                    <div style={{ flex: 1 }}>
                        <h3 style={S.title}>Remove Member</h3>
                        <p style={S.body}>Are you sure you want to remove this member from the channel? They will no longer have access to this channel.</p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={onClose} style={S.cancel}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                            >Cancel</button>
                            <button onClick={onConfirm} disabled={loading} style={{ ...S.confirm, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                                onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >Remove Member</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
