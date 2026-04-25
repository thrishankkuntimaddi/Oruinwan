import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { User, Mail, Calendar, Building, Shield, Camera, X, Check } from 'lucide-react';

const fieldSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px',
    width: '100%', boxSizing: 'border-box',
};

const roleBorder = { owner: 'var(--accent)', admin: 'var(--accent)', manager: 'var(--state-success)', member: 'var(--border-accent)' };

const AdminProfile = () => {
    const { user } = useAuth();
    const { company } = useCompany();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [profileData, setProfileData] = useState({
        username: user?.username || '', email: user?.email || '',
        phone: user?.phone || '', address: user?.address || '', profilePicture: user?.profilePicture || ''
    });

    const set = (key, val) => setProfileData(s => ({ ...s, [key]: val }));

    const handleSave = async () => {
        setIsSaving(true);
        setTimeout(() => { setIsSaving(false); setIsEditing(false); }, 1000);
    };

    const handleCancel = () => {
        setProfileData({ username: user?.username || '', email: user?.email || '', phone: user?.phone || '', address: user?.address || '', profilePicture: user?.profilePicture || '' });
        setIsEditing(false);
    };

    const role = user?.companyRole;

    return (
        <React.Fragment>
            <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>My Profile</h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Manage your personal information</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {isEditing ? (
                        <>
                            <IBtn onClick={handleCancel} icon={X} label="Cancel" secondary />
                            <IBtn onClick={handleSave} icon={Check} label={isSaving ? 'Saving...' : 'Save Changes'} loading={isSaving} />
                        </>
                    ) : (
                        <IBtn onClick={() => setIsEditing(true)} label="Edit Profile" />
                    )}
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }} className="custom-scrollbar">
                <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderLeft: `3px solid var(--accent)`, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: '64px', height: '64px', background: 'var(--bg-active)', border: '2px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', flexShrink: 0 }}>
                                {profileData.profilePicture ? (
                                    <img src={profileData.profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : user?.username?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            {isEditing && (
                                <button style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                                    <Camera size={16} style={{ color: 'white' }} />
                                </button>
                            )}
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>{user?.username || 'User'}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: roleBorder[role] || 'var(--text-muted)', border: `1px solid ${roleBorder[role] || 'var(--border-default)'}`, padding: '2px 7px' }}>
                                    {role?.charAt(0).toUpperCase() + role?.slice(1) || 'Member'}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Building size={11} /> {company?.name || 'Company'}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Mail size={11} /> {user?.email}
                                </span>
                            </div>
                        </div>
                    </div>

                    {}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={14} style={{ color: 'var(--accent)' }} /> Personal Information
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                                { key: 'username', label: 'Full Name', type: 'text', placeholder: 'Enter your name' },
                                { key: 'email', label: 'Email Address', type: 'email', placeholder: 'email@example.com' },
                                { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+1 (555) 123-4567' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>{f.label}</label>
                                    {isEditing ? (
                                        <input type={f.type} value={profileData[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} style={fieldSt} />
                                    ) : (
                                        <div style={{ padding: '8px 12px', background: 'var(--bg-active)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 400 }}>{profileData[f.key] || <em style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>Not set</em>}</div>
                                    )}
                                </div>
                            ))}
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>Member Since</label>
                                <div style={{ padding: '8px 12px', background: 'var(--bg-active)', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                                </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>Address</label>
                                {isEditing ? (
                                    <textarea value={profileData.address} onChange={e => set('address', e.target.value)} rows={3} placeholder="123 Main St, City, State, ZIP" style={{ ...fieldSt, resize: 'none', height: '72px' }} />
                                ) : (
                                    <div style={{ padding: '8px 12px', background: 'var(--bg-active)', fontSize: '13px', color: 'var(--text-primary)', minHeight: '52px' }}>{profileData.address || <em style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>Not set</em>}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield size={14} style={{ color: 'var(--accent)' }} /> Account Security
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { title: 'Password', note: 'Last changed 30 days ago', btnLabel: 'Change Password', primary: false },
                                { title: 'Two-Factor Authentication', note: 'Add an extra layer of security', btnLabel: 'Enable 2FA', primary: true },
                            ].map(item => (
                                <div key={item.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{item.title}</p>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.note}</p>
                                    </div>
                                    <SecBtn label={item.btnLabel} primary={item.primary} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
};

const IBtn = ({ onClick, icon: Icon, label, secondary, loading }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={loading} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: secondary ? (hov ? 'var(--bg-hover)' : 'var(--bg-surface)') : (hov ? 'var(--accent-hover)' : 'var(--accent)'), border: secondary ? '1px solid var(--border-default)' : 'none', color: secondary ? 'var(--text-secondary)' : 'var(--bg-base)', fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', borderRadius: '2px', opacity: loading ? 0.7 : 1, transition: 'all 150ms ease' }}>
            {loading ? <div style={{ width: '12px', height: '12px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : Icon && <Icon size={12} />}
            {label}
        </button>
    );
};

const SecBtn = ({ label, primary }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '6px 12px', background: primary ? (hov ? 'var(--accent-hover)' : 'var(--accent)') : (hov ? 'var(--bg-hover)' : 'none'), border: primary ? 'none' : '1px solid var(--border-default)', color: primary ? 'var(--bg-base)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            {label}
        </button>
    );
};

export default AdminProfile;
