import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

const AdvancedTab = ({ isAdmin, setShowDeleteConfirm }) => (
    <div style={{ fontFamily: 'var(--font)' }}>
        {isAdmin ? (
            <div style={{ border: '1px solid rgba(198,60,60,0.25)', borderRadius: '2px', overflow: 'hidden' }}>
                {}
                <div style={{ padding: '14px 18px', background: 'rgba(198,60,60,0.08)', borderBottom: '1px solid rgba(198,60,60,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={15} style={{ color: 'var(--state-danger)', flexShrink: 0 }} />
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--state-danger)', margin: 0 }}>Danger Zone</h3>
                </div>

                {}
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        Deleting a workspace is <strong style={{ color: 'var(--text-primary)' }}>permanent</strong> and cannot be undone.
                        All messages, files, and data will be lost forever.{' '}
                        <strong style={{ color: 'var(--state-danger)' }}>Only administrators can perform this action.</strong>
                    </p>
                </div>

                {}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>Delete this workspace</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Once deleted, it&apos;s gone for good.</div>
                    </div>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#fff', background: 'var(--state-danger)', border: 'none', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: '150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        Delete Workspace
                    </button>
                </div>
            </div>
        ) : (
            <div style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--border-subtle)', borderRadius: '2px', background: 'var(--bg-active)' }}>
                <Lock size={24} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Admin Access Required</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Only workspace administrators can access advanced settings.</p>
            </div>
        )}
    </div>
);

export default AdvancedTab;
