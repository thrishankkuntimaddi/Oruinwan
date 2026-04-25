import React, { useState } from 'react';
import Card from './Card';
import { Download, Trash2, PauseCircle, AlertTriangle, Loader2 } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 2,
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
    transition: 'border-color 150ms ease',
};

const ConfirmModal = ({ title, body, confirmLabel, confirmDanger, onCancel, onConfirm, loading, confirmWord, confirmText, setConfirmText }) => (
    <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16,
    }}>
        <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-accent)',
            borderRadius: 2,
            padding: 24,
            maxWidth: 400,
            width: '100%',
        }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px', ...S.font }}>{title}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6, ...S.font }}>{body}</div>

            {confirmWord && (
                <div style={{ marginBottom: 16 }}>
                    <label style={{
                        display: 'block', fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.12em',
                        color: 'var(--text-muted)', marginBottom: 6, ...S.font,
                    }}>
                        Type <span style={{ color: 'var(--state-danger)', fontFamily: 'monospace' }}>{confirmWord}</span> to confirm
                    </label>
                    <input
                        type="text"
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        placeholder={confirmWord}
                        style={{ ...inputStyle, borderColor: confirmText === confirmWord ? 'var(--state-danger)' : 'var(--border-default)' }}
                        onFocus={e => e.target.style.borderColor = 'var(--state-danger)'}
                        onBlur={e => e.target.style.borderColor = (confirmText === confirmWord ? 'var(--state-danger)' : 'var(--border-default)')}
                    />
                </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={onCancel}
                    disabled={loading}
                    style={{
                        flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 500,
                        color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)',
                        border: '1px solid var(--border-default)', borderRadius: 2,
                        cursor: 'pointer', ...S.font,
                    }}
                >Cancel</button>
                <button
                    onClick={onConfirm}
                    disabled={loading || (confirmWord && confirmText !== confirmWord)}
                    style={{
                        flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 500,
                        color: '#fff',
                        backgroundColor: confirmDanger ? 'var(--state-danger)' : 'var(--accent)',
                        border: 'none', borderRadius: 2,
                        cursor: loading || (confirmWord && confirmText !== confirmWord) ? 'not-allowed' : 'pointer',
                        opacity: loading || (confirmWord && confirmText !== confirmWord) ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'opacity 150ms ease', ...S.font,
                    }}
                >
                    {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

const AdvancedTab = () => {
    const { logout } = useAuth();
    const { showToast } = useToast();
    const [exporting, setExporting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const handleExportData = async () => {
        setExporting(true);
        try {
            const response = await api.get('/api/auth/me/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `chttrix-data-${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast('Data exported successfully', 'success');
        } catch { showToast('Export not available yet — coming soon', 'info'); }
        finally { setExporting(false); }
    };

    const handleDeactivateAccount = async () => {
        setDeactivating(true);
        try {
            await api.post('/api/auth/me/deactivate', {});
            try { await logout(); } catch { }
            window.location.href = '/login?deactivated=true';
        } catch (err) {
            showToast(err.response?.data?.message || 'Deactivation failed', 'error');
        } finally { setDeactivating(false); setShowDeactivateModal(false); }
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await api.delete('/api/users/me');
            showToast('Account deleted', 'success');
            setTimeout(() => { window.location.href = '/login?deleted=true'; }, 1000);
        } catch (err) {
            showToast(err.response?.data?.message || 'Deletion failed', 'error');
        } finally { setDeleting(false); setShowDeleteModal(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {}
            <Card title="Data Export" subtitle="Download your personal data (GDPR compliant)">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
                    <div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.6, ...S.font }}>
                            Export all personal data — profile, messages, and settings — as a JSON file.
                        </p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {['Profile information & preferences', 'Workspace memberships', 'Account activity history'].map(item => (
                                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', ...S.font }}>
                                    <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--text-muted)', flexShrink: 0 }} />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        onClick={handleExportData}
                        disabled={exporting}
                        style={{
                            flexShrink: 0,
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', fontSize: 13, fontWeight: 500,
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-active)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 2, cursor: exporting ? 'not-allowed' : 'pointer',
                            opacity: exporting ? 0.6 : 1,
                            transition: 'border-color 150ms ease, background-color 150ms ease',
                            ...S.font,
                        }}
                        onMouseEnter={e => { if (!exporting) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
                    >
                        {exporting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
                        {exporting ? 'Exporting…' : 'Export Data'}
                    </button>
                </div>
            </Card>

            {}
            <Card title="Deactivate Account" subtitle="Temporarily disable your account">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
                    <div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.6, ...S.font }}>
                            Hides your profile and pauses notifications. Your data is preserved.
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', ...S.font }}>Reactivate anytime by logging back in.</p>
                    </div>
                    <button
                        onClick={() => setShowDeactivateModal(true)}
                        style={{
                            flexShrink: 0,
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', fontSize: 13, fontWeight: 500,
                            color: 'var(--accent)',
                            backgroundColor: 'rgba(184,149,106,0.08)',
                            border: '1px solid rgba(184,149,106,0.3)',
                            borderRadius: 2, cursor: 'pointer',
                            transition: 'background-color 150ms ease',
                            ...S.font,
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(184,149,106,0.14)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(184,149,106,0.08)'}
                    >
                        <PauseCircle size={13} /> Deactivate
                    </button>
                </div>
            </Card>

            {}
            <Card title="Delete Account" subtitle="Permanently remove your account and all data">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <AlertTriangle size={13} style={{ color: 'var(--state-danger)', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--state-danger)', ...S.font }}>This action cannot be undone.</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.6, ...S.font }}>
                            All messages, files, tasks, and account data will be permanently deleted.
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--accent)', ...S.font }}>Export your data first.</p>
                    </div>
                    <button
                        onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
                        style={{
                            flexShrink: 0,
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', fontSize: 13, fontWeight: 500,
                            color: 'var(--state-danger)',
                            backgroundColor: 'rgba(224,82,82,0.08)',
                            border: '1px solid rgba(224,82,82,0.3)',
                            borderRadius: 2, cursor: 'pointer',
                            transition: 'background-color 150ms ease',
                            ...S.font,
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.14)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.08)'}
                    >
                        <Trash2 size={13} /> Delete Account
                    </button>
                </div>
            </Card>

            {}
            {showDeactivateModal && (
                <ConfirmModal
                    title="Deactivate Account?"
                    body="Your profile will be hidden and notifications paused. You can reactivate anytime by logging back in."
                    confirmLabel={deactivating ? 'Deactivating…' : 'Deactivate'}
                    confirmDanger={false}
                    onCancel={() => setShowDeactivateModal(false)}
                    onConfirm={handleDeactivateAccount}
                    loading={deactivating}
                />
            )}

            {}
            {showDeleteModal && (
                <ConfirmModal
                    title="Delete Account Permanently?"
                    body={
                        <div>
                            <p style={{ color: 'var(--state-danger)', fontWeight: 600, marginBottom: 8, ...S.font }}>⚠ This cannot be undone.</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {['All messages & conversations', 'Tasks, notes, and workspaces', 'Profile and account data'].map(item => (
                                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', ...S.font }}>
                                        <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--text-muted)', flexShrink: 0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    }
                    confirmLabel={deleting ? 'Deleting…' : 'Delete Forever'}
                    confirmDanger={true}
                    confirmWord="DELETE"
                    confirmText={deleteConfirmText}
                    setConfirmText={setDeleteConfirmText}
                    onCancel={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteAccount}
                    loading={deleting}
                />
            )}
        </div>
    );
};

export default AdvancedTab;
