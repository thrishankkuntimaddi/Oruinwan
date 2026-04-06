// client/src/pages/workspace-os/PermissionMatrixPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, RefreshCw, Save, CheckCircle2, AlertTriangle } from 'lucide-react';

const ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];

const MODULES = [
    { group: 'Company',    keys: ['manageCompany', 'viewAnalytics', 'manageBilling'] },
    { group: 'Users',      keys: ['inviteUsers', 'removeUsers', 'manageRoles'] },
    { group: 'Workspaces', keys: ['createWorkspace', 'deleteWorkspace', 'manageWorkspaceMembers'] },
    { group: 'Channels',   keys: ['createChannel', 'deleteChannel', 'manageChannelMembers'] },
    { group: 'Messages',   keys: ['sendMessages', 'deleteMessages', 'pinMessages'] },
    { group: 'Tasks',      keys: ['createTasks', 'assignTasks', 'deleteTasks'] },
    { group: 'Notes',      keys: ['createNotes', 'shareNotes'] },
    { group: 'Updates',    keys: ['postUpdates', 'deleteUpdates'] },
];

const PERM_LABELS = {
    manageCompany: 'Manage Company', viewAnalytics: 'View Analytics', manageBilling: 'Billing',
    inviteUsers: 'Invite Users', removeUsers: 'Remove Users', manageRoles: 'Manage Roles',
    createWorkspace: 'Create Workspace', deleteWorkspace: 'Delete Workspace', manageWorkspaceMembers: 'Workspace Members',
    createChannel: 'Create Channel', deleteChannel: 'Delete Channel', manageChannelMembers: 'Channel Members',
    sendMessages: 'Send Messages', deleteMessages: 'Delete Messages', pinMessages: 'Pin Messages',
    createTasks: 'Create Tasks', assignTasks: 'Assign Tasks', deleteTasks: 'Delete Tasks',
    createNotes: 'Create Notes', shareNotes: 'Share Notes',
    postUpdates: 'Post Updates', deleteUpdates: 'Delete Updates',
};

const ROLE_COLORS = {
    owner:   'var(--accent)',
    admin:   'var(--state-danger)',
    manager: '#9b8ecf',
    member:  'var(--text-secondary)',
    guest:   'var(--text-muted)',
};

// Flat toggle for Monolith Flow
const MatrixToggle = ({ enabled, onChange, locked }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={() => !locked && onChange(!enabled)}
            disabled={locked}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            title={locked ? 'Owner permissions are immutable' : (enabled ? 'Disable' : 'Enable')}
            style={{
                width: '36px', height: '20px', position: 'relative',
                border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border-accent)'}`,
                background: enabled ? 'var(--accent)' : 'var(--bg-active)',
                cursor: locked ? 'not-allowed' : 'pointer',
                opacity: locked ? 0.4 : 1,
                borderRadius: '10px', transition: 'all 150ms ease',
            }}>
            <div style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: enabled ? 'calc(100% - 16px)' : '2px',
                width: '14px', height: '14px', borderRadius: '50%',
                background: enabled ? 'var(--bg-base)' : 'var(--text-muted)',
                transition: 'left 150ms ease',
            }} />
        </button>
    );
};

export default function PermissionMatrixPage({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const companyId = propCompanyId || user?.companyId;

    const [matrix, setMatrix] = useState({});
    const [draft, setDraft] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true); setError(null);
        try {
            const res = await api.get('/api/permissions/matrix', { params: { companyId } });
            setMatrix(res.data.matrix);
            setDraft(JSON.parse(JSON.stringify(res.data.matrix)));
            setDirty(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load permissions');
        } finally { setLoading(false); }
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = (role, perm, val) => {
        if (role === 'owner') return;
        setDraft(prev => ({ ...prev, [role]: { ...prev[role], [perm]: val } }));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true); setError(null);
        try {
            const updates = Object.fromEntries(Object.entries(draft).filter(([r]) => r !== 'owner'));
            await api.put('/api/permissions/matrix', { companyId, updates });
            setMatrix(JSON.parse(JSON.stringify(draft)));
            setDirty(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save permissions');
        } finally { setSaving(false); }
    };

    const handleReset = () => { setDraft(JSON.parse(JSON.stringify(matrix))); setDirty(false); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 5 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Shield size={16} style={{ color: 'var(--accent)' }} />
                        Permission Matrix
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Define what each role can do across the platform</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {dirty && (
                        <button onClick={handleReset}
                            style={{ padding: '6px 14px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                            Reset
                        </button>
                    )}
                    <button onClick={handleSave} disabled={saving || !dirty}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: saving || !dirty ? 'var(--bg-active)' : 'var(--accent)', border: 'none', color: saving || !dirty ? 'var(--text-muted)' : 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: saving || !dirty ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                        {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <CheckCircle2 size={12} /> : <Save size={12} />}
                        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 28px' }}>
                {/* Owner notice */}
                <div style={{ padding: '10px 14px', background: 'rgba(184,149,106,0.08)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={13} style={{ flexShrink: 0 }} />
                    Owner permissions are immutable and always have full access.
                </div>

                {error && <div style={{ padding: '10px 14px', background: 'rgba(224,82,82,0.08)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={12} /> {error}</div>}

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden', flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                            <RefreshCw size={22} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', width: '180px' }}>Permission</th>
                                    {ROLES.map(role => (
                                        <th key={role} style={{ padding: '10px 16px', textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: ROLE_COLORS[role] }}>{role}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {MODULES.map(mod => (
                                    <React.Fragment key={mod.group}>
                                        <tr style={{ background: 'var(--bg-active)' }}>
                                            <td colSpan={ROLES.length + 1} style={{ padding: '6px 16px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                                                {mod.group}
                                            </td>
                                        </tr>
                                        {mod.keys.map((key, i) => (
                                            <MatrixRow key={key} label={PERM_LABELS[key] || key} roles={ROLES} draft={draft} onToggle={handleToggle} permKey={key} last={i === mod.keys.length - 1} />
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

const MatrixRow = ({ label, roles, draft, onToggle, permKey, last }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <tr style={{ borderBottom: last ? 'none' : '1px solid var(--border-subtle)', background: hov ? 'var(--bg-hover)' : 'transparent', transition: 'background 150ms ease' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</td>
            {roles.map(role => (
                <td key={role} style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <MatrixToggle enabled={draft[role]?.[permKey] || false} onChange={val => onToggle(role, permKey, val)} locked={role === 'owner'} />
                    </div>
                </td>
            ))}
        </tr>
    );
};
