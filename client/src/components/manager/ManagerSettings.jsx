import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { User, Mail, Building, Check, X, Settings } from 'lucide-react';

const inpSt = (dis) => ({
    background: dis ? 'var(--bg-active)' : 'var(--bg-input)',
    border: '1px solid var(--border-default)', color: dis ? 'var(--text-muted)' : 'var(--text-primary)',
    fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
    padding: '8px 10px 8px 34px', width: '100%', boxSizing: 'border-box',
    cursor: dis ? 'not-allowed' : 'text', opacity: dis ? 0.6 : 1,
});

export default function ManagerSettings() {
    const { user } = useAuth();
    const { company } = useCompany();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({ username: user?.username || '', email: user?.email || '' });

    const handleSave = () => { setSaving(true); setTimeout(() => { setSaving(false); setEditing(false); }, 800); };
    const handleCancel = () => { setProfile({ username: user?.username || '', email: user?.email || '' }); setEditing(false); };
    const initials = profile.username?.charAt(0)?.toUpperCase() || 'M';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Settings size={16} style={{ color: 'var(--accent)' }} /> My Settings
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Manage your profile and preferences</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {editing ? (
                        <>
                            <HBtn icon={X} label="Cancel" onClick={handleCancel} />
                            <HBtn icon={Check} label={saving ? 'Saving…' : 'Save'} onClick={handleSave} primary disabled={saving} />
                        </>
                    ) : (
                        <HBtn icon={User} label="Edit Profile" onClick={() => setEditing(true)} primary />
                    )}
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                <div style={{ maxWidth: '600px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <User size={13} style={{ color: 'var(--accent)' }} />
                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Personal Information</p>
                    </div>
                    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(184,149,106,0.1)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, color: 'var(--accent)' }}>{initials}</div>
                            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', textAlign: 'center' }}>{user?.companyRole || 'Manager'}</p>
                            <p style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>{company?.name}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {[
                                { key: 'username', label: 'Full Name', Icon: User, dis: !editing, type: 'text' },
                                { key: 'email', label: 'Email Address', Icon: Mail, dis: true, type: 'email' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '5px' }}>{f.label}</label>
                                    <div style={{ position: 'relative' }}>
                                        <f.Icon size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        <input type={f.type} value={profile[f.key]} disabled={f.dis} onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} style={inpSt(f.dis)} />
                                    </div>
                                    {f.key === 'email' && <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>Email cannot be changed. Contact admin.</p>}
                                </div>
                            ))}
                            <div>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '5px' }}>Department</label>
                                <div style={{ position: 'relative' }}>
                                    <Building size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input type="text" value="Design" disabled style={inpSt(true)} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HBtn({ icon: Icon, label, onClick, primary, disabled }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: primary ? (disabled ? 'var(--bg-active)' : hov ? 'var(--accent-hover)' : 'var(--accent)') : (hov ? 'var(--bg-hover)' : 'var(--bg-active)'), border: primary ? 'none' : '1px solid var(--border-default)', color: primary ? (disabled ? 'var(--text-muted)' : 'var(--bg-base)') : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all 150ms ease', fontFamily: 'inherit' }}>
            <Icon size={13} />{label}
        </button>
    );
}
