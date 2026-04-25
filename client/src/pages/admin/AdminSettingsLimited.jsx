import React, { useState } from 'react';
import { Bell, Users, Check, AlertCircle } from 'lucide-react';

const Toggle = ({ checked, onChange }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '36px', height: '20px', background: checked ? 'var(--accent)' : hov ? 'var(--border-accent)' : 'var(--bg-active)', border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 150ms ease', flexShrink: 0, padding: 0 }}>
            <span style={{ position: 'absolute', left: checked ? '18px' : '2px', width: '14px', height: '14px', background: checked ? 'var(--bg-base)' : 'var(--text-muted)', borderRadius: '50%', transition: 'left 150ms ease', display: 'block' }} />
        </button>
    );
};

const ToggleRow = ({ label, description, checked, onChange }) => (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{description}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
    </div>
);

const inputSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px', width: '100%', boxSizing: 'border-box',
};

const AdminSettingsLimited = () => {
    const [activeTab, setActiveTab] = useState('notifications');
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        emailOnNewUser: true,
        emailOnWorkspaceCreate: true,
        weeklyDigest: true,
        emailOnDepartmentCreate: true,
        emailOnSecurityAlert: true,
        defaultRole: 'member',
        autoApproveJoin: false,
    });

    const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

    const tabs = [
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'users', label: 'User Defaults', icon: Users },
    ];

    const handleSave = async () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {}
            <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>Admin Settings</h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configure your admin preferences</p>
                </div>
                <SaveBtn saving={isSaving} onClick={handleSave} />
            </header>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {}
                <div style={{ width: '200px', flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="custom-scrollbar">
                    <nav style={{ padding: '8px' }}>
                        {tabs.map(tab => {
                            const active = activeTab === tab.id;
                            const [hov, setHov] = React.useState(false);
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: active ? 'var(--bg-active)' : hov ? 'var(--bg-hover)' : 'transparent', border: active ? '1px solid var(--border-accent)' : '1px solid transparent', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent', color: active ? 'var(--accent)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', marginBottom: '2px', borderRadius: '2px', transition: 'all 150ms ease' }}>
                                    <tab.icon size={13} style={{ flexShrink: 0 }} /> {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                    {}
                    <div style={{ margin: '12px 8px', padding: '12px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderLeft: '2px solid var(--accent)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <AlertCircle size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '3px' }}>Limited Access</p>
                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.5' }}>Billing and security settings are managed by the workspace owner.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="custom-scrollbar">
                    {activeTab === 'notifications' && (
                        <div style={{ maxWidth: '560px' }}>
                            <div style={{ marginBottom: '14px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>Notification Preferences</h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Control what emails you receive as an admin</p>
                            </div>
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                <ToggleRow label="New User Joined" description="Get notified when someone joins your company" checked={settings.emailOnNewUser} onChange={v => set('emailOnNewUser', v)} />
                                <ToggleRow label="Workspace Created" description="Get notified when a new workspace is created" checked={settings.emailOnWorkspaceCreate} onChange={v => set('emailOnWorkspaceCreate', v)} />
                                <ToggleRow label="Department Created" description="Get notified when a new department is created" checked={settings.emailOnDepartmentCreate} onChange={v => set('emailOnDepartmentCreate', v)} />
                                <ToggleRow label="Security Alerts" description="Get notified of security events and suspicious activity" checked={settings.emailOnSecurityAlert} onChange={v => set('emailOnSecurityAlert', v)} />
                                <div style={{ borderBottom: 'none' }}>
                                    <ToggleRow label="Weekly Digest" description="Receive a weekly summary of company activity" checked={settings.weeklyDigest} onChange={v => set('weeklyDigest', v)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div style={{ maxWidth: '560px' }}>
                            <div style={{ marginBottom: '14px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>User Defaults</h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set default settings for new users</p>
                            </div>
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px', marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Default Role for New Users</label>
                                <select value={settings.defaultRole} onChange={e => set('defaultRole', e.target.value)} style={inputSt}>
                                    <option value="member">Member (Standard)</option>
                                    <option value="manager">Manager</option>
                                    <option value="guest">Guest (Limited)</option>
                                </select>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>New users will be assigned this role by default</p>
                                <div style={{ margin: '14px 0', borderTop: '1px solid var(--border-subtle)' }} />
                                <ToggleRow label="Auto-Approve Domain Join" description="Automatically approve users with verified domain email" checked={settings.autoApproveJoin} onChange={v => set('autoApproveJoin', v)} />
                            </div>
                            <div style={{ background: 'var(--bg-active)', border: '1px solid var(--border-default)', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <AlertCircle size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '1px' }} />
                                <div>
                                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>Note</p>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>These settings apply to new users joining. Existing users are not affected.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SaveBtn = ({ saving, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={saving} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', borderRadius: '2px', opacity: saving ? 0.7 : 1, transition: 'all 150ms ease' }}>
            {saving ? (
                <><div style={{ width: '12px', height: '12px', border: '2px solid var(--bg-base)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Saving...</>
            ) : (
                <><Check size={13} /> Save Changes</>
            )}
        </button>
    );
};

export default AdminSettingsLimited;
