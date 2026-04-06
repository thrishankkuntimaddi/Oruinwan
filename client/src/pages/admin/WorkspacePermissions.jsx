import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Save, RefreshCw, CheckCircle2 } from 'lucide-react';

const FEATURES = [
    { key: 'tasks',       label: 'Tasks',         desc: 'Create and assign tasks' },
    { key: 'notes',       label: 'Notes',         desc: 'Collaborative notes' },
    { key: 'polls',       label: 'Polls',         desc: 'Create channel polls' },
    { key: 'ai',          label: 'AI Assistant',  desc: 'Smart replies & AI tools' },
    { key: 'huddles',     label: 'Huddles',       desc: 'Voice & video huddles' },
    { key: 'fileUploads', label: 'File Uploads',  desc: 'Share files in channels' },
    { key: 'reactions',   label: 'Reactions',     desc: 'Message emoji reactions' },
    { key: 'threads',     label: 'Threads',       desc: 'Message thread replies' },
    { key: 'bookmarks',   label: 'Bookmarks',     desc: 'Bookmark messages' },
    { key: 'reminders',   label: 'Reminders',     desc: 'Set message reminders' },
];

const INVITE_ROLES = ['owner', 'admin', 'member'];
const CHANNEL_CREATE_ROLES = ['owner', 'admin', 'member'];

// Monolith Flow flat toggle
const FlatToggle = ({ checked, onChange }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div onClick={onChange} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '36px', height: '20px', position: 'relative', cursor: 'pointer',
                border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-accent)'}`,
                background: checked ? 'var(--accent)' : 'var(--bg-active)',
                borderRadius: '10px', transition: 'all 150ms ease', flexShrink: 0,
                opacity: hov ? 0.85 : 1,
            }}>
            <div style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: checked ? 'calc(100% - 16px)' : '2px',
                width: '14px', height: '14px', borderRadius: '50%',
                background: checked ? 'var(--bg-base)' : 'var(--text-muted)',
                transition: 'left 150ms ease',
            }} />
        </div>
    );
};

const labelStyle = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' };

export default function WorkspacePermissions({ workspaceId: propWorkspaceId }) {
    const { user } = useAuth();

    const userWorkspaces = (user?.workspaces || []).map(ws => ({
        id: typeof ws.workspace === 'object' ? (ws.workspace._id || ws.workspace.id || ws.workspace) : ws.workspace,
        name: ws.workspace?.name || null, role: ws.role
    })).filter(ws => ws.id);

    const personalWs = user?.personalWorkspace;
    const personalWsId = personalWs ? (typeof personalWs === 'object' ? personalWs._id || personalWs.id : personalWs) : null;
    const allWorkspaces = personalWsId ? [{ id: personalWsId, name: 'Personal Workspace', role: 'owner' }, ...userWorkspaces] : userWorkspaces;
    const queryWsId = new URLSearchParams(window.location.search).get('workspaceId');

    const [selectedWsId, setSelectedWsId] = useState(propWorkspaceId || queryWsId || allWorkspaces[0]?.id || '');
    useEffect(() => { if (!selectedWsId && allWorkspaces.length > 0) setSelectedWsId(String(allWorkspaces[0].id)); }, [user, selectedWsId]); // eslint-disable-line

    const wsId = selectedWsId ? String(selectedWsId) : '';
    const [permissions, setPermissions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('features');

    const fetchPermissions = useCallback(async () => {
        if (!wsId) { setError('No workspace selected'); setLoading(false); return; }
        try {
            setLoading(true);
            const { data } = await api.get(`/api/workspaces/${wsId}/permissions`);
            setPermissions(data.permissions);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load permissions');
        } finally { setLoading(false); }
    }, [wsId]);

    useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

    const updateToggle = async (key, value) => {
        if (!permissions) return;
        const updated = { ...permissions.featureToggles, [key]: value };
        setPermissions(p => ({ ...p, featureToggles: updated }));
        try {
            await api.put(`/api/workspaces/${wsId}/features`, { featureToggles: updated });
            setSaved(true); setTimeout(() => setSaved(false), 2000);
        } catch { fetchPermissions(); }
    };

    const savePermissions = async () => {
        if (!permissions) return;
        setSaving(true);
        try {
            await api.put(`/api/workspaces/${wsId}/permissions`, { invitePermission: permissions.invitePermission, channelCreationPermission: permissions.channelCreationPermission });
            setSaved(true); setTimeout(() => setSaved(false), 2000);
        } catch (err) { alert(err.response?.data?.message || 'Save failed'); }
        finally { setSaving(false); }
    };

    const tabs = [['features', 'Feature Toggles'], ['roles', 'Role Permissions']];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 5 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Settings size={16} style={{ color: 'var(--accent)' }} />
                        Workspace Permissions
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Control feature access and role-based permissions</p>
                </div>
                {saved && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(90,186,138,0.1)', border: '1px solid var(--state-success)', color: 'var(--state-success)', fontSize: '11px', fontWeight: 700 }}>
                        <CheckCircle2 size={12} /> Saved
                    </span>
                )}
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="custom-scrollbar">

                {/* Workspace picker */}
                {allWorkspaces.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Workspace:</label>
                        <select value={selectedWsId} onChange={e => { setSelectedWsId(e.target.value); setPermissions(null); }}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', padding: '7px 12px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer', borderRadius: '0' }}>
                            {allWorkspaces.map(ws => <option key={String(ws.id)} value={String(ws.id)}>{ws.name || String(ws.id)}</option>)}
                        </select>
                    </div>
                )}

                {!wsId && !loading && <div style={{ padding: '12px 16px', background: 'rgba(184,149,106,0.08)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '12px', marginBottom: '14px' }}>No workspace found. Please join or create a workspace first.</div>}
                {error && <div style={{ padding: '10px 14px', background: 'rgba(224,82,82,0.08)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

                {loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                    <RefreshCw size={20} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} /></div>}

                {permissions && !loading && (
                    <div style={{ maxWidth: '800px' }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                            {tabs.map(([key, label]) => (
                                <button key={key} onClick={() => setActiveTab(key)}
                                    style={{
                                        padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer',
                                        color: activeTab === key ? 'var(--accent)' : 'var(--text-secondary)',
                                        fontSize: '13px', fontWeight: activeTab === key ? 700 : 400,
                                        borderBottom: `2px solid ${activeTab === key ? 'var(--accent)' : 'transparent'}`,
                                        transition: 'all 150ms ease', fontFamily: 'inherit',
                                    }}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Feature Toggles */}
                        {activeTab === 'features' && (
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enable or disable features for this workspace. Changes take effect immediately for all members.</p>
                                </div>
                                {FEATURES.map((feat, idx) => (
                                    <div key={feat.key} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px', borderBottom: idx < FEATURES.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{feat.label}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{feat.desc}</p>
                                        </div>
                                        <FlatToggle checked={permissions.featureToggles?.[feat.key] !== false} onChange={() => updateToggle(feat.key, !(permissions.featureToggles?.[feat.key] !== false))} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Role Permissions */}
                        {activeTab === 'roles' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { label: 'Who can invite members?', key: 'invitePermission', options: INVITE_ROLES, desc: 'Minimum role required to generate invite links' },
                                    { label: 'Who can create channels?', key: 'channelCreationPermission', options: CHANNEL_CREATE_ROLES, desc: 'Minimum role required to create new channels' },
                                ].map(({ label, key, options, desc }) => (
                                    <div key={key} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '18px 20px' }}>
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>{label}</p>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>{desc}</p>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {options.map(role => {
                                                const active = permissions[key] === role;
                                                return (
                                                    <RoleBtn key={role} label={role.charAt(0).toUpperCase() + role.slice(1) + '+'} active={active} onClick={() => setPermissions(p => ({ ...p, [key]: role }))} />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <SaveBtn onClick={savePermissions} saving={saving} />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const RoleBtn = ({ label, active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '7px 18px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`, background: active ? 'var(--accent)' : hov ? 'var(--bg-hover)' : 'var(--bg-active)', color: active ? 'var(--bg-base)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: active ? 700 : 400, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            {label}
        </button>
    );
};

const SaveBtn = ({ onClick, saving }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={saving} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', background: saving ? 'var(--bg-active)' : hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: saving ? 'var(--text-muted)' : 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
            {saving ? 'Saving…' : 'Save Permissions'}
        </button>
    );
};


