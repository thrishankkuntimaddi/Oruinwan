import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from "../../../../contexts/ToastContext";
import api from '@services/api';
import { AlertTriangle, Loader, X } from 'lucide-react';

const DeleteWorkspaceModal = ({
    showDeleteConfirm, setShowDeleteConfirm,
    workspaceName, deleteVerification, setDeleteVerification, setShowSettingsModal,
}) => {
    const { workspaceId } = useParams();
    const { showToast } = useToast();
    const [deleting, setDeleting] = useState(false);

    const handleDeleteWorkspace = async () => {
        if (deleteVerification.toLowerCase() !== workspaceName.toLowerCase()) {
            showToast('Workspace name does not match', 'error');
            return;
        }
        setDeleting(true);
        try {
            await api.delete(`/api/workspaces/${workspaceId}`);
            showToast(`Workspace "${workspaceName}" has been deleted.`, 'success');
            setShowDeleteConfirm(false);
            setShowSettingsModal(false);
            setDeleteVerification('');
            window.location.href = '/workspaces';
        } catch (err) {
            console.error('Delete workspace error:', err);
            showToast(err.response?.data?.message || err.message || 'Failed to delete workspace', 'error');
        } finally {
            setDeleting(false);
        }
    };

    if (!showDeleteConfirm) return null;

    const confirmed = deleteVerification.toLowerCase() === workspaceName.toLowerCase();

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)' }}
            onClick={e => { if (e.target === e.currentTarget && !deleting) setShowDeleteConfirm(false); }}
        >
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '420px', position: 'relative', overflow: 'hidden' }}>
                {/* Danger top bar */}
                <div style={{ height: '2px', background: 'var(--state-danger)', width: '100%' }} />

                {/* Header */}
                <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '2px', background: 'rgba(198,60,60,0.12)', border: '1px solid rgba(198,60,60,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--state-danger)' }}>
                        <AlertTriangle size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Delete Workspace?</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>This action is permanent and cannot be undone.</p>
                    </div>
                    <button onClick={() => { if (!deleting) setShowDeleteConfirm(false); }}
                        style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px', flexShrink: 0, transition: '150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px 20px' }}>
                    {/* Warning box */}
                    <div style={{ padding: '12px 14px', background: 'rgba(198,60,60,0.07)', border: '1px solid rgba(198,60,60,0.2)', borderRadius: '2px', marginBottom: '18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        You are about to permanently delete <strong style={{ color: 'var(--text-primary)' }}>{workspaceName}</strong>. All channels, messages, and files will be <strong style={{ color: 'var(--state-danger)' }}>irretrievably lost</strong>.
                    </div>

                    {/* Verification input */}
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
                        Type <code style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-active)', padding: '1px 5px', borderRadius: '2px', border: '1px solid var(--border-default)' }}>{workspaceName}</code> to confirm:
                    </label>
                    <input
                        type="text"
                        value={deleteVerification}
                        onChange={e => setDeleteVerification(e.target.value)}
                        placeholder={workspaceName}
                        autoFocus
                        style={{
                            width: '100%', padding: '9px 12px', fontFamily: 'monospace',
                            background: 'var(--bg-input)', border: `1px solid ${confirmed ? 'var(--state-danger)' : 'var(--border-default)'}`,
                            borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)',
                            outline: 'none', boxSizing: 'border-box', transition: '150ms ease',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = confirmed ? 'var(--state-danger)' : 'var(--border-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = confirmed ? 'var(--state-danger)' : 'var(--border-default)'}
                    />

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                        <button
                            onClick={() => { setShowDeleteConfirm(false); setDeleteVerification(''); }}
                            disabled={deleting}
                            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteWorkspace}
                            disabled={!confirmed || deleting}
                            style={{
                                padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                                color: confirmed && !deleting ? '#fff' : 'var(--text-muted)',
                                background: confirmed && !deleting ? 'var(--state-danger)' : 'var(--bg-hover)',
                                border: `1px solid ${confirmed && !deleting ? 'var(--state-danger)' : 'var(--border-default)'}`,
                                borderRadius: '2px', cursor: confirmed && !deleting ? 'pointer' : 'not-allowed',
                                fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: '6px',
                                transition: '150ms ease', opacity: deleting ? 0.7 : 1,
                            }}
                        >
                            {deleting ? <><Loader size={12} className="animate-spin" /> Deleting…</> : 'Delete Workspace'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteWorkspaceModal;
